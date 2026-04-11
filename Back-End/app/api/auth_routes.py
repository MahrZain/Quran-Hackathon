"""JWT registration, login, and current user."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.models.domain import User
from app.models.schemas import TokenResponse, UserLogin, UserMe, UserRegister

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.strip().lower()
    exists = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token, expires_in = create_access_token(subject=str(user.id), extra={"email": user.email})
    log.info("user registered id=%s email=%s", user.id, email)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.strip().lower()
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    token, expires_in = create_access_token(subject=str(user.id), extra={"email": user.email})
    log.info("user login id=%s email=%s", user.id, email)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.get("/me", response_model=UserMe)
def me(user: Annotated[User, Depends(get_current_user)]) -> UserMe:
    return UserMe.model_validate(user)
