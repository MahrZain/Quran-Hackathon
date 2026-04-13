"""Persisted reading cursor, legacy seeding, and daily mark counts."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.domain import ReadingDailyStat, User
from app.services.onboarding_policy import recommended_verse_key
from app.services.reading_progression import NextVerseResult, next_verse
from app.services.surah_verse_counts import verse_count_for_surah

_VERSE_KEY_RE = re.compile(r"^(\d{1,3}):(\d{1,3})$")


def parse_verse_key(key: str) -> tuple[int, int] | None:
    m = _VERSE_KEY_RE.match((key or "").strip())
    if not m:
        return None
    s, a = int(m.group(1)), int(m.group(2))
    if s < 1 or s > 114:
        return None
    return s, a


def format_verse_key(surah_id: int, ayah_number: int) -> str:
    return f"{surah_id}:{ayah_number}"


def clamp_ayah_to_surah(surah_id: int, ayah_number: int) -> tuple[int, int]:
    vc = verse_count_for_surah(surah_id) or 1
    return surah_id, max(1, min(ayah_number, vc))


def seed_reading_cursor_from_legacy(db: Session, user: User) -> bool:
    """
    If onboarding is done but cursor is empty, set cursor from recommended_verse_key once.
    Returns True if a change was made (caller should commit).
    """
    if user.onboarding_completed_at is None:
        return False
    if user.reading_cursor_surah is not None and user.reading_cursor_ayah is not None:
        return False
    key = recommended_verse_key(user)
    if not key:
        return False
    parsed = parse_verse_key(key)
    if not parsed:
        return False
    s, a = clamp_ayah_to_surah(*parsed)
    user.reading_cursor_surah = s
    user.reading_cursor_ayah = a
    user.reading_start_surah = s
    user.reading_start_ayah = a
    if not (user.reading_scope or "").strip():
        user.reading_scope = "full_mushaf"
    db.add(user)
    return True


def effective_current_verse_key(user: User) -> str | None:
    if user.reading_cursor_surah is not None and user.reading_cursor_ayah is not None:
        return format_verse_key(user.reading_cursor_surah, user.reading_cursor_ayah)
    return recommended_verse_key(user)


def ayahs_marked_today(db: Session, user_id: int, d: date | None = None) -> int:
    day = d or datetime.now(timezone.utc).date()
    row = db.execute(
        select(ReadingDailyStat).where(
            ReadingDailyStat.user_id == user_id,
            ReadingDailyStat.activity_date == day,
        )
    ).scalar_one_or_none()
    return int(row.marks_count) if row else 0


def increment_daily_marks(db: Session, user_id: int, d: date | None = None) -> int:
    """Increment today's mark count; return new total."""
    day = d or datetime.now(timezone.utc).date()
    row = db.execute(
        select(ReadingDailyStat).where(
            ReadingDailyStat.user_id == user_id,
            ReadingDailyStat.activity_date == day,
        )
    ).scalar_one_or_none()
    if row is None:
        row = ReadingDailyStat(user_id=user_id, activity_date=day, marks_count=1)
        db.add(row)
        db.flush()
        return 1
    row.marks_count = int(row.marks_count) + 1
    db.add(row)
    db.flush()
    return int(row.marks_count)


def advance_user_cursor_after_mark(db: Session, user: User, marked_surah: int, marked_ayah: int) -> NextVerseResult:
    """
    After logging a mark for marked_surah:marked_ayah, move user's cursor to the next verse in scope.
    Returns progression result; caller updates user.reading_cursor_* when not at_scope_end.
    """
    scope = (user.reading_scope or "full_mushaf").strip().lower()
    ss = user.reading_scope_surah
    result = next_verse(
        marked_surah,
        marked_ayah,
        scope=scope if scope in ("full_mushaf", "single_surah") else "full_mushaf",
        scope_surah=ss,
    )
    if result.at_scope_end:
        user.reading_cursor_surah = marked_surah
        user.reading_cursor_ayah = marked_ayah
    else:
        user.reading_cursor_surah = result.surah_id
        user.reading_cursor_ayah = result.ayah_number
    db.add(user)
    return result
