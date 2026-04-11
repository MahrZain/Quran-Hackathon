"""JWT auth: demo session, Quran Foundation OAuth, and current user."""

from __future__ import annotations

import hashlib
import logging
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Annotated

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.models.domain import User
from app.models.schemas import TokenResponse, UserMe
from app.services import quran_service, quran_user_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def ensure_demo_account_ready(db: Session) -> None:
    """When demo login is enabled, ensure the shared demo user row exists."""
    s = get_settings()
    if not s.enable_demo_login or not s.demo_user_password or len(s.demo_user_password) < 8:
        return
    _ensure_demo_user(db)


def _pkce_cookie_value(verifier: str, state: str) -> str:
    s = get_settings()
    exp = int((datetime.now(timezone.utc) + timedelta(minutes=10)).timestamp())
    return jwt.encode(
        {"v": verifier, "st": state, "typ": "pkce", "exp": exp},
        s.jwt_secret_key,
        algorithm=s.jwt_algorithm,
    )


def _decode_pkce_cookie(raw: str) -> dict:
    s = get_settings()
    return jwt.decode(raw, s.jwt_secret_key, algorithms=[s.jwt_algorithm])


def _ensure_demo_user(db: Session) -> User:
    s = get_settings()
    email = s.demo_user_email.strip().lower()
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    desired_hash = hash_password(s.demo_user_password)
    if user is None:
        user = User(email=email, password_hash=desired_hash)
        db.add(user)
        db.commit()
        db.refresh(user)
        log.info("auth_demo_user_created user_id=%s email=%s", user.id, email)
        return user
    if not verify_password(s.demo_user_password, user.password_hash):
        user.password_hash = desired_hash
        db.commit()
        db.refresh(user)
        log.info("auth_demo_user_password_synced user_id=%s email=%s", user.id, email)
    return user


async def _hydrate_demo_user_quran_tokens(db: Session, user: User, s: Settings) -> None:
    """
    Prefer a live OAuth refresh so the demo row gets a fresh access token; fall back to static .env values.
    While the app runs, streak sync also refreshes on 401 (quran_user_service.sync_activity_to_quran_foundation).
    """
    ref_env = s.demo_quran_refresh_token.strip()
    acc_env = s.demo_quran_access_token.strip()
    db_refresh = (user.quran_refresh_token or "").strip()

    async def try_refresh(rt: str, source: str) -> bool:
        try:
            refreshed = await quran_user_service.refresh_quran_tokens(rt, s)
        except Exception as e:
            log.warning("demo Quran token refresh failed (%s): %s", source, e)
            return False
        user.quran_access_token = refreshed["access_token"]
        if refreshed.get("refresh_token"):
            user.quran_refresh_token = str(refreshed["refresh_token"])
        return True

    if ref_env and await try_refresh(ref_env, "DEMO_QURAN_REFRESH_TOKEN"):
        db.add(user)
        db.commit()
        db.refresh(user)
        return

    if not ref_env and db_refresh and await try_refresh(db_refresh, "stored_user_refresh"):
        db.add(user)
        db.commit()
        db.refresh(user)
        return

    if ref_env and db_refresh and db_refresh != ref_env and await try_refresh(db_refresh, "stored_user_after_env_fail"):
        db.add(user)
        db.commit()
        db.refresh(user)
        return

    if acc_env:
        user.quran_access_token = acc_env
    if ref_env:
        user.quran_refresh_token = ref_env
    db.add(user)
    db.commit()
    db.refresh(user)


@router.post("/demo", response_model=TokenResponse)
async def demo_login(db: Session = Depends(get_db)) -> TokenResponse:
    """Issue a JWT for the shared demo user (no request body). Disabled when ENABLE_DEMO_LOGIN=false."""
    s = get_settings()
    if not s.enable_demo_login:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo login is disabled")
    if not s.demo_user_password or len(s.demo_user_password) < 8:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Demo login is not configured")

    user = _ensure_demo_user(db)
    await _hydrate_demo_user_quran_tokens(db, user, s)
    token, expires_in = create_access_token(subject=str(user.id), extra={"email": user.email})
    log.info("auth_demo_login_success user_id=%s email=%s", user.id, user.email)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.get("/quran/start")
def quran_oauth_start() -> RedirectResponse:
    """Redirect browser to Quran Foundation hosted login (PKCE)."""
    s = get_settings()
    cid = (s.quran_client_id or s.quran_oauth_client_id or "").strip()
    if not cid:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="QURAN_CLIENT_ID (or QURAN_OAUTH_CLIENT_ID) is not configured",
        )
    verifier = secrets.token_urlsafe(48)
    state = secrets.token_urlsafe(32)
    challenge = quran_user_service.pkce_challenge_from_verifier(verifier)
    auth_url = quran_user_service.oauth_authorize_endpoint(s)
    redirect_uri = s.quran_oauth_redirect_uri.strip()
    # streak alone does not cover POST …/auth/v1/activity-days — see Activity Days scopes:
    # https://api-docs.quran.foundation/docs/user_related_apis_versioned/scopes/
    scope = "openid offline_access user streak activity_day activity_day.create"
    qs = urllib.parse.urlencode(
        {
            "response_type": "code",
            "client_id": cid,
            "redirect_uri": redirect_uri,
            "scope": scope,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )
    dest = f"{auth_url}?{qs}"
    ret = RedirectResponse(url=dest, status_code=status.HTTP_302_FOUND)
    ret.set_cookie(
        "asar_oauth_pkce",
        _pkce_cookie_value(verifier, state),
        max_age=600,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return ret


@router.get("/callback")
async def quran_oauth_callback(
    request: Request,
    code: str = "",
    state: str = "",
    error: str = "",
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """OAuth redirect target: exchange code, store Quran tokens on user, issue ASAR JWT."""
    s = get_settings()
    front_base = s.frontend_after_oauth_url.strip().rstrip("/")
    oauth_front = f"{front_base}/welcome/oauth"

    if error:
        log.warning("Quran OAuth callback error param: %s", error)
        return RedirectResponse(url=f"{oauth_front}#oauth_error={urllib.parse.quote(error)}")

    raw_cookie = request.cookies.get("asar_oauth_pkce")
    try:
        payload = _decode_pkce_cookie(raw_cookie)
    except Exception:
        log.warning("Quran OAuth callback: invalid or missing PKCE cookie")
        return RedirectResponse(url=f"{oauth_front}#oauth_error=invalid_pkce")

    if payload.get("typ") != "pkce" or payload.get("st") != state:
        log.warning("Quran OAuth callback: state mismatch")
        return RedirectResponse(url=f"{oauth_front}#oauth_error=state_mismatch")

    verifier = payload.get("v")
    if not isinstance(verifier, str) or not verifier:
        return RedirectResponse(url=f"{oauth_front}#oauth_error=missing_verifier")

    token_url = (s.quran_oauth_token_url or "").strip()
    if not token_url:
        return RedirectResponse(url=f"{oauth_front}#oauth_error=no_token_url")

    cid = (s.quran_client_id or s.quran_oauth_client_id or "").strip()
    csec = (s.quran_client_secret or s.quran_oauth_client_secret or "").strip()
    if not cid or not csec:
        return RedirectResponse(url=f"{oauth_front}#oauth_error=no_client_credentials")

    client = quran_service._client_or_raise()
    try:
        tr = await client.post(
            token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": s.quran_oauth_redirect_uri.strip(),
                "code_verifier": verifier,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            auth=httpx.BasicAuth(cid, csec),
            timeout=30.0,
        )
        tr.raise_for_status()
        body = tr.json()
    except httpx.HTTPStatusError as e:
        log.warning("Quran OAuth code exchange failed: %s %s", e.response.status_code, e.response.text[:200])
        return RedirectResponse(url=f"{oauth_front}#oauth_error=token_exchange")
    except Exception as e:
        log.warning("Quran OAuth code exchange error: %s", e)
        return RedirectResponse(url=f"{oauth_front}#oauth_error=exchange")

    access = body.get("access_token")
    refresh = body.get("refresh_token")
    id_token = body.get("id_token")
    if not access or not isinstance(access, str):
        return RedirectResponse(url=f"{oauth_front}#oauth_error=no_access_token")

    email = ""
    if isinstance(id_token, str) and id_token:
        try:
            claims = jwt.decode(id_token, options={"verify_signature": False})
            email = (claims.get("email") or "").strip().lower()
            sub = claims.get("sub")
            if not email and sub:
                h = hashlib.sha256(str(sub).encode("utf-8")).hexdigest()[:28]
                email = f"qf-{h}@oauth.asar.local"
        except Exception:
            email = ""

    if not email:
        email = f"quran-oauth-{secrets.token_hex(6)}@oauth.asar.local"

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        user = User(email=email, password_hash=hash_password(secrets.token_urlsafe(32)))
        db.add(user)
        db.commit()
        db.refresh(user)

    user.quran_access_token = access
    if isinstance(refresh, str) and refresh:
        user.quran_refresh_token = refresh
    db.add(user)
    db.commit()
    db.refresh(user)

    asar_jwt, expires_in = create_access_token(subject=str(user.id), extra={"email": user.email})
    log.info("quran_oauth_callback_success user_id=%s email=%s expires_in=%s", user.id, user.email, expires_in)

    ret = RedirectResponse(
        url=f"{oauth_front}#asar_token={urllib.parse.quote(asar_jwt, safe='')}&expires_in={expires_in}",
        status_code=status.HTTP_302_FOUND,
    )
    ret.delete_cookie("asar_oauth_pkce", path="/")
    return ret


@router.get("/me", response_model=UserMe)
def me(user: Annotated[User, Depends(get_current_user)]) -> UserMe:
    return UserMe.model_validate(user)
