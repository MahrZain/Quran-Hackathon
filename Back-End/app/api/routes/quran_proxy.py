"""Quran.com content API proxies (translations, verse, chapters)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from app.api.routes.common import VERSE_KEY_RE
from app.models.schemas import ChapterSummary, TranslationResourceOut, VerseBundleResponse
from app.services import quran_service

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/translations", response_model=list[TranslationResourceOut])
async def translation_resources_catalog(
    language: str | None = Query(
        default=None,
        max_length=8,
        description="Optional ISO-style filter passed to upstream (e.g. en, ur)",
    ),
) -> list[TranslationResourceOut]:
    """Translation editions from the configured Quran Content API (for dashboard / reader pickers)."""
    rows = await quran_service.fetch_translation_resources_catalog(language=language)
    return [TranslationResourceOut.model_validate(x) for x in rows]


@router.get("/verse", response_model=VerseBundleResponse)
async def verse_bundle(
    verse_key: str = Query(..., min_length=3, max_length=16, description="Surah:ayah, e.g. 94:5"),
    translation_resource_id: int | None = Query(
        default=None,
        ge=1,
        description="Optional Quran.com translation resource id; omit for server default",
    ),
) -> VerseBundleResponse:
    """Uthmani + translation + optional audio for the dashboard / focus / reader."""
    vk = verse_key.strip()
    if not VERSE_KEY_RE.match(vk):
        raise HTTPException(status_code=422, detail="verse_key must look like 94:5")

    uthmani, trans = "", ""
    audio: str | None = None
    try:
        uthmani, trans = await quran_service.fetch_verse_uthmani_and_translation(
            vk, translation_resource_id=translation_resource_id
        )
    except Exception:
        log.warning("verse text fetch failed for %s", vk, exc_info=True)
    try:
        audio = await quran_service.fetch_audio_url(vk)
    except Exception:
        log.warning("verse audio fetch failed for %s", vk, exc_info=True)

    return VerseBundleResponse(
        verse_key=vk,
        verse_text_uthmani=uthmani or "",
        verse_translation=trans or "",
        audio_url=audio,
    )


@router.get("/chapters", response_model=list[ChapterSummary])
async def chapters_catalog() -> list[ChapterSummary]:
    """All surahs (1–114) for Quran progress / surah list — proxied from configured Quran HTTP API."""
    try:
        rows = await quran_service.fetch_chapters_catalog()
    except Exception as e:
        log.warning("chapters catalog failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not load surah list from Quran API") from e
    if len(rows) < 114:
        log.warning("chapters catalog short count=%s", len(rows))
    return [ChapterSummary.model_validate(x) for x in rows]


@router.get("/chapters/{chapter_id}", response_model=ChapterSummary)
async def chapter_detail(chapter_id: int) -> ChapterSummary:
    if chapter_id < 1 or chapter_id > 114:
        raise HTTPException(status_code=404, detail="Surah must be between 1 and 114")
    try:
        row = await quran_service.fetch_chapter_detail(chapter_id)
    except Exception as e:
        log.warning("chapter %s detail failed: %s", chapter_id, e)
        raise HTTPException(status_code=502, detail="Could not load surah from Quran API") from e
    if not row:
        raise HTTPException(status_code=404, detail="Unknown surah")
    return ChapterSummary.model_validate(row)
