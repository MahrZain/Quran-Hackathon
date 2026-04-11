"""Streak: consecutive UTC calendar days anchored at the user's latest logged day."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.domain import StreakActivity


def compute_streak_count(session_id: str, db: Session) -> int:
    rows = db.execute(select(StreakActivity.activity_date).where(StreakActivity.session_id == session_id)).scalars().all()
    dates = set(rows)
    if not dates:
        return 0
    anchor = max(dates)
    streak = 0
    d = anchor
    while d in dates:
        streak += 1
        d = d - timedelta(days=1)
    return streak
