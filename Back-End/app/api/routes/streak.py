"""Streak snapshot, activities, and mark-complete."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.api.routes.common import ensure_session, effective_session_id
from app.core.config import get_settings
from app.db.database import get_db
from app.models.domain import StreakActivity, User
from app.models.schemas import StreakActivityOut, StreakRequest, StreakResponse, StreakSnapshot
from app.services import quran_user_service
from app.services.reading_cursor_service import (
    advance_user_cursor_after_mark,
    clamp_ayah_to_surah,
    format_verse_key,
    increment_daily_marks,
    parse_verse_key,
    seed_reading_cursor_from_legacy,
)
from app.services.ledger_time import today_in_ledger_tz
from app.services.streak_logic import compute_streak_count

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/streak/{session_id}/activities", response_model=list[StreakActivityOut])
def streak_activities_list(
    session_id: UUID,
    limit: int = Query(120, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> list[StreakActivityOut]:
    """Recent mark-complete days (newest first) for the habit / history ledger."""
    sid = effective_session_id(db, user, str(session_id))
    rows = (
        db.execute(
            select(StreakActivity)
            .where(StreakActivity.session_id == sid)
            .order_by(StreakActivity.activity_date.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return [StreakActivityOut.model_validate(r) for r in rows]


@router.get("/streak/{session_id}", response_model=StreakSnapshot)
def streak_summary(
    session_id: UUID,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> StreakSnapshot:
    """Current streak from SQLite `streak_activities` for this session."""
    sid = effective_session_id(db, user, str(session_id))
    n = compute_streak_count(sid, db)
    return StreakSnapshot(updated_streak_count=n)


@router.post("/streak", response_model=StreakResponse)
async def streak(
    payload: StreakRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> StreakResponse:
    sid = effective_session_id(db, user, str(payload.session_id))
    ensure_session(db, sid)

    d = payload.activity_date or today_in_ledger_tz(get_settings(), user)

    if user is not None:
        seed_reading_cursor_from_legacy(db, user)

    parsed = parse_verse_key(payload.ayah_read.strip())
    if not parsed:
        raise HTTPException(status_code=422, detail="ayah_read must look like surah:ayah")
    ms, ma = clamp_ayah_to_surah(*parsed)
    ayah = format_verse_key(ms, ma)

    existing = db.execute(
        select(StreakActivity).where(StreakActivity.session_id == sid, StreakActivity.activity_date == d)
    ).scalar_one_or_none()
    if existing:
        existing.ayah_read = ayah
    else:
        db.add(StreakActivity(session_id=sid, activity_date=d, ayah_read=ayah))

    ayahs_today = 0
    at_scope_end = False
    if user is not None and user.onboarding_completed_at:
        ayahs_today = increment_daily_marks(db, user.id, d)
        if user.reading_cursor_surah is not None:
            prog = advance_user_cursor_after_mark(db, user, ms, ma)
            at_scope_end = prog.at_scope_end
            db.add(user)

    db.commit()

    quran_synced = False
    if user is None:
        log.info("Demo Mode: Skipping external sync (no authenticated user)")
    elif not (user.quran_access_token or "").strip():
        log.info("Demo Mode: Skipping external sync (no Quran Foundation user token on record)")
    else:
        activity_payload = quran_user_service.build_activity_day_quran_payload(ayah, d)
        try:
            quran_synced = await quran_user_service.sync_activity_to_quran_foundation(
                db, user, activity_payload
            )
        except Exception:
            log.warning("Quran Foundation streak sync raised (suppressed)", exc_info=True)

    count = compute_streak_count(sid, db)

    next_s = next_a = None
    if user is not None and user.reading_cursor_surah is not None and user.reading_cursor_ayah is not None:
        next_s, next_a = user.reading_cursor_surah, user.reading_cursor_ayah
    next_key = format_verse_key(next_s, next_a) if next_s is not None and next_a is not None else None

    log.info("streak ok session=%s ayah=%s count=%d quran_synced=%s", sid, ayah, count, quran_synced)
    return StreakResponse(
        ok=True,
        updated_streak_count=count,
        message="Streak logged",
        quran_foundation_synced=quran_synced,
        next_verse_key=next_key,
        next_surah_id=next_s,
        next_ayah_number=next_a,
        ayahs_marked_today=ayahs_today,
        at_scope_end=at_scope_end,
    )
