"""Async HTTP client for verse / translation (tafsir proxy) / optional user-activity sync."""

from __future__ import annotations

import functools
import json
import logging
import re
import time
from pathlib import Path
from typing import Any

import httpx

from app.core.config import Settings, get_settings

log = logging.getLogger(__name__)

_VERSE_KEY_RE = re.compile(r"^\d{1,3}:\d{1,3}$")

_MAX_AYAH_FALLBACK = 286  # safe upper bound for validation before HTTP fetch


@functools.lru_cache(maxsize=1)
def _surah_alias_to_surah_id() -> dict[str, int]:
    """
    Lowercased transliteration / slug -> surah number (1–114), from bundled Quran.com chapter names.
    """
    m: dict[str, int] = {}
    path = Path(__file__).resolve().parent.parent / "data" / "surah_name_simple.json"
    try:
        raw: list[dict[str, Any]] = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        log.warning("surah_name_simple.json missing or invalid (%s); name-based verse hints limited", e)
        return {"nas": 114, "annas": 114, "an-nas": 114, "an nas": 114, "fatihah": 1, "fatiha": 1, "al-fatihah": 1}

    for row in raw:
        sid = int(row["id"])
        name = (row.get("n") or "").strip()
        if not name:
            continue
        variants: set[str] = set()
        low = name.lower()
        no_apos = low.replace("'", "").replace("’", "").replace("\u2019", "")
        for base in (low, no_apos):
            variants.add(base)
            variants.add(base.replace(" ", ""))
            variants.add(re.sub(r"[\s']+", "-", base.strip()))
        for v in list(variants):
            v = v.strip("- ")
            if len(v) < 2:
                continue
            for pref in ("al-", "an-", "ar-", "as-", "ad-", "at-", "ash-"):
                if v.startswith(pref) and len(v) > len(pref) + 1:
                    variants.add(v[len(pref) :])
        for v in variants:
            v2 = v.strip("- ")
            if len(v2) >= 2 and v2 not in m:
                m[v2] = sid
    return m


def verse_keys_from_natural_language_query(text: str) -> list[str]:
    """
    Resolve explicit surah:ayah references from free text (e.g. 'sura nas ayat 1', '114:1', '2:255')
    without calling /search. Order: numeric colon pairs, surah-N ayah-M, then surah NAME ayah-M.
    """
    t = (text or "").strip()
    if len(t) < 2:
        return []
    al = _surah_alias_to_surah_id()
    found: list[str] = []
    seen: set[str] = set()

    def add_key(surah: int, ayah: int) -> None:
        if not (1 <= surah <= 114) or not (1 <= ayah <= _MAX_AYAH_FALLBACK):
            return
        vk = f"{surah}:{ayah}"
        if vk in seen:
            return
        if not _VERSE_KEY_RE.match(vk):
            return
        seen.add(vk)
        found.append(vk)

    for m in re.finditer(r"\b(\d{1,3})\s*:\s*(\d{1,3})\b", t):
        add_key(int(m.group(1)), int(m.group(2)))

    num_pat = re.compile(
        r"\b(?:surah|sura|surat|chapter)\s*#?\s*(\d{1,3})\s*[,،]?\s*(?:ayat|ayah|verse|ayet|a\.?)\s*#?\s*(\d{1,3})\b",
        re.I,
    )
    for m in num_pat.finditer(t):
        add_key(int(m.group(1)), int(m.group(2)))

    name_pat = re.compile(
        r"\b(?:surah|sura|surat|chapter)\s+([a-zA-Z'’\u2019\-\s]{2,60}?)\s+(?:ayat|ayah|verse|ayet)\s*#?\s*(\d{1,3})\b",
        re.I,
    )
    for m in name_pat.finditer(t):
        frag = re.sub(r"\s+", " ", m.group(1).strip().lower())
        frag = frag.strip("'’\u2019")
        ay = int(m.group(2))
        parts = [p for p in frag.split() if p]
        candidates: list[str] = [frag, frag.replace(" ", "-"), frag.replace(" ", "")]
        if parts:
            candidates.append(parts[-1])
            if len(parts) >= 2:
                candidates.append(f"{parts[-2]} {parts[-1]}")
        sid: int | None = None
        for cand in candidates:
            c = cand.lower().strip("- ")
            if len(c) < 2:
                continue
            sid = al.get(c)
            if sid is None:
                sid = al.get(re.sub(r"^(al|an|ar|as|ad|at|ash)-", "", c))
            if sid is not None:
                break
        if sid is not None:
            add_key(sid, ay)

    return found


# When Foundation prelive/live Content returns 404 or short lists, public v4 matches api.quran.com.
_PUBLIC_CONTENT_API_V4 = "https://api.quran.com/api/v4"

_client: httpx.AsyncClient | None = None
# Must not share a name with `_oauth_access_token()` — assigning to that global would replace the coroutine.
_oauth_token_cache: str | None = None
_oauth_token_expires_monotonic: float = 0.0
# After token 401/403, skip hitting the OAuth server again for a few minutes (many verse fetches per chat).
_oauth_skip_until_monotonic: float = 0.0


def _content_api_public_fallback_eligible(settings: Settings) -> bool:
    b = (settings.quran_api_base_url or "").strip().rstrip("/").lower()
    return bool(b) and not b.endswith("api.quran.com/api/v4")


def set_http_client(client: httpx.AsyncClient | None) -> None:
    global _client
    _client = client


def _client_or_raise() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("HTTP client not initialized (app lifespan)")
    return _client


async def _oauth_access_token(settings: Settings) -> str | None:
    """Client-credentials token; cached until shortly before expiry."""
    global _oauth_token_cache, _oauth_token_expires_monotonic, _oauth_skip_until_monotonic
    if not (
        settings.quran_oauth_token_url
        and settings.quran_oauth_client_id
        and settings.quran_oauth_client_secret
    ):
        return None

    now = time.monotonic()
    if now < _oauth_skip_until_monotonic:
        return None
    if _oauth_token_cache and now < _oauth_token_expires_monotonic:
        return _oauth_token_cache

    client = _client_or_raise()
    cid = (settings.quran_oauth_client_id or "").strip()
    csec = (settings.quran_oauth_client_secret or "").strip()
    form: dict[str, str] = {"grant_type": "client_credentials"}
    if settings.quran_oauth_scope.strip():
        form["scope"] = settings.quran_oauth_scope.strip()
    elif "quran.foundation" in (settings.quran_oauth_token_url or "").lower():
        # Content API client_credentials requires `content` (see Quran Foundation quickstart).
        form["scope"] = "content"
    # Quran Foundation Hydra expects client_secret_basic (not client_secret_post).
    auth = httpx.BasicAuth(cid, csec) if cid and csec else None

    try:
        r = await client.post(
            settings.quran_oauth_token_url,
            data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            auth=auth,
            timeout=30.0,
        )
        r.raise_for_status()
        body = r.json()
    except httpx.HTTPStatusError as e:
        _oauth_token_cache = None
        # One chat triggers many Quran calls; avoid log spam + hammering the token endpoint.
        if e.response.status_code in (401, 403):
            _oauth_skip_until_monotonic = now + 300.0
            log.warning(
                "Quran OAuth token rejected (%s); using anonymous Content API (e.g. api.quran.com). "
                "Set valid QURAN_OAUTH_CLIENT_ID / QURAN_OAUTH_CLIENT_SECRET, or remove OAuth env vars.",
                e.response.status_code,
            )
        else:
            _oauth_skip_until_monotonic = now + 120.0
            log.warning(
                "Quran OAuth token HTTP %s (continuing without Bearer)",
                e.response.status_code,
            )
        return None
    except Exception as e:
        _oauth_token_cache = None
        _oauth_skip_until_monotonic = now + 120.0
        log.warning("Quran OAuth token request failed: %s (continuing without Bearer)", e)
        return None
    token = body.get("access_token")
    if not token:
        log.error("OAuth token response missing access_token: %s", body)
        return None
    ttl = int(body.get("expires_in", 3600))
    _oauth_token_cache = token
    _oauth_token_expires_monotonic = now + max(ttl - 60, 30)
    _oauth_skip_until_monotonic = 0.0
    return _oauth_token_cache


async def _auth_headers(settings: Settings) -> dict[str, str]:
    h: dict[str, str] = {}
    oauth_token = await _oauth_access_token(settings)
    if oauth_token:
        # Quran Foundation Content APIs (and Reflect read paths) expect these headers.
        cid = (settings.quran_oauth_client_id or "").strip()
        if cid:
            h["x-auth-token"] = oauth_token
            h["x-client-id"] = cid
        # Legacy / transitional hosts may still accept Bearer.
        h["Authorization"] = f"Bearer {oauth_token}"
        return h
    if settings.quran_api_key:
        h["X-API-Key"] = settings.quran_api_key
        h["Authorization"] = f"Bearer {settings.quran_api_key}"
    return h


def _verse_uthmani_and_translation_from_payload(data: dict[str, Any]) -> tuple[str, str]:
    verse = data.get("verse") or {}
    text_uthmani = verse.get("text_uthmani") or verse.get("text") or ""
    trans = ""
    trs = verse.get("translations") or []
    if trs:
        trans = trs[0].get("text") or ""
    return text_uthmani, trans


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
    headers = await _auth_headers(s)
    r = await client.get(url, params=params, headers=headers, timeout=30.0)
    if r.status_code == 404 and _content_api_public_fallback_eligible(s):
        pub = f"{_PUBLIC_CONTENT_API_V4}/verses/by_key/{verse_key}"
        r = await client.get(pub, params=params, headers={}, timeout=30.0)
    r.raise_for_status()
    data: dict[str, Any] = r.json()
    text_uthmani, trans = _verse_uthmani_and_translation_from_payload(data)
    parts = [p for p in (text_uthmani, trans) if p]
    return "\n".join(parts) if parts else ""


async def fetch_verse_uthmani_and_translation(verse_key: str, settings: Settings | None = None) -> tuple[str, str]:
    """Uthmanic Arabic and first translation line for UI + chat metadata."""
    s = settings or get_settings()
    client = _client_or_raise()
    url = f"{s.quran_api_base_url.rstrip('/')}/verses/by_key/{verse_key}"
    params = {
        "language": "en",
        "words": "false",
        "fields": "text_uthmani,text_imlaei,translations",
        "translations": str(s.quran_translation_resource_id),
    }
    headers = await _auth_headers(s)
    r = await client.get(url, params=params, headers=headers, timeout=30.0)
    if r.status_code == 404 and _content_api_public_fallback_eligible(s):
        log.debug(
            "verse by_key 404 on configured base; retrying public api.quran.com for %s",
            verse_key,
        )
        pub = f"{_PUBLIC_CONTENT_API_V4}/verses/by_key/{verse_key}"
        r = await client.get(pub, params=params, headers={}, timeout=30.0)
    r.raise_for_status()
    data: dict[str, Any] = r.json()
    return _verse_uthmani_and_translation_from_payload(data)


async def fetch_tafsir_or_translation(verse_key: str, settings: Settings | None = None) -> str:
    """Fetch translation / commentary text for RAG context (resource id from settings)."""
    s = settings or get_settings()
    client = _client_or_raise()
    url = f"{s.quran_api_base_url.rstrip('/')}/quran/translations/{s.quran_translation_resource_id}"
    params = {"verse_key": verse_key}
    r = await client.get(url, params=params, headers=await _auth_headers(s), timeout=30.0)
    if r.status_code == 404 and _content_api_public_fallback_eligible(s):
        pub = f"{_PUBLIC_CONTENT_API_V4}/quran/translations/{s.quran_translation_resource_id}"
        r = await client.get(pub, params=params, headers={}, timeout=30.0)
    r.raise_for_status()
    data = r.json()
    trs = data.get("translations") or []
    if not trs:
        return ""
    return trs[0].get("text") or ""


async def search_verse_keys(query: str, *, limit: int = 8, settings: Settings | None = None) -> list[str]:
    """
    Deterministic search against the configured Quran Content API (v4 /search).
    Returns unique verse_key strings (e.g. 94:5) in API order.
    """
    q = (query or "").strip()
    if len(q) < 2:
        return []
    lim = max(1, min(limit, 20))
    s = settings or get_settings()
    client = _client_or_raise()
    base = s.quran_api_base_url.rstrip("/")
    url = f"{base}/search"
    params = {"q": q, "size": str(lim)}
    headers = await _auth_headers(s)
    r = await client.get(url, params=params, headers=headers, timeout=30.0)
    # Prelive /search sometimes returns 5xx; public v4 search is stable for RAG grounding.
    if _content_api_public_fallback_eligible(s) and r.status_code in (
        404,
        500,
        502,
        503,
        504,
    ):
        log.debug(
            "Quran search primary returned HTTP %s; retrying %s/search",
            r.status_code,
            _PUBLIC_CONTENT_API_V4,
        )
        r = await client.get(f"{_PUBLIC_CONTENT_API_V4}/search", params=params, headers={}, timeout=30.0)
    r.raise_for_status()
    body = r.json()
    out: list[str] = []
    for item in (body.get("search") or {}).get("results") or []:
        if not isinstance(item, dict):
            continue
        vk = item.get("verse_key")
        if isinstance(vk, str) and _VERSE_KEY_RE.match(vk.strip()) and vk.strip() not in out:
            out.append(vk.strip())
        if len(out) >= lim:
            break
    return out


def _absolute_audio_url(maybe_relative: str, settings: Settings) -> str | None:
    u = (maybe_relative or "").strip()
    if not u:
        return None
    if u.startswith("http://") or u.startswith("https://"):
        return u
    # api.quran.com often returns paths like "Alafasy/mp3/001001.mp3"
    base = "https://verses.quran.com"
    return f"{base.rstrip('/')}/{u.lstrip('/')}"


def _audio_url_from_verse_obj(verse: dict[str, Any], settings: Settings) -> str | None:
    audio = verse.get("audio")
    if isinstance(audio, str):
        return _absolute_audio_url(audio, settings)
    if isinstance(audio, dict):
        for key in ("url", "audio_url", "audioUrl"):
            u = audio.get(key)
            if isinstance(u, str):
                out = _absolute_audio_url(u, settings)
                if out:
                    return out
    if isinstance(audio, list) and audio:
        first = audio[0]
        if isinstance(first, dict):
            u = first.get("url") or first.get("audio_url")
            if isinstance(u, str):
                return _absolute_audio_url(u, settings)
    return None


def _fallback_verse_audio_url(verse_key: str, settings: Settings) -> str | None:
    """Mishari Al-ʿAfāsy per-ayah files on verses.quran.com (works without verse JSON `audio`)."""
    parts = verse_key.strip().split(":")
    if len(parts) != 2:
        return None
    try:
        surah, ayah = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if not (1 <= surah <= 114) or ayah < 1:
        return None
    block = f"{surah:03d}{ayah:03d}"
    tpl = (settings.quran_verse_audio_url_template or "").strip()
    if "{block}" in tpl:
        return tpl.format(block=block)
    return f"https://verses.quran.com/Alafasy/mp3/{block}.mp3"


async def fetch_audio_url(verse_key: str, settings: Settings | None = None) -> str | None:
    """Per-verse recitation URL: upstream `audio` field when present, else public Alafasy CDN template."""
    s = settings or get_settings()
    client = _client_or_raise()
    url = f"{s.quran_api_base_url.rstrip('/')}/verses/by_key/{verse_key}"
    params = {"language": "en", "words": "false", "fields": "audio"}
    try:
        r = await client.get(url, params=params, headers=await _auth_headers(s), timeout=30.0)
        r.raise_for_status()
        data = r.json()
        verse = data.get("verse") or {}
        from_api = _audio_url_from_verse_obj(verse, s)
        if from_api:
            return from_api
    except Exception as e:
        # OAuth misconfiguration or API shape without `audio` — CDN fallback still works.
        log.debug("verse audio API path skipped for %s: %s", verse_key, e)

    fb = _fallback_verse_audio_url(verse_key, s)
    if fb:
        log.debug("using fallback verse audio url for %s", verse_key)
    return fb


def _revelation_label(place: str | None) -> str:
    if not place:
        return ""
    p = place.lower()
    if p == "makkah":
        return "Meccan"
    if p == "madinah":
        return "Medinan"
    return place.replace("_", " ").title()


def _chapter_summary_from_api(ch: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(ch["id"]),
        "name": ch.get("name_arabic") or "",
        "transliteration": ch.get("name_simple") or "",
        "verses": int(ch.get("verses_count") or 0),
        "revelation": _revelation_label(ch.get("revelation_place")),
    }


async def fetch_chapters_catalog(settings: Settings | None = None) -> list[dict[str, Any]]:
    """All 114 surahs (id, Arabic name, English simple name, verse count, revelation)."""
    s = settings or get_settings()
    client = _client_or_raise()
    url = f"{s.quran_api_base_url.rstrip('/')}/chapters?language=en"
    headers = await _auth_headers(s)
    r = await client.get(url, headers=headers, timeout=30.0)
    if r.status_code == 404 and _content_api_public_fallback_eligible(s):
        log.debug("chapters list 404 on configured Content base; using public api.quran.com")
        r = await client.get(f"{_PUBLIC_CONTENT_API_V4}/chapters?language=en", headers={}, timeout=30.0)
    r.raise_for_status()
    data = r.json()
    rows: list[dict[str, Any]] = []
    for ch in data.get("chapters") or []:
        if not isinstance(ch, dict):
            continue
        try:
            rows.append(_chapter_summary_from_api(ch))
        except (KeyError, TypeError, ValueError):
            continue
    rows.sort(key=lambda x: x["id"])
    if len(rows) < 114 and _content_api_public_fallback_eligible(s):
        try:
            r2 = await client.get(f"{_PUBLIC_CONTENT_API_V4}/chapters?language=en", headers={}, timeout=30.0)
            r2.raise_for_status()
            alt: list[dict[str, Any]] = []
            for ch in r2.json().get("chapters") or []:
                if not isinstance(ch, dict):
                    continue
                try:
                    alt.append(_chapter_summary_from_api(ch))
                except (KeyError, TypeError, ValueError):
                    continue
            alt.sort(key=lambda x: x["id"])
            if len(alt) > len(rows):
                rows = alt
        except Exception as e:
            log.debug("chapters catalog public merge skipped: %s", e)
    return rows


async def fetch_chapter_detail(chapter_id: int, settings: Settings | None = None) -> dict[str, Any] | None:
    if chapter_id < 1 or chapter_id > 114:
        return None
    s = settings or get_settings()
    client = _client_or_raise()
    url = f"{s.quran_api_base_url.rstrip('/')}/chapters/{chapter_id}?language=en"
    headers = await _auth_headers(s)
    r = await client.get(url, headers=headers, timeout=30.0)
    if r.status_code == 404 and _content_api_public_fallback_eligible(s):
        log.debug(
            "chapter %s 404 on configured Content base; using public api.quran.com",
            chapter_id,
        )
        r = await client.get(
            f"{_PUBLIC_CONTENT_API_V4}/chapters/{chapter_id}?language=en",
            headers={},
            timeout=30.0,
        )
    r.raise_for_status()
    ch = r.json().get("chapter")
    if not isinstance(ch, dict):
        return None
    try:
        return _chapter_summary_from_api(ch)
    except (KeyError, TypeError, ValueError):
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
