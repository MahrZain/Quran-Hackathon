"""User verse bookmarks and Quran Foundation sync."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.common import bookmark_to_out
from app.db.database import get_db
from app.models.domain import QuranBookmarkSyncStatus, User, VerseBookmark
from app.models.schemas import BookmarkCreate, BookmarkOut
from app.services import bookmark_sync_task
from app.services.reading_cursor_service import clamp_ayah_to_surah

router = APIRouter()


@router.get("/bookmarks", response_model=list[BookmarkOut])
def list_bookmarks_api(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[BookmarkOut]:
    rows = db.execute(
        select(VerseBookmark)
        .where(VerseBookmark.user_id == user.id)
        .order_by(VerseBookmark.created_at.desc())
    ).scalars().all()
    return [bookmark_to_out(b) for b in rows]


@router.post("/bookmarks", response_model=BookmarkOut)
async def create_bookmark_api(
    body: BookmarkCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BookmarkOut:
    ms, ma = clamp_ayah_to_surah(body.surah_id, body.ayah_number)
    note = (body.note or "").strip() or None
    existing = db.execute(
        select(VerseBookmark).where(
            VerseBookmark.user_id == user.id,
            VerseBookmark.surah_id == ms,
            VerseBookmark.ayah_number == ma,
        )
    ).scalar_one_or_none()

    if existing:
        if note is not None:
            existing.note = note
        need_push = existing.quran_sync_status != QuranBookmarkSyncStatus.synced or not (
            existing.quran_bookmark_id or ""
        ).strip()
        if need_push:
            existing.quran_sync_status = QuranBookmarkSyncStatus.pending
            existing.last_sync_error = None
        db.add(existing)
        db.commit()
        db.refresh(existing)
        if need_push:
            background_tasks.add_task(bookmark_sync_task.push_bookmark_to_quran_task, existing.id)
        return bookmark_to_out(existing)

    bm = VerseBookmark(
        user_id=user.id,
        surah_id=ms,
        ayah_number=ma,
        note=note,
        quran_sync_status=QuranBookmarkSyncStatus.pending,
    )
    db.add(bm)
    db.commit()
    db.refresh(bm)
    background_tasks.add_task(bookmark_sync_task.push_bookmark_to_quran_task, bm.id)
    return bookmark_to_out(bm)


@router.delete("/bookmarks/{surah_id}/{ayah_number}", status_code=204)
async def delete_bookmark_api(
    surah_id: int,
    ayah_number: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    if surah_id < 1 or surah_id > 114:
        raise HTTPException(status_code=422, detail="surah_id must be between 1 and 114")
    ms, ma = clamp_ayah_to_surah(surah_id, ayah_number)
    bm = db.execute(
        select(VerseBookmark).where(
            VerseBookmark.user_id == user.id,
            VerseBookmark.surah_id == ms,
            VerseBookmark.ayah_number == ma,
        )
    ).scalar_one_or_none()
    if bm is None:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    remote = (bm.quran_bookmark_id or "").strip()
    uid = user.id
    db.delete(bm)
    db.commit()
    if remote:
        background_tasks.add_task(bookmark_sync_task.push_bookmark_delete_to_quran_task, uid, remote)
