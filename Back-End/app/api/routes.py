"""Versioned HTTP API for chat, history, and streaks."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.domain import ChatMessage, MessageRole, StreakActivity, UserSession
from app.models.schemas import ChatRequest, ChatResponse, HistoryMessage, StreakRequest, StreakResponse
from app.services import ai_service, quran_service
from app.services.streak_logic import compute_streak_count

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1")


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
        reply = await ai_service.generate_reflection(sid, payload.message, db)
    except ValueError as e:
        log.warning("chat unavailable session=%s: %s", sid, e)
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        log.error("chat runtime error session=%s: %s", sid, e)
        raise HTTPException(status_code=500, detail=str(e)) from e

    db.add(ChatMessage(session_id=sid, role=MessageRole.assistant, content=reply))
    db.commit()

    streak = compute_streak_count(sid, db)
    log.info(
        "chat ok session=%s msg_len=%d reply_len=%d streak=%d",
        sid,
        len(payload.message),
        len(reply),
        streak,
    )
    return ChatResponse(ai_reply=reply, updated_streak_count=streak)


@router.get("/history/{session_id}", response_model=list[HistoryMessage])
def history(session_id: UUID, db: Session = Depends(get_db)) -> list[HistoryMessage]:
    sid = str(session_id)
    rows = db.execute(
        select(ChatMessage).where(ChatMessage.session_id == sid).order_by(ChatMessage.created_at.asc())
    ).scalars().all()
    return [HistoryMessage.model_validate(m) for m in rows]


@router.post("/streak", response_model=StreakResponse)
async def streak(payload: StreakRequest, db: Session = Depends(get_db)) -> StreakResponse:
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

    try:
        await quran_service.post_user_activity(ayah, sid)
    except Exception:
        log.exception("post_user_activity failed (non-fatal)")

    count = compute_streak_count(sid, db)
    log.info("streak ok session=%s ayah=%s count=%d", sid, ayah, count)
    return StreakResponse(ok=True, updated_streak_count=count, message="Streak logged")
