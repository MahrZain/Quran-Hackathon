"""Password hashing and JWT create/decode."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings


def hash_password(plain: str) -> str:
    raw = plain[:72].encode("utf-8")
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain[:72].encode("utf-8"), hashed.encode("ascii"))
    except ValueError:
        return False


def create_access_token(*, subject: str, extra: dict[str, Any] | None = None) -> tuple[str, int]:
    """Return (jwt, expires_in_seconds)."""
    s = get_settings()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=s.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra:
        payload.update(extra)
    token = jwt.encode(payload, s.jwt_secret_key, algorithm=s.jwt_algorithm)
    expires_in = int((expire - now).total_seconds())
    return token, expires_in


def decode_access_token(token: str) -> dict[str, Any]:
    s = get_settings()
    return jwt.decode(token, s.jwt_secret_key, algorithms=[s.jwt_algorithm])
