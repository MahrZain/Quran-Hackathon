"""Versioned HTTP API under /api/v1 (composed sub-routers)."""

from __future__ import annotations

from fastapi import APIRouter

from . import bookmarks, chat, history_routes, quran_proxy, streak

router = APIRouter(prefix="/api/v1")
router.include_router(chat.router)
router.include_router(streak.router)
router.include_router(quran_proxy.router)
router.include_router(history_routes.router)
router.include_router(bookmarks.router)

__all__ = ["router"]
