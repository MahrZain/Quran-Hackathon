"""Shared helpers for auth routes: UserMe projection."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.domain import User
from app.models.schemas import UserMe
from app.services.onboarding_policy import recommended_verse_key
from app.services.ledger_time import effective_ledger_timezone_name, today_in_ledger_tz
from app.services.reading_cursor_service import (
    ayahs_marked_today,
    cursor_at_reading_scope_end,
    effective_current_verse_key,
)


def build_user_me(user: User, db: Session | None = None) -> UserMe:
    settings = get_settings()
    sid = (user.asar_session_id or "").strip()
    marked = 0
    if db is not None:
        day = today_in_ledger_tz(settings, user)
        marked = ayahs_marked_today(db, user.id, day)
    cvk = effective_current_verse_key(user)
    at_end = cursor_at_reading_scope_end(user)
    return UserMe(
        id=user.id,
        email=user.email,
        asar_session_id=sid,
        ledger_timezone=effective_ledger_timezone_name(settings, user),
        onboarding_completed=user.onboarding_completed_at is not None,
        onboarding_goal=user.onboarding_goal,
        onboarding_level=user.onboarding_level,
        onboarding_time_budget=user.onboarding_time_budget,
        onboarding_journey_mode=user.onboarding_journey_mode,
        onboarding_topic_tag=user.onboarding_topic_tag,
        recommended_verse_key=recommended_verse_key(user),
        current_verse_key=cvk,
        reading_scope=user.reading_scope,
        reading_scope_surah=user.reading_scope_surah,
        ayahs_marked_today=marked,
        at_reading_scope_end=at_end,
    )
