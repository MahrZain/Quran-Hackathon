"""Shared helpers for versioned REST routers under /api/v1."""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.domain import User, UserSession, VerseBookmark
from app.models.schemas import BookmarkOut
from app.services.reading_cursor_service import format_verse_key
from app.services.verse_key_utils import VERSE_KEY_PATTERN

# Backwards-compatible name for route modules
VERSE_KEY_RE = VERSE_KEY_PATTERN


def ensure_session(db: Session, session_id: str) -> None:
    if db.get(UserSession, session_id) is None:
        db.add(UserSession(session_id=session_id))
        db.commit()


def effective_session_id(db: Session, user: User | None, client_session_id: str) -> str:
    """
    Authenticated users: chat/streak/history are keyed only by the server-stored asar_session_id
    so a stale X-Session-ID from another account cannot bleed state. Anonymous: use client id.
    """
    if user is None:
        return client_session_id
    cur = (user.asar_session_id or "").strip()
    if not cur:
        cur = str(uuid4())
        user.asar_session_id = cur
        db.add(user)
        db.commit()
        db.refresh(user)
    return cur


def bookmark_to_out(row: VerseBookmark) -> BookmarkOut:
    return BookmarkOut(
        id=row.id,
        surah_id=row.surah_id,
        ayah_number=row.ayah_number,
        verse_key=format_verse_key(row.surah_id, row.ayah_number),
        note=row.note,
        created_at=row.created_at,
        quran_sync_status=row.quran_sync_status.value,
    )
