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
from app.services.surah_verse_counts import verse_count_for_surah

log = logging.getLogger(__name__)

# Common user typos / alternates → canonical slug present in surah_name_simple.json keys
_SURAH_NAME_TYPO: dict[str, str] = {
    "iklas": "ikhlas",
    "ikhlass": "ikhlas",
    "ikhlaas": "ikhlas",
    "iklash": "ikhlas",
    "ikhlash": "ikhlas",
    "iklach": "ikhlas",
    "fateha": "fatiha",
    "fatiha": "fatiha",
    "fatehah": "fatiha",
    # JSON uses "Ad-Duhaa"; users often write "Duha"
    "duha": "duhaa",
    "duhaa": "duhaa",
    "dhuha": "duhaa",
    "zuha": "duhaa",
}

_VERSE_KEY_RE = re.compile(r"^\d{1,3}:\d{1,3}$")

# Surah name after "surah …" (no bare `\s` inside a lazy quantifier — it wrongly matched "n " for "surat nas …").
_SURAH_NAME_CAPTURE = r"[a-zA-Z'’\u2019\-]+(?:\s+[a-zA-Z'’\u2019\-]+){0,5}"

_MAX_AYAH_FALLBACK = 286  # safe upper bound for validation before HTTP fetch

# Roman Urdu / English noise after surah name: "surat nas ka turjma" → "nas"
_SURAH_NAME_TRAILING_JUNK = frozenset(
    """
    ka ke ki ko se par mein mai liya leya liye keliye wala walay
    turjma tarjma tarjuma translation meaning mean matlab tafseer tafsir
    batao bataye batayen please plz
    """.split()
)


def _strip_trailing_surah_name_noise(frag: str) -> str:
    parts = [p.strip("'’\u2019.?!,،") for p in re.split(r"\s+", (frag or "").strip()) if p.strip()]
    while parts and parts[-1].lower() in _SURAH_NAME_TRAILING_JUNK:
        parts.pop()
    return " ".join(parts).strip()


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


def _normalize_surah_name_token(token: str) -> str:
    t = re.sub(r"\s+", " ", (token or "").strip().lower())
    t = t.strip("'’\u2019")
    return _SURAH_NAME_TYPO.get(t, t)


def _resolve_name_fragment_to_sid(frag: str, al: dict[str, int]) -> int | None:
    frag = re.sub(r"\s+", " ", frag.strip().lower())
    frag = frag.strip("'’\u2019")
    # "Ad-Duha", "Al-Baqarah" → tokens split on hyphen as well as space
    parts = [p.strip("'’\u2019") for p in re.split(r"[\s\-–]+", frag) if p.strip("'’\u2019")]
    if not parts:
        parts = [frag] if frag else []
    toks = [_normalize_surah_name_token(p) for p in parts]
    rebuilt = " ".join(toks)
    rebuilt_nospace = rebuilt.replace(" ", "")
    rebuilt_hyphen = re.sub(r"\s+", "-", rebuilt.strip())
    candidates: list[str] = [
        rebuilt,
        rebuilt_hyphen,
        rebuilt_nospace,
        frag,
        frag.replace(" ", "-"),
        frag.replace(" ", ""),
    ]
    if toks:
        candidates.append(toks[-1])
        if len(toks) >= 2:
            candidates.append(f"{toks[-2]} {toks[-1]}")
    if parts:
        candidates.append(_normalize_surah_name_token(parts[-1]))
        if len(parts) >= 2:
            candidates.append(f"{parts[-2]} {parts[-1]}")
    seen_c: set[str] = set()
    for cand in candidates:
        c = cand.lower().strip("- ")
        if len(c) < 2 or c in seen_c:
            continue
        seen_c.add(c)
        sid = al.get(c)
        if sid is None:
            sid = al.get(re.sub(r"^(al|an|ar|as|ad|at|ash)-", "", c))
        if sid is not None:
            return sid
    return None


def _expand_surah_to_verse_keys(surah_id: int, max_keys: int) -> list[str]:
    vc = verse_count_for_surah(surah_id) or 1
    n = min(max(1, vc), max(1, max_keys))
    return [f"{surah_id}:{i}" for i in range(1, n + 1)]


def adjacent_verse_keys(verse_key: str) -> list[str]:
    """Prev, center, next in reading order (deduped). Invalid keys return []."""
    vk = (verse_key or "").strip()
    if not _VERSE_KEY_RE.match(vk):
        return []
    parts = vk.split(":")
    surah, ayah = int(parts[0]), int(parts[1])
    if not (1 <= surah <= 114):
        return []
    out: list[str] = []
    if ayah > 1:
        out.append(f"{surah}:{ayah - 1}")
    elif surah > 1:
        prev_vc = verse_count_for_surah(surah - 1) or 1
        out.append(f"{surah - 1}:{prev_vc}")
    out.append(vk)
    vc = verse_count_for_surah(surah) or _MAX_AYAH_FALLBACK
    if ayah < vc:
        out.append(f"{surah}:{ayah + 1}")
    elif surah < 114:
        out.append(f"{surah + 1}:1")
    seen: set[str] = set()
    dedup: list[str] = []
    for k in out:
        if k not in seen:
            seen.add(k)
            dedup.append(k)
    return dedup


def verse_keys_from_natural_language_query(text: str, *, max_keys: int = 8) -> list[str]:
    """
    Resolve explicit surah:ayah references from free text (e.g. 'sura nas ayat 1', '114:1', '2:255')
    without calling /search. Includes surah-only requests (whole surah up to max_keys ayahs).
    """
    t = (text or "").strip()
    if len(t) < 2:
        return []
    cap = max(1, min(int(max_keys), 20))
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

    def extend_surah(surah_id: int) -> None:
        for vk in _expand_surah_to_verse_keys(surah_id, cap):
            if vk not in seen:
                seen.add(vk)
                found.append(vk)

    for m in re.finditer(r"\b(\d{1,3})\s*:\s*(\d{1,3})\b", t):
        add_key(int(m.group(1)), int(m.group(2)))

    # "first ayah of the Quran", "opening verse of qur'an" → 1:1
    if re.search(
        r"\b(?:first|opening|initial)\s+(?:ayat|ayah|verse)\s+(?:of|in)\s+(?:the\s+)?qur\s*'?an\b",
        t,
        re.I,
    ) or re.search(r"\b(?:start|beginning)\s+of\s+(?:the\s+)?qur\s*'?an\b", t, re.I):
        add_key(1, 1)

    num_pat = re.compile(
        r"\b(?:surah|sura|surat|chapter)\s*#?\s*(\d{1,3})\s*[,،]?\s*(?:ayat|ayah|verse|ayet|a\.?)\s*#?\s*(\d{1,3})\b",
        re.I,
    )
    for m in num_pat.finditer(t):
        add_key(int(m.group(1)), int(m.group(2)))

    # Allow commas/pause between name and ayah: "Surah Ad-Duha, ayah 7"
    name_pat = re.compile(
        rf"\b(?:surah|sura|surat|chapter)\s+({_SURAH_NAME_CAPTURE})"
        r"[\s,،]*"
        r"(?:ayat|ayah|verse|ayet)\s*#?\s*(\d{1,3})\b",
        re.I,
    )
    for m in name_pat.finditer(t):
        frag = _strip_trailing_surah_name_noise(re.sub(r"\s+", " ", m.group(1).strip()).strip(" ,،"))
        ay = int(m.group(2))
        sid = _resolve_name_fragment_to_sid(frag, al)
        if sid is not None:
            add_key(sid, ay)

    # "first surah … ayah 5", "Al-Fatihah … ayah 5" without requiring "surah" prefix
    loose_fatiha = re.compile(
        r"\b(?:first\s+surah|1\s*st\s+surah|opening\s+surah)\b.*?\b(?:ayat|ayah|verse|ayet)\s*#?\s*(\d{1,3})\b",
        re.I,
    )
    for m in loose_fatiha.finditer(t):
        add_key(1, int(m.group(1)))
    fatihah_named = re.compile(
        r"\b(?:(?:al[\s-]?)?fatihah|fatiha|al[\s-]?fatiha)\b.*?\b(?:ayat|ayah|verse|ayet)\s*#?\s*(\d{1,3})\b",
        re.I,
    )
    for m in fatihah_named.finditer(t):
        add_key(1, int(m.group(1)))

    if not found:
        surah_only_num = re.compile(
            r"\b(?:surah|sura|surat|chapter)\s+#?(\d{1,3})\b(?!\s*[,،]?\s*(?:ayat|ayah|verse|ayet)\s*#?\s*\d)",
            re.I,
        )
        for m in surah_only_num.finditer(t):
            sid = int(m.group(1))
            if 1 <= sid <= 114:
                extend_surah(sid)
                break

    if not found:
        surah_only_name = re.compile(
            rf"\b(?:surah|sura|surat|chapter)\s+({_SURAH_NAME_CAPTURE})\b"
            r"(?!\s*[,،]?\s*(?:ayat|ayah|verse|ayet)\s*#?\s*\d)",
            re.I,
        )
        for m in surah_only_name.finditer(t):
            frag = _strip_trailing_surah_name_noise(re.sub(r"\s+", " ", m.group(1).strip()))
            sid = _resolve_name_fragment_to_sid(frag, al)
            if sid is not None:
                extend_surah(sid)
                break

    return found[:cap]


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


def _content_language_primary(settings: Settings) -> str:
    return (settings.quran_content_language or "en").strip() or "en"


def _content_language_for_translation(settings: Settings, translation_resource_id: int) -> str:
    """`language` query param for verses/by_key when a specific translation resource is requested."""
    primary = int(settings.quran_translation_resource_id)
    lang = _content_language_primary(settings)
    if int(translation_resource_id) == primary:
        return lang
    sec = (settings.quran_secondary_content_language or "").strip()
    return sec or lang


def _verse_by_key_params(
    settings: Settings,
    *,
    translation_resource_id: int,
    fields: str,
    words: str = "false",
) -> dict[str, str]:
    return {
        "language": _content_language_for_translation(settings, translation_resource_id),
        "words": words,
        "fields": fields,
        "translations": str(translation_resource_id),
    }


def _verse_uthmani_and_translation_from_payload(
    data: dict[str, Any],
    *,
    preferred_translation_resource_id: int | None = None,
) -> tuple[str, str]:
    verse = data.get("verse")
    if not isinstance(verse, dict):
        # Some Content API gateways return verse fields at the top level.
        if isinstance(data.get("text_uthmani"), str) or isinstance(data.get("text"), str):
            verse = data
        else:
            verse = {}
    text_uthmani = verse.get("text_uthmani") or verse.get("text") or ""
    trans = ""
    trs = verse.get("translations") or []
    if trs and isinstance(trs, list):
        want = int(preferred_translation_resource_id) if preferred_translation_resource_id is not None else None
        if want is not None:
            for row in trs:
                if not isinstance(row, dict):
                    continue
                rid = row.get("resource_id")
                try:
                    if rid is not None and int(rid) == want:
                        trans = row.get("text") or ""
                        break
                except (TypeError, ValueError):
                    continue
        if not trans:
            for row in trs:
                if isinstance(row, dict) and row.get("text"):
                    trans = str(row.get("text") or "")
                    break
    return text_uthmani, trans


async def fetch_verse_text(verse_key: str, settings: Settings | None = None) -> str:
    """Return Arabic + simple English text for a verse key (surah:ayah)."""
    s = settings or get_settings()
    client = _client_or_raise()
    url = f"{s.quran_api_base_url.rstrip('/')}/verses/by_key/{verse_key}"
    tr_id = int(s.quran_translation_resource_id)
    params = _verse_by_key_params(
        s,
        translation_resource_id=tr_id,
        fields="text_uthmani,text_imlaei,translations",
    )
    headers = await _auth_headers(s)
    r = await client.get(url, params=params, headers=headers, timeout=30.0)
    if r.status_code == 404 and _content_api_public_fallback_eligible(s):
        pub = f"{_PUBLIC_CONTENT_API_V4}/verses/by_key/{verse_key}"
        r = await client.get(pub, params=params, headers={}, timeout=30.0)
    r.raise_for_status()
    data: dict[str, Any] = r.json()
    text_uthmani, trans = _verse_uthmani_and_translation_from_payload(
        data, preferred_translation_resource_id=tr_id
    )
    parts = [p for p in (text_uthmani, trans) if p]
    return "\n".join(parts) if parts else ""


async def fetch_verse_uthmani_and_translation(
    verse_key: str,
    settings: Settings | None = None,
    *,
    translation_resource_id: int | None = None,
) -> tuple[str, str]:
    """Uthmanic Arabic and first translation line for UI + chat metadata."""
    s = settings or get_settings()
    tr_id = int(translation_resource_id) if translation_resource_id is not None else int(s.quran_translation_resource_id)
    client = _client_or_raise()
    url = f"{s.quran_api_base_url.rstrip('/')}/verses/by_key/{verse_key}"
    params = _verse_by_key_params(
        s,
        translation_resource_id=tr_id,
        fields="text_uthmani,text_imlaei,translations",
    )
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
    return _verse_uthmani_and_translation_from_payload(data, preferred_translation_resource_id=tr_id)


async def fetch_tafsir_or_translation(
    verse_key: str,
    settings: Settings | None = None,
    *,
    translation_resource_id: int | None = None,
) -> str:
    """Fetch translation / commentary text for RAG context (resource id from settings or override)."""
    s = settings or get_settings()
    rid = int(translation_resource_id) if translation_resource_id is not None else int(s.quran_translation_resource_id)
    client = _client_or_raise()
    url = f"{s.quran_api_base_url.rstrip('/')}/quran/translations/{rid}"
    params = {"verse_key": verse_key}
    r = await client.get(url, params=params, headers=await _auth_headers(s), timeout=30.0)
    if r.status_code == 404 and _content_api_public_fallback_eligible(s):
        pub = f"{_PUBLIC_CONTENT_API_V4}/quran/translations/{rid}"
        r = await client.get(pub, params=params, headers={}, timeout=30.0)
    r.raise_for_status()
    data = r.json()
    trs = data.get("translations") or []
    if not trs:
        return ""
    want = rid
    for row in trs:
        if not isinstance(row, dict):
            continue
        try:
            if row.get("resource_id") is not None and int(row["resource_id"]) == want:
                return row.get("text") or ""
        except (TypeError, ValueError):
            continue
    first = trs[0]
    return (first.get("text") or "") if isinstance(first, dict) else ""


def _search_result_dicts(body: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize Content API /search JSON to a list of result objects (Foundation vs public v4)."""
    out: list[dict[str, Any]] = []
    search = body.get("search")
    if isinstance(search, dict):
        raw = search.get("results")
        if isinstance(raw, list):
            out.extend(x for x in raw if isinstance(x, dict))
    if not out:
        raw = body.get("results")
        if isinstance(raw, list):
            out.extend(x for x in raw if isinstance(x, dict))
    return out


def _verse_key_from_search_hit(item: dict[str, Any]) -> str | None:
    vk = item.get("verse_key")
    if isinstance(vk, str):
        s = vk.strip()
        return s if s else None
    verse = item.get("verse")
    if isinstance(verse, dict):
        vk2 = verse.get("verse_key")
        if isinstance(vk2, str):
            s = vk2.strip()
            return s if s else None
    return None


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
    params: dict[str, str] = {"q": q, "size": str(lim)}
    sl = (s.quran_search_language or "").strip()
    if sl:
        params["language"] = sl
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
    for item in _search_result_dicts(body):
        vk = _verse_key_from_search_hit(item)
        if vk and _VERSE_KEY_RE.match(vk) and vk not in out:
            out.append(vk)
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
    params = {
        "language": _content_language_primary(s),
        "words": "false",
        "fields": "audio",
    }
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


def normalize_translation_resource_row(row: dict[str, Any]) -> dict[str, Any] | None:
    """Map upstream translation resource JSON to a stable dict for API responses (or None if invalid)."""
    try:
        tid = int(row.get("id"))
    except (TypeError, ValueError):
        return None
    if tid < 1:
        return None
    return {
        "id": tid,
        "name": str(row.get("name") or "").strip(),
        "author_name": str(row.get("author_name") or "").strip(),
        "language_name": str(row.get("language_name") or "").strip(),
        "slug": str(row.get("slug") or "").strip(),
    }


async def fetch_translation_resources_catalog(
    settings: Settings | None = None,
    *,
    language: str | None = None,
) -> list[dict[str, Any]]:
    """
    List translation editions from Content API GET /resources/translations.
    Optional `language` filters by API language (e.g. ur, en). Returns [] on failure.
    """
    s = settings or get_settings()
    client = _client_or_raise()
    base = s.quran_api_base_url.rstrip("/")
    params: dict[str, str] = {}
    lang = (language or "").strip().lower()[:8]
    if lang:
        params["language"] = lang
    url = f"{base}/resources/translations"
    headers = await _auth_headers(s)
    rows: list[dict[str, Any]] = []

    async def _parse_response(r: httpx.Response) -> list[dict[str, Any]]:
        r.raise_for_status()
        data = r.json()
        out: list[dict[str, Any]] = []
        for row in data.get("translations") or []:
            if not isinstance(row, dict):
                continue
            norm = normalize_translation_resource_row(row)
            if norm:
                out.append(norm)
        out.sort(key=lambda x: (x["language_name"].lower(), x["name"].lower(), x["id"]))
        return out

    try:
        r = await client.get(url, params=params or None, headers=headers, timeout=45.0)
        if r.status_code in (404, 500, 502, 503, 504) and _content_api_public_fallback_eligible(s):
            log.debug("translations catalog HTTP %s on primary; retrying public api.quran.com", r.status_code)
            r = await client.get(
                f"{_PUBLIC_CONTENT_API_V4}/resources/translations",
                params=params or None,
                headers={},
                timeout=45.0,
            )
        rows = await _parse_response(r)
    except Exception as e:
        log.warning("translation resources catalog failed: %s", e)
        return []

    if not rows and _content_api_public_fallback_eligible(s):
        try:
            r2 = await client.get(
                f"{_PUBLIC_CONTENT_API_V4}/resources/translations",
                params=params or None,
                headers={},
                timeout=45.0,
            )
            rows = await _parse_response(r2)
        except Exception as e:
            log.debug("translation resources public fallback skipped: %s", e)

    return rows


async def fetch_chapters_catalog(settings: Settings | None = None) -> list[dict[str, Any]]:
    """All 114 surahs (id, Arabic name, English simple name, verse count, revelation)."""
    s = settings or get_settings()
    client = _client_or_raise()
    lang = _content_language_primary(s)
    url = f"{s.quran_api_base_url.rstrip('/')}/chapters?language={lang}"
    headers = await _auth_headers(s)
    r = await client.get(url, headers=headers, timeout=30.0)
    if r.status_code == 404 and _content_api_public_fallback_eligible(s):
        log.debug("chapters list 404 on configured Content base; using public api.quran.com")
        r = await client.get(f"{_PUBLIC_CONTENT_API_V4}/chapters?language={lang}", headers={}, timeout=30.0)
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
            r2 = await client.get(f"{_PUBLIC_CONTENT_API_V4}/chapters?language={lang}", headers={}, timeout=30.0)
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
    lang = _content_language_primary(s)
    url = f"{s.quran_api_base_url.rstrip('/')}/chapters/{chapter_id}?language={lang}"
    headers = await _auth_headers(s)
    r = await client.get(url, headers=headers, timeout=30.0)
    if r.status_code == 404 and _content_api_public_fallback_eligible(s):
        log.debug(
            "chapter %s 404 on configured Content base; using public api.quran.com",
            chapter_id,
        )
        r = await client.get(
            f"{_PUBLIC_CONTENT_API_V4}/chapters/{chapter_id}?language={lang}",
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
