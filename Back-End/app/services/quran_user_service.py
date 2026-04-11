"""Quran Foundation User API: token refresh + activity sync with self-healing 401 retry."""

from __future__ import annotations

import base64
import hashlib
import logging
from typing import Any

import httpx
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


async def refresh_quran_tokens(refresh_token: str, settings: Settings | None = None) -> dict[str, str | None]:
    """POST OAuth2 token with grant_type=refresh_token; returns new access (and refresh if rotated)."""
    s = settings or get_settings()
    token_url = (s.quran_oauth_token_url or "").strip()
    if not token_url:
        raise ValueError("QURAN_OAUTH_TOKEN_URL is not configured for refresh_token flow")
    cid = _effective_client_id(s)
    csec = _effective_client_secret(s)
    if not cid or not csec:
        raise ValueError("QURAN_CLIENT_ID / QURAN_CLIENT_SECRET (or QURAN_OAUTH_*) required for refresh")

    client = _client()
    r = await client.post(
        token_url,
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        auth=httpx.BasicAuth(cid, csec),
        timeout=30.0,
    )
    r.raise_for_status()
    body: dict[str, Any] = r.json()
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

    try:
        client = _client()
        r = await client.post(url, json=activity_data, headers=headers, timeout=30.0)
        if r.status_code == 401 and user_record.quran_refresh_token and not _retry_after_refresh:
            try:
                refreshed = await refresh_quran_tokens(user_record.quran_refresh_token.strip(), settings)
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
        if r.status_code >= 400:
            log.warning(
                "Quran Foundation activity sync HTTP %s: %s",
                r.status_code,
                (r.text or "")[:300],
            )
            return False
        return True
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
