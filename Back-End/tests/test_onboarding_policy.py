"""Verse key routing from onboarding profile."""

from datetime import datetime, timezone

import pytest

from app.models.domain import User
from app.services.onboarding_policy import DAILY_BITES_POOL, recommended_verse_key


def _user(**kwargs) -> User:
    u = User(
        email="t@example.com",
        password_hash="x",
        onboarding_completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
        **kwargs,
    )
    return u


def test_incomplete_onboarding_returns_none():
    u = User(email="a@b.c", password_hash="h")
    assert u.onboarding_completed_at is None
    assert recommended_verse_key(u) is None


def test_habit_beginner_one_minute_uses_juz_amma_pool():
    u = _user(onboarding_goal="habit", onboarding_level="beginner", onboarding_time_budget="1")
    k = recommended_verse_key(u)
    assert k is not None
    assert ":" in k


def test_understand_beginning_is_fatiha():
    u = _user(
        onboarding_goal="understand",
        onboarding_level="intermediate",
        onboarding_time_budget="3",
        onboarding_journey_mode="beginning",
    )
    assert recommended_verse_key(u) == "1:1"


def test_topic_patience():
    u = _user(
        onboarding_goal="understand",
        onboarding_level="regular",
        onboarding_time_budget="5_plus",
        onboarding_journey_mode="topic",
        onboarding_topic_tag="patience",
    )
    assert recommended_verse_key(u) == "2:153"


def test_daily_bites_is_from_pool():
    u = _user(
        onboarding_goal="listen",
        onboarding_level="beginner",
        onboarding_time_budget="3",
        onboarding_journey_mode="daily_bites",
    )
    k = recommended_verse_key(u)
    assert k in DAILY_BITES_POOL
