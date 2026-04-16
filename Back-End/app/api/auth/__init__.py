"""Auth API: demo JWT, Quran OAuth, and `/me` profile routes (mounted at `/api/v1/auth`)."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.auth import demo, oauth, profile
from app.api.auth.demo import ensure_demo_account_ready

router = APIRouter(prefix="/auth", tags=["auth"])
router.include_router(demo.router)
router.include_router(oauth.router)
router.include_router(profile.router)

__all__ = ["router", "ensure_demo_account_ready"]
