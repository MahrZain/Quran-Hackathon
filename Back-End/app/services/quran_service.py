"""Async HTTP client for verse / translation (tafsir proxy) / optional user-activity sync."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.core.config import Settings, get_settings

log = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None
_oauth_access_token: str | None = None
_oauth_token_expires_monotonic: float = 0.0


def set_http_client(client: httpx.AsyncClient | None) -> None:
    global _client
    _client = client


def _client_or_raise() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("HTTP client not initialized (app lifespan)")
    return _client


async def _oauth_access_token(settings: Settings) -> str | None:
    """Client-credentials token; cached until shortly before expiry."""
    global _oauth_access_token, _oauth_token_expires_monotonic
    if not (
        settings.quran_oauth_token_url
        and settings.quran_oauth_client_id
        and settings.quran_oauth_client_secret
    ):
        return None

    now = time.monotonic()
    if _oauth_access_token and now < _oauth_token_expires_monotonic:
        return _oauth_access_token

    client = _client_or_raise()
    form: dict[str, str] = {
        "grant_type": "client_credentials",
        "client_id": settings.quran_oauth_client_id,
        "client_secret": settings.quran_oauth_client_secret,
    }
    if settings.quran_oauth_scope.strip():
        form["scope"] = settings.quran_oauth_scope.strip()

    r = await client.post(
        settings.quran_oauth_token_url,
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30.0,
    )
    r.raise_for_status()
    body = r.json()
    token = body.get("access_token")
    if not token:
        log.error("OAuth token response missing access_token: %s", body)
        return None
    ttl = int(body.get("expires_in", 3600))
    _oauth_access_token = token
    _oauth_token_expires_monotonic = now + max(ttl - 60, 30)
    return _oauth_access_token


async def _auth_headers(settings: Settings) -> dict[str, str]:
    h: dict[str, str] = {}
    oauth_token = await _oauth_access_token(settings)
    if oauth_token:
        h["Authorization"] = f"Bearer {oauth_token}"
        return h
    if settings.quran_api_key:
        h["X-API-Key"] = settings.quran_api_key
        h["Authorization"] = f"Bearer {settings.quran_api_key}"
    return h


async def fetch_verse_text(verse_key: str, settings: Settings | None = None) -> str:
    """Return Arabic + simple English text for a verse key (surah:ayah)."""
    s = settings or get_settings()
    client = _client_or_raise()
    url = f"{s.quran_api_base_url.rstrip('/')}/verses/by_key/{verse_key}"
    params = {
        "language": "en",
        "words": "false",
        "fields": "text_uthmani,text_imlaei,translations",
        "translations": str(s.quran_translation_resource_id),
    }
    r = await client.get(url, params=params, headers=await _auth_headers(s), timeout=30.0)
    r.raise_for_status()
    data: dict[str, Any] = r.json()
    verse = data.get("verse") or {}
    text_uthmani = verse.get("text_uthmani") or verse.get("text") or ""
    trans = ""
    trs = verse.get("translations") or []
    if trs:
        trans = trs[0].get("text") or ""
    parts = [p for p in (text_uthmani, trans) if p]
    return "\n".join(parts) if parts else ""


async def fetch_tafsir_or_translation(verse_key: str, settings: Settings | None = None) -> str:
    """Fetch translation / commentary text for RAG context (resource id from settings)."""
    s = settings or get_settings()
    client = _client_or_raise()
    url = f"{s.quran_api_base_url.rstrip('/')}/quran/translations/{s.quran_translation_resource_id}"
    params = {"verse_key": verse_key}
    r = await client.get(url, params=params, headers=await _auth_headers(s), timeout=30.0)
    r.raise_for_status()
    data = r.json()
    trs = data.get("translations") or []
    if not trs:
        return ""
    return trs[0].get("text") or ""


async def fetch_audio_url(verse_key: str, settings: Settings | None = None) -> str | None:
    """Return audio URL when the upstream API exposes per-verse audio metadata."""
    s = settings or get_settings()
    client = _client_or_raise()
    url = f"{s.quran_api_base_url.rstrip('/')}/verses/by_key/{verse_key}"
    params = {"language": "en", "words": "false", "fields": "audio"}
    r = await client.get(url, params=params, headers=await _auth_headers(s), timeout=30.0)
    r.raise_for_status()
    data = r.json()
    verse = data.get("verse") or {}
    audio = verse.get("audio")
    if isinstance(audio, dict):
        return audio.get("url")
    if isinstance(audio, str):
        return audio
    return None


async def post_user_activity(verse_key: str, session_id: str, settings: Settings | None = None) -> bool:
    """
    Optional sync to a 'user activity' endpoint when QURAN_USER_ACTIVITY_URL is set.
    URL may include {verse_key} and {session_id} placeholders.
    """
    s = settings or get_settings()
    if not s.quran_user_activity_url:
        return False
    client = _client_or_raise()
    url = (
        s.quran_user_activity_url.replace("{verse_key}", verse_key).replace("{session_id}", session_id)
    )
    payload = {"verse_key": verse_key, "session_id": session_id}
    r = await client.post(url, json=payload, headers=await _auth_headers(s), timeout=30.0)
    if r.status_code >= 400:
        log.warning("Quran user activity POST failed: %s %s", r.status_code, r.text[:200])
        return False
    return True


async def build_quranic_context(verse_key: str, settings: Settings | None = None) -> str:
    """Combined verse + translation for the model."""
    s = settings or get_settings()
    try:
        verse = await fetch_verse_text(verse_key, s)
        tafsir = await fetch_tafsir_or_translation(verse_key, s)
    except httpx.HTTPError as e:
        log.warning("Quran fetch failed for %s: %s", verse_key, e)
        return ""
    blocks = [f"Verse {verse_key}", verse]
    if tafsir:
        blocks.append("Translation / tafsir excerpt:\n" + tafsir[:6000])
    return "\n\n".join(blocks).strip()
