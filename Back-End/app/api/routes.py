"""Versioned HTTP API for chat, history, and streaks."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.db.database import get_db
from app.models.domain import ChatMessage, MessageRole, StreakActivity, User, UserSession
from app.models.schemas import (
    ChapterSummary,
    ChatRequest,
    ChatResponse,
    HistoryMessage,
    StreakRequest,
    StreakResponse,
    StreakSnapshot,
    VerseBundleResponse,
)
from app.services import ai_service, quran_service, quran_user_service
from app.services.streak_logic import compute_streak_count

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1")

_VERSE_KEY_RE = re.compile(r"^\d{1,3}:\d{1,3}$")


def _ensure_session(db: Session, session_id: str) -> None:
    if db.get(UserSession, session_id) is None:
        db.add(UserSession(session_id=session_id))
        db.commit()


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    sid = str(payload.session_id)
    _ensure_session(db, sid)

    db.add(ChatMessage(session_id=sid, role=MessageRole.user, content=payload.message.strip()))
    db.commit()

    try:
        result = await ai_service.generate_reflection(sid, payload.message, db)
    except ValueError as e:
        log.warning("chat unavailable session=%s: %s", sid, e)
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        log.error("chat runtime error session=%s: %s", sid, e)
        raise HTTPException(status_code=500, detail=str(e)) from e

    db.add(ChatMessage(session_id=sid, role=MessageRole.assistant, content=result.reply))
    db.commit()

    streak = compute_streak_count(sid, db)
    log.info(
        "chat ok session=%s msg_len=%d reply_len=%d streak=%d verse=%s",
        sid,
        len(payload.message),
        len(result.reply),
        streak,
        result.verse_key,
    )
    return ChatResponse(
        ai_reply=result.reply,
        updated_streak_count=streak,
        verse_key=result.verse_key,
        verse_text_uthmani=result.verse_text_uthmani,
        verse_translation=result.verse_translation,
        audio_url=result.audio_url,
    )


@router.get("/streak/{session_id}", response_model=StreakSnapshot)
def streak_summary(session_id: UUID, db: Session = Depends(get_db)) -> StreakSnapshot:
    """Current streak from SQLite `streak_activities` for this session."""
    sid = str(session_id)
    n = compute_streak_count(sid, db)
    return StreakSnapshot(updated_streak_count=n)


@router.get("/verse", response_model=VerseBundleResponse)
async def verse_bundle(
    verse_key: str = Query(..., min_length=3, max_length=16, description="Surah:ayah, e.g. 94:5"),
) -> VerseBundleResponse:
    """Uthmani + translation + optional audio for the dashboard / focus / reader."""
    vk = verse_key.strip()
    if not _VERSE_KEY_RE.match(vk):
        raise HTTPException(status_code=422, detail="verse_key must look like 94:5")

    uthmani, trans = "", ""
    audio: str | None = None
    try:
        uthmani, trans = await quran_service.fetch_verse_uthmani_and_translation(vk)
    except Exception:
        log.warning("verse text fetch failed for %s", vk, exc_info=True)
    try:
        audio = await quran_service.fetch_audio_url(vk)
    except Exception:
        log.warning("verse audio fetch failed for %s", vk, exc_info=True)

    return VerseBundleResponse(
        verse_key=vk,
        verse_text_uthmani=uthmani or "",
        verse_translation=trans or "",
        audio_url=audio,
    )


@router.get("/chapters", response_model=list[ChapterSummary])
async def chapters_catalog() -> list[ChapterSummary]:
    """All surahs (1–114) for Quran progress / surah list — proxied from configured Quran HTTP API."""
    try:
        rows = await quran_service.fetch_chapters_catalog()
    except Exception as e:
        log.warning("chapters catalog failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not load surah list from Quran API") from e
    if len(rows) < 114:
        log.warning("chapters catalog short count=%s", len(rows))
    return [ChapterSummary.model_validate(x) for x in rows]


@router.get("/chapters/{chapter_id}", response_model=ChapterSummary)
async def chapter_detail(chapter_id: int) -> ChapterSummary:
    if chapter_id < 1 or chapter_id > 114:
        raise HTTPException(status_code=404, detail="Surah must be between 1 and 114")
    try:
        row = await quran_service.fetch_chapter_detail(chapter_id)
    except Exception as e:
        log.warning("chapter %s detail failed: %s", chapter_id, e)
        raise HTTPException(status_code=502, detail="Could not load surah from Quran API") from e
    if not row:
        raise HTTPException(status_code=404, detail="Unknown surah")
    return ChapterSummary.model_validate(row)


@router.get("/history/{session_id}", response_model=list[HistoryMessage])
def history(session_id: UUID, db: Session = Depends(get_db)) -> list[HistoryMessage]:
    sid = str(session_id)
    rows = db.execute(
        select(ChatMessage).where(ChatMessage.session_id == sid).order_by(ChatMessage.created_at.asc())
    ).scalars().all()
    return [HistoryMessage.model_validate(m) for m in rows]


@router.post("/streak", response_model=StreakResponse)
async def streak(
    payload: StreakRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> StreakResponse:
    sid = str(payload.session_id)
    _ensure_session(db, sid)

    d = payload.activity_date or datetime.now(timezone.utc).date()
    ayah = payload.ayah_read.strip()

    existing = db.execute(
        select(StreakActivity).where(StreakActivity.session_id == sid, StreakActivity.activity_date == d)
    ).scalar_one_or_none()
    if existing:
        existing.ayah_read = ayah
    else:
        db.add(StreakActivity(session_id=sid, activity_date=d, ayah_read=ayah))
    db.commit()

    quran_synced = False
    if user is None:
        log.info("Demo Mode: Skipping external sync (no authenticated user)")
    elif not (user.quran_access_token or "").strip():
        log.info("Demo Mode: Skipping external sync (no Quran Foundation user token on record)")
    else:
        activity_payload = {"verseKey": ayah, "activityDate": str(d)}
        try:
            quran_synced = await quran_user_service.sync_activity_to_quran_foundation(
                db, user, activity_payload
            )
        except Exception:
            log.warning("Quran Foundation streak sync raised (suppressed)", exc_info=True)

    count = compute_streak_count(sid, db)
    log.info("streak ok session=%s ayah=%s count=%d quran_synced=%s", sid, ayah, count, quran_synced)
    return StreakResponse(
        ok=True,
        updated_streak_count=count,
        message="Streak logged",
        quran_foundation_synced=quran_synced,
    )
