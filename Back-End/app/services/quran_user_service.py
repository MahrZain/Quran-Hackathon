"""Quran Foundation User API: token refresh + activity sync with self-healing 401 retry."""

from __future__ import annotations

import base64
import hashlib
import logging
from datetime import date, datetime, timezone
from typing import Any, Literal

import httpx
import jwt
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.domain import User
from app.services import quran_service

log = logging.getLogger(__name__)


def _client() -> httpx.AsyncClient:
    return quran_service._client_or_raise()


def _effective_client_id(settings: Settings) -> str:
    return (settings.quran_client_id or settings.quran_oauth_client_id or "").strip()


def _effective_client_secret(settings: Settings) -> str:
    return (settings.quran_client_secret or settings.quran_oauth_client_secret or "").strip()


def classify_quran_access_token(access: str, *, leeway_sec: int = 120) -> Literal["fresh", "expired", "unknown"]:
    """
    Inspect Bearer token without verifying signature (Foundation access tokens are JWTs).
    unknown = missing, opaque, or no exp — caller may still try refresh or use as-is.
    """
    t = (access or "").strip()
    if not t or t.count(".") != 2:
        return "unknown"
    try:
        claims = jwt.decode(t, options={"verify_signature": False, "verify_exp": False})
        exp = claims.get("exp")
        if exp is None:
            return "unknown"
        now = datetime.now(timezone.utc).timestamp()
        if float(exp) > now + leeway_sec:
            return "fresh"
        return "expired"
    except Exception:
        return "unknown"


def _log_refresh_http_error(resp: httpx.Response, client_id: str) -> None:
    prefix = f"{client_id[:10]}…" if len(client_id) > 10 else (client_id or "?")
    try:
        body = resp.json()
    except Exception:
        body = (resp.text or "")[:400]
    log.warning(
        "Quran OAuth refresh_token grant HTTP %s (client_id=%s): %s",
        resp.status_code,
        prefix,
        body,
    )


async def refresh_quran_tokens(refresh_token: str, settings: Settings | None = None) -> dict[str, str | None]:
    """
    POST OAuth2 token with grant_type=refresh_token; returns new access (and refresh if rotated).
    Retries once with QURAN_OAUTH_AUTHORIZE_SCOPES when the first attempt returns 400/401 (Hydra / some IdPs).
    """
    s = settings or get_settings()
    token_url = (s.quran_oauth_token_url or "").strip()
    if not token_url:
        raise ValueError("QURAN_OAUTH_TOKEN_URL is not configured for refresh_token flow")
    cid = _effective_client_id(s)
    csec = _effective_client_secret(s)
    if not cid or not csec:
        raise ValueError("QURAN_CLIENT_ID / QURAN_CLIENT_SECRET (or QURAN_OAUTH_*) required for refresh")

    client = _client()
    scope = (s.quran_oauth_authorize_scopes or "").strip()
    base_form: dict[str, str] = {"grant_type": "refresh_token", "refresh_token": refresh_token}
    forms: list[dict[str, str]] = [base_form]
    if scope:
        forms.insert(0, {**base_form, "scope": scope})

    last: httpx.Response | None = None
    for i, data in enumerate(forms):
        last = await client.post(
            token_url,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            auth=httpx.BasicAuth(cid, csec),
            timeout=30.0,
        )
        if last.status_code == 200:
            break
        if last.status_code in (400, 401) and i < len(forms) - 1:
            log.debug(
                "Quran OAuth refresh attempt %s/%s HTTP %s; retrying alternate token request body",
                i + 1,
                len(forms),
                last.status_code,
            )
            continue
        _log_refresh_http_error(last, cid)
        last.raise_for_status()

    assert last is not None and last.status_code == 200
    body: dict[str, Any] = last.json()
    access = body.get("access_token")
    if not access or not isinstance(access, str):
        raise ValueError("refresh_token response missing access_token")
    new_refresh = body.get("refresh_token")
    return {
        "access_token": access,
        "refresh_token": new_refresh if isinstance(new_refresh, str) else None,
    }


def _activity_post_url(settings: Settings) -> str | None:
    if settings.quran_activity_sync_post_url.strip():
        return settings.quran_activity_sync_post_url.strip()
    base = settings.quran_user_api_base_url.strip().rstrip("/")
    if not base:
        return None
    return f"{base}/auth/v1/activity-days"


def build_activity_day_quran_payload(
    verse_key: str,
    activity_date: date,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """
    Request body for POST /auth/v1/activity-days (type=QURAN) per Quran Foundation User API docs.
    https://api-docs.quran.foundation/docs/user_related_apis_versioned/add-update-activity-day/
    """
    s = settings or get_settings()
    vk = (verse_key or "").strip()
    if not vk or ":" not in vk:
        raise ValueError("verse_key must look like surah:ayah (e.g. 94:5)")
    rng = f"{vk}-{vk}"
    sec = max(1, int(s.quran_activity_seconds_default))
    mid = int(s.quran_activity_mushaf_id)
    return {
        "type": "QURAN",
        "seconds": sec,
        "ranges": [rng],
        "mushafId": mid,
        "date": activity_date.isoformat(),
    }


async def sync_activity_to_quran_foundation(
    db_session: Session,
    user_record: User,
    activity_data: dict[str, Any],
    *,
    _retry_after_refresh: bool = False,
) -> bool:
    """
    POST reading activity to Quran Foundation User API.
    On 401: refresh tokens once, persist, retry once; otherwise log and return False.
    """
    settings = get_settings()
    token = (user_record.quran_access_token or "").strip()
    if not token:
        return False

    url = _activity_post_url(settings)
    if not url:
        log.warning("Quran activity sync skipped: no QURAN_ACTIVITY_SYNC_POST_URL or user API base")
        return False

    cid = _effective_client_id(settings)
    headers: dict[str, str] = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if cid:
        headers["x-auth-token"] = token
        headers["x-client-id"] = cid
    tz = (settings.quran_activity_timezone or "").strip() or "Etc/UTC"
    headers["x-timezone"] = tz

    try:
        client = _client()
        r = await client.post(url, json=activity_data, headers=headers, timeout=30.0)
        if r.status_code == 401 and user_record.quran_refresh_token and not _retry_after_refresh:
            try:
                refreshed = await refresh_quran_tokens(user_record.quran_refresh_token.strip(), settings)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    log.info(
                        "Quran activity: refresh token rejected (401) after upstream 401 — update user Quran tokens "
                        "(e.g. re-login or fetch_demo_quran_tokens_cli for demo)."
                    )
                else:
                    log.warning("Quran token refresh failed after 401: %s", e)
                return False
            except Exception as e:
                log.warning("Quran token refresh failed after 401: %s", e)
                return False
            user_record.quran_access_token = refreshed["access_token"]
            if refreshed.get("refresh_token"):
                user_record.quran_refresh_token = str(refreshed["refresh_token"])
            db_session.add(user_record)
            db_session.commit()
            db_session.refresh(user_record)
            return await sync_activity_to_quran_foundation(
                db_session, user_record, activity_data, _retry_after_refresh=True
            )
        if r.status_code == 200:
            try:
                body = r.json()
                if isinstance(body, dict) and body.get("success") is False:
                    log.warning("Quran activity sync returned 200 with success=false: %s", body)
                    return False
            except Exception:
                pass
            return True
        if r.status_code >= 400:
            if r.status_code == 403 and "insufficient_scope" in (r.text or ""):
                log.warning(
                    "Quran activity sync 403 insufficient_scope — the access token is missing OAuth scopes "
                    "required for POST /auth/v1/activity-days. Per User APIs quickstart, include `streak` "
                    "(reading streaks) in QURAN_OAUTH_AUTHORIZE_SCOPES, re-authorize the user, then try again. "
                    "Docs: https://api-docs.quran.foundation/docs/tutorials/oidc/user-apis-quickstart/ "
                    "If scopes are correct, ask Quran Foundation to confirm your Request Access client is "
                    "allowed to write activity days."
                )
            else:
                log.warning(
                    "Quran Foundation activity sync HTTP %s: %s",
                    r.status_code,
                    (r.text or "")[:300],
                )
            return False
    except httpx.HTTPError as e:
        log.warning("Quran Foundation activity sync request failed: %s", e)
        return False
    except Exception as e:
        log.warning("Quran Foundation activity sync unexpected error: %s", e)
        return False


def oauth_authorize_endpoint(settings: Settings) -> str:
    if settings.quran_oauth_authorize_url.strip():
        return settings.quran_oauth_authorize_url.strip()
    tu = (settings.quran_oauth_token_url or "").strip().rstrip("/")
    if tu.endswith("/oauth2/token"):
        # …/oauth2/token → …/oauth2/auth (must keep the slash before "auth")
        return tu[: -len("token")] + "auth"
    return "https://prelive-oauth2.quran.foundation/oauth2/auth"


def pkce_challenge_from_verifier(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def _bookmarks_collection_url(settings: Settings) -> str | None:
    u = (settings.quran_bookmarks_url or "").strip()
    if u:
        return u.rstrip("/")
    base = (settings.quran_user_api_base_url or "").strip().rstrip("/")
    if not base:
        return None
    return f"{base}/auth/v1/bookmarks"


def _user_api_request_headers(settings: Settings, access_token: str) -> dict[str, str]:
    """Headers for Quran Foundation User API (bookmarks, activity, etc.)."""
    cid = _effective_client_id(settings)
    headers: dict[str, str] = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    if cid:
        headers["x-auth-token"] = access_token
        headers["x-client-id"] = cid
    tz = (settings.quran_activity_timezone or "").strip() or "Etc/UTC"
    headers["x-timezone"] = tz
    return headers


def _extract_bookmark_remote_id(data: Any) -> str | None:
    if not isinstance(data, dict):
        return None
    for key in ("id", "bookmarkId", "bookmark_id"):
        v = data.get(key)
        if v is not None and str(v).strip():
            return str(v)
    nested = data.get("data")
    if isinstance(nested, dict):
        return _extract_bookmark_remote_id(nested)
    bm = data.get("bookmark")
    if isinstance(bm, dict):
        return _extract_bookmark_remote_id(bm)
    return None


def _bookmark_create_payload(verse_key: str, settings: Settings) -> dict[str, Any]:
    """Body for POST /auth/v1/bookmarks (camelCase per User API examples)."""
    vk = (verse_key or "").strip()
    mid = int(settings.quran_activity_mushaf_id)
    return {"verseKey": vk, "mushafId": mid}


async def create_bookmark_on_quran_foundation(
    db_session: Session,
    user_record: User,
    verse_key: str,
    *,
    _retry_after_refresh: bool = False,
) -> tuple[bool, str | None]:
    """
    POST bookmark to Quran Foundation User API.
    Returns (success, remote_id if returned by upstream).
    """
    settings = get_settings()
    token = (user_record.quran_access_token or "").strip()
    if not token:
        return False, None

    url = _bookmarks_collection_url(settings)
    if not url:
        log.warning("Quran bookmark create skipped: no bookmarks URL / user API base")
        return False, None

    headers = _user_api_request_headers(settings, token)
    payload = _bookmark_create_payload(verse_key, settings)

    try:
        client = _client()
        r = await client.post(url, json=payload, headers=headers, timeout=30.0)
        if r.status_code == 401 and user_record.quran_refresh_token and not _retry_after_refresh:
            try:
                refreshed = await refresh_quran_tokens(user_record.quran_refresh_token.strip(), settings)
            except Exception as e:
                log.warning("Quran bookmark: token refresh failed after 401: %s", e)
                return False, None
            user_record.quran_access_token = refreshed["access_token"]
            if refreshed.get("refresh_token"):
                user_record.quran_refresh_token = str(refreshed["refresh_token"])
            db_session.add(user_record)
            db_session.commit()
            db_session.refresh(user_record)
            return await create_bookmark_on_quran_foundation(
                db_session, user_record, verse_key, _retry_after_refresh=True
            )
        if r.status_code in (200, 201):
            try:
                body = r.json()
            except Exception:
                body = {}
            if isinstance(body, dict) and body.get("success") is False:
                log.warning("Quran bookmark create returned success=false: %s", body)
                return False, None
            rid = _extract_bookmark_remote_id(body) if isinstance(body, dict) else None
            return True, rid
        if r.status_code >= 400:
            if r.status_code == 403 and "insufficient_scope" in (r.text or ""):
                log.warning(
                    "Quran bookmark 403 insufficient_scope — add `bookmark` to QURAN_OAUTH_AUTHORIZE_SCOPES "
                    "and re-authorize. Response: %s",
                    (r.text or "")[:400],
                )
            else:
                log.warning(
                    "Quran bookmark create HTTP %s: %s",
                    r.status_code,
                    (r.text or "")[:400],
                )
            return False, None
    except httpx.HTTPError as e:
        log.warning("Quran bookmark create request failed: %s", e)
        return False, None
    except Exception as e:
        log.warning("Quran bookmark create unexpected error: %s", e)
        return False, None


async def delete_bookmark_on_quran_foundation(
    db_session: Session,
    user_record: User,
    remote_id: str,
    *,
    _retry_after_refresh: bool = False,
) -> bool:
    rid = (remote_id or "").strip()
    if not rid:
        return False

    settings = get_settings()
    token = (user_record.quran_access_token or "").strip()
    if not token:
        return False

    base = _bookmarks_collection_url(settings)
    if not base:
        log.warning("Quran bookmark delete skipped: no bookmarks URL / user API base")
        return False

    url = f"{base}/{rid}"
    headers = _user_api_request_headers(settings, token)
    headers.pop("Content-Type", None)

    try:
        client = _client()
        r = await client.delete(url, headers=headers, timeout=30.0)
        if r.status_code == 401 and user_record.quran_refresh_token and not _retry_after_refresh:
            try:
                refreshed = await refresh_quran_tokens(user_record.quran_refresh_token.strip(), settings)
            except Exception as e:
                log.warning("Quran bookmark delete: token refresh failed after 401: %s", e)
                return False
            user_record.quran_access_token = refreshed["access_token"]
            if refreshed.get("refresh_token"):
                user_record.quran_refresh_token = str(refreshed["refresh_token"])
            db_session.add(user_record)
            db_session.commit()
            db_session.refresh(user_record)
            return await delete_bookmark_on_quran_foundation(
                db_session, user_record, remote_id, _retry_after_refresh=True
            )
        if r.status_code in (200, 204):
            return True
        if r.status_code == 404:
            log.info("Quran bookmark delete: remote id not found (404), treating as ok")
            return True
        if r.status_code >= 400:
            if r.status_code == 403 and "insufficient_scope" in (r.text or ""):
                log.warning(
                    "Quran bookmark delete 403 insufficient_scope — add `bookmark` scope and re-authorize."
                )
            else:
                log.warning(
                    "Quran bookmark delete HTTP %s: %s",
                    r.status_code,
                    (r.text or "")[:400],
                )
            return False
    except httpx.HTTPError as e:
        log.warning("Quran bookmark delete request failed: %s", e)
        return False
    except Exception as e:
        log.warning("Quran bookmark delete unexpected error: %s", e)
        return False
