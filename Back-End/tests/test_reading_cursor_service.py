"""Reading cursor helpers."""

from datetime import datetime, timezone

from app.models.domain import User
from app.services.reading_cursor_service import cursor_at_reading_scope_end, restart_reading_cursor


def _user(**kwargs) -> User:
    base = dict(email="t@example.com", password_hash="x")
    base.update(kwargs)
    return User(**base)


def test_cursor_at_scope_end_single_surah_last_ayah():
    u = _user(
        onboarding_completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
        reading_cursor_surah=94,
        reading_cursor_ayah=8,
        reading_scope="single_surah",
        reading_scope_surah=94,
    )
    assert cursor_at_reading_scope_end(u) is True


def test_cursor_not_at_scope_end_single_surah():
    u = _user(
        onboarding_completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
        reading_cursor_surah=94,
        reading_cursor_ayah=5,
        reading_scope="single_surah",
        reading_scope_surah=94,
    )
    assert cursor_at_reading_scope_end(u) is False


def test_cursor_at_scope_end_full_mushaf():
    u = _user(
        onboarding_completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
        reading_cursor_surah=114,
        reading_cursor_ayah=6,
        reading_scope="full_mushaf",
        reading_scope_surah=None,
    )
    assert cursor_at_reading_scope_end(u) is True


def test_no_cursor_not_at_end():
    u = _user(onboarding_completed_at=datetime.now(timezone.utc).replace(tzinfo=None))
    assert cursor_at_reading_scope_end(u) is False


def test_restart_full_mushaf_to_fatiha():
    u = _user(
        onboarding_completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
        reading_cursor_surah=114,
        reading_cursor_ayah=6,
        reading_scope="full_mushaf",
        reading_start_surah=114,
        reading_start_ayah=6,
    )
    restart_reading_cursor(u)
    assert u.reading_cursor_surah == 1 and u.reading_cursor_ayah == 1
    assert u.reading_start_surah == 1 and u.reading_start_ayah == 1


def test_restart_single_surah_to_first_ayah():
    u = _user(
        onboarding_completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
        reading_cursor_surah=94,
        reading_cursor_ayah=8,
        reading_scope="single_surah",
        reading_scope_surah=94,
        reading_start_surah=94,
        reading_start_ayah=8,
    )
    restart_reading_cursor(u)
    assert u.reading_cursor_surah == 94 and u.reading_cursor_ayah == 1
