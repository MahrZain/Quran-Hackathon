"""Map stored onboarding fields to a recommended verse key (surah:ayah)."""

from __future__ import annotations

from datetime import date, datetime, timezone

from app.models.domain import User

# Short, approachable āyāt (Juz ʿAmma–style and well-known)
JUZ_AMMA_EASY = [
    "112:1",
    "113:1",
    "114:1",
    "108:1",
    "103:1",
    "100:1",
    "95:1",
    "93:1",
    "87:1",
    "78:1",
]
# Rotating “daily bite” pool — non-sequential, memorable
DAILY_BITES_POOL = [
    "94:5",
    "94:6",
    "57:4",
    "2:152",
    "2:153",
    "2:286",
    "39:53",
    "65:2",
    "51:56",
    "55:13",
    "67:1",
    "36:83",
]
# Topic / theme → anchor āyah (expand over time)
TOPIC_VERSE: dict[str, str] = {
    "patience": "2:153",
    "stress": "94:5",
    "gratitude": "2:152",
    "hope": "39:53",
    "fear": "3:173",
    "general": "1:1",
}


def _day_index() -> int:
    today = datetime.now(timezone.utc).date()
    start = date(today.year, 1, 1)
    return (today - start).days


def recommended_verse_key(user: User) -> str | None:
    """
    Return verse key when onboarding is complete; otherwise None (caller uses cold start).
    """
    if user.onboarding_completed_at is None:
        return None

    goal = (user.onboarding_goal or "habit").strip().lower()
    if goal == "reading":
        goal = "habit"
    level = (user.onboarding_level or "beginner").strip().lower()
    if level == "daily_learner":
        level = "regular"
    time_b = (user.onboarding_time_budget or "3").strip().lower()
    journey = (user.onboarding_journey_mode or "").strip().lower()
    topic = (user.onboarding_topic_tag or "general").strip().lower()

    if goal == "understand" or goal == "listen":
        if journey == "beginning":
            return "1:1"
        if journey == "topic":
            return TOPIC_VERSE.get(topic, TOPIC_VERSE["general"])
        if journey == "daily_bites" or not journey:
            i = _day_index() % len(DAILY_BITES_POOL)
            return DAILY_BITES_POOL[i]

    # goal == habit (default)
    if level == "beginner":
        if time_b == "1":
            return JUZ_AMMA_EASY[_day_index() % len(JUZ_AMMA_EASY)]
        return "94:5"
    if level == "intermediate":
        i = _day_index() % len(DAILY_BITES_POOL)
        return DAILY_BITES_POOL[i]
    # regular reader
    i = (_day_index() + 3) % len(DAILY_BITES_POOL)
    return DAILY_BITES_POOL[i]
