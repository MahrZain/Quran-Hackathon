"""Current user profile, onboarding, and reading preferences."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth.helpers import build_user_me
from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.domain import User
from app.models.schemas import (
    LedgerTimezonePatch,
    OnboardingCompleteRequest,
    RecommendedVerseResponse,
    UserMe,
)
from app.services.onboarding_policy import recommended_verse_key
from app.services.reading_cursor_service import (
    clamp_ayah_to_surah,
    effective_current_verse_key,
    parse_verse_key,
    restart_reading_cursor,
    seed_reading_cursor_from_legacy,
)

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/me", response_model=UserMe)
def me(
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> UserMe:
    if not (user.asar_session_id or "").strip():
        user.asar_session_id = str(uuid4())
        db.add(user)
        db.commit()
        db.refresh(user)
    sid = (user.asar_session_id or "").strip()
    assert sid, "asar_session_id must be set for /auth/me"
    changed = seed_reading_cursor_from_legacy(db, user)
    if changed:
        db.commit()
        db.refresh(user)
    return build_user_me(user, db)


@router.patch("/me/ledger-timezone", response_model=UserMe)
def patch_ledger_timezone(
    body: LedgerTimezonePatch,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> UserMe:
    tz = (body.ledger_timezone or "").strip()
    if not tz:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="ledger_timezone is required")
    try:
        ZoneInfo(tz)
    except ZoneInfoNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="ledger_timezone must be a valid IANA timezone name",
        ) from e
    user.ledger_timezone = tz
    db.add(user)
    db.commit()
    db.refresh(user)
    log.info("ledger_timezone updated user_id=%s tz=%s", user.id, tz)
    return build_user_me(user, db)


@router.post("/me/reading-restart", response_model=UserMe)
def reading_restart(
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> UserMe:
    """Reset sequential reading cursor to the beginning of the current scope (1:1 or surah 1)."""
    if user.onboarding_completed_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete onboarding before restarting reading",
        )
    changed = seed_reading_cursor_from_legacy(db, user)
    if changed:
        db.commit()
        db.refresh(user)
    if user.reading_cursor_surah is None or user.reading_cursor_ayah is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No reading cursor to restart; complete onboarding again if needed",
        )
    restart_reading_cursor(user)
    db.add(user)
    db.commit()
    db.refresh(user)
    log.info("reading_restarted user_id=%s scope=%s cursor=%s:%s", user.id, user.reading_scope, user.reading_cursor_surah, user.reading_cursor_ayah)
    return build_user_me(user, db)


@router.patch("/me/onboarding", response_model=UserMe)
def complete_onboarding(
    body: OnboardingCompleteRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> UserMe:
    """First-time onboarding or updating reading preferences (same payload; overwrites cursor/start)."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if body.goal in ("habit", "reading"):
        rs = body.reading_scope or "full_mushaf"
        if rs not in ("full_mushaf", "single_surah"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="reading_scope must be full_mushaf or single_surah",
            )
        sl = body.start_location or "beginning"
        if rs == "single_surah" and body.scope_surah is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="scope_surah is required when reading_scope is single_surah",
            )
        if sl == "beginning":
            if rs == "single_surah":
                assert body.scope_surah is not None
                start_s, start_a = body.scope_surah, 1
            else:
                start_s, start_a = 1, 1
        else:
            if body.start_surah is None or body.start_ayah is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="start_surah and start_ayah are required when start_location is custom",
                )
            start_s, start_a = clamp_ayah_to_surah(body.start_surah, body.start_ayah)
            if rs == "single_surah" and body.scope_surah is not None and start_s != body.scope_surah:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="start_surah must match scope_surah for single_surah mode",
                )

        user.onboarding_goal = body.goal
        user.onboarding_level = body.level
        user.onboarding_time_budget = body.time_budget
        user.onboarding_journey_mode = None
        user.onboarding_topic_tag = None
        user.reading_scope = rs
        user.reading_scope_surah = body.scope_surah if rs == "single_surah" else None
        user.reading_cursor_surah = start_s
        user.reading_cursor_ayah = start_a
        user.reading_start_surah = start_s
        user.reading_start_ayah = start_a
        user.onboarding_completed_at = now
        db.add(user)
        db.commit()
        db.refresh(user)
        log.info("onboarding_completed user_id=%s goal=%s reading=%s:%s", user.id, body.goal, start_s, start_a)
        return build_user_me(user, db)

    if body.goal in ("understand", "listen"):
        if not body.journey_mode:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="journey_mode is required for understand and listen goals",
            )
        journey = body.journey_mode
        topic = body.topic_tag if journey == "topic" else None
        if journey == "topic" and not topic:
            topic = "general"
        tb = body.time_budget or "3"
        user.onboarding_goal = body.goal
        user.onboarding_level = body.level
        user.onboarding_time_budget = tb
        user.onboarding_journey_mode = journey
        user.onboarding_topic_tag = topic
        user.onboarding_completed_at = now
        db.add(user)
        db.commit()
        db.refresh(user)
        key = recommended_verse_key(user)
        if key:
            parsed = parse_verse_key(key)
            if parsed:
                cs, ca = clamp_ayah_to_surah(*parsed)
                user.reading_cursor_surah = cs
                user.reading_cursor_ayah = ca
                user.reading_start_surah = cs
                user.reading_start_ayah = ca
                user.reading_scope = "full_mushaf"
                user.reading_scope_surah = None
                db.add(user)
                db.commit()
                db.refresh(user)
        log.info("onboarding_completed user_id=%s goal=%s", user.id, body.goal)
        return build_user_me(user, db)


@router.get("/me/recommended-verse", response_model=RecommendedVerseResponse)
def get_recommended_verse(
    user: Annotated[User, Depends(get_current_user)],
) -> RecommendedVerseResponse:
    key = effective_current_verse_key(user)
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complete onboarding first",
        )
    return RecommendedVerseResponse(verse_key=key)
