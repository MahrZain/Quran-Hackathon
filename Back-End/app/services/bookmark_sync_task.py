"""Post-commit background sync of verse bookmarks to Quran Foundation User API."""

from __future__ import annotations

from datetime import datetime, timezone

from app.db.database import SessionLocal
from app.models.domain import QuranBookmarkSyncStatus, User, VerseBookmark
from app.services import quran_user_service
from app.services.reading_cursor_service import format_verse_key


def _utc_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def push_bookmark_to_quran_task(bookmark_id: int) -> None:
    """After ASAR DB commit: create bookmark upstream when tokens allow."""
    with SessionLocal() as db:
        bm = db.get(VerseBookmark, bookmark_id)
        if bm is None:
            return
        user = db.get(User, bm.user_id)
        if user is None:
            return
        if not (user.quran_access_token or "").strip():
            bm.quran_sync_status = QuranBookmarkSyncStatus.failed
            bm.last_sync_error = "no_quran_token"
            db.add(bm)
            db.commit()
            return

        vk = format_verse_key(bm.surah_id, bm.ayah_number)
        ok, remote_id = await quran_user_service.create_bookmark_on_quran_foundation(db, user, vk)
        bm = db.get(VerseBookmark, bookmark_id)
        if bm is None:
            return

        if ok:
            bm.quran_sync_status = QuranBookmarkSyncStatus.synced
            bm.quran_synced_at = _utc_naive()
            bm.last_sync_error = None
            if remote_id:
                bm.quran_bookmark_id = remote_id
            db.add(bm)
            db.commit()
        else:
            bm.quran_sync_status = QuranBookmarkSyncStatus.failed
            bm.last_sync_error = "quran_upstream"
            db.add(bm)
            db.commit()


async def push_bookmark_delete_to_quran_task(user_id: int, remote_id: str) -> None:
    """After local row removed: delete upstream bookmark by id when possible."""
    rid = (remote_id or "").strip()
    if not rid:
        return
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if user is None:
            return
        await quran_user_service.delete_bookmark_on_quran_foundation(db, user, rid)
        db.commit()
