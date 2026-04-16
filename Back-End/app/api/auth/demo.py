"""Demo JWT login and shared demo user row for lifespan."""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.models.domain import User
from app.models.schemas import TokenResponse
from app.services import quran_user_service

log = logging.getLogger(__name__)

router = APIRouter()


def ensure_demo_account_ready(db: Session) -> None:
    """When demo login is enabled, ensure the shared demo user row exists."""
    s = get_settings()
    if not s.enable_demo_login or not s.demo_user_password or len(s.demo_user_password) < 8:
        return
    _ensure_demo_user(db)


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
    If DEMO_QURAN_ACCESS_TOKEN is a JWT that is not yet expired, skip calling Hydra (avoids noisy 400s and
    keeps demo login working while refresh tokens are rotated on prelive).
    401 on refresh is expected when DEMO_QURAN_REFRESH_TOKEN is rotated or revoked on prelive — we then copy .env.
    While the app runs, streak sync also refreshes on 401 (quran_user_service.sync_activity_to_quran_foundation).
    """
    ref_env = s.demo_quran_refresh_token.strip()
    acc_env = s.demo_quran_access_token.strip()
    acc_state = quran_user_service.classify_quran_access_token(acc_env)
    db_refresh = (user.quran_refresh_token or "").strip()
    live_refresh_ok = False

    if acc_env and acc_state == "fresh":
        user.quran_access_token = acc_env
        if ref_env:
            user.quran_refresh_token = ref_env
        db.add(user)
        db.commit()
        db.refresh(user)
        log.info("demo user Quran tokens: DEMO_QURAN_ACCESS_TOKEN still valid (JWT); skipped OAuth refresh.")
        return

    async def try_refresh(rt: str, source: str) -> bool:
        nonlocal live_refresh_ok
        if not rt:
            return False
        try:
            refreshed = await quran_user_service.refresh_quran_tokens(rt, s)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                log.info(
                    "demo Quran OAuth refresh 401 (%s) — token rejected; will fall back to DEMO_QURAN_* in .env if set.",
                    source,
                )
            else:
                log.warning("demo Quran token refresh HTTP error (%s): %s", source, e)
            return False
        except Exception as e:
            log.warning("demo Quran token refresh failed (%s): %s", source, e)
            return False
        user.quran_access_token = refreshed["access_token"]
        if refreshed.get("refresh_token"):
            user.quran_refresh_token = str(refreshed["refresh_token"])
        live_refresh_ok = True
        return True

    if ref_env and await try_refresh(ref_env, "DEMO_QURAN_REFRESH_TOKEN"):
        db.add(user)
        db.commit()
        db.refresh(user)
        log.info("demo user Quran tokens renewed via OAuth refresh (DEMO_QURAN_REFRESH_TOKEN).")
        return

    if not ref_env and db_refresh and await try_refresh(db_refresh, "demo_user_db_refresh"):
        db.add(user)
        db.commit()
        db.refresh(user)
        log.info("demo user Quran tokens renewed via OAuth refresh (stored DB refresh token).")
        return

    if ref_env and db_refresh and db_refresh != ref_env and await try_refresh(db_refresh, "demo_user_db_refresh_after_env"):
        db.add(user)
        db.commit()
        db.refresh(user)
        log.info("demo user Quran tokens renewed via OAuth refresh (DB refresh differed from env).")
        return

    if acc_env:
        user.quran_access_token = acc_env
    if ref_env:
        user.quran_refresh_token = ref_env
    db.add(user)
    db.commit()
    db.refresh(user)
    if not live_refresh_ok and (acc_env or ref_env):
        if acc_state == "expired":
            log.warning(
                "demo user: DEMO_QURAN_ACCESS_TOKEN is an expired JWT and Hydra refresh did not succeed — "
                "Quran activity sync may fail. Use the same QURAN_CLIENT_ID / QURAN_CLIENT_SECRET that issued "
                "DEMO_QURAN_REFRESH_TOKEN, widen QURAN_OAUTH_AUTHORIZE_SCOPES if you see insufficient_scope, then run "
                "python scripts/fetch_demo_quran_tokens_cli.py or sign in again."
            )
        else:
            log.info(
                "demo user Quran tokens applied from DEMO_QURAN_ACCESS_TOKEN / DEMO_QURAN_REFRESH_TOKEN in .env "
                "(live refresh did not run). After prelive rotation, run: python scripts/fetch_demo_quran_tokens_cli.py"
            )


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
