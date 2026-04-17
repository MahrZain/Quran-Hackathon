from contextlib import asynccontextmanager
import logging

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI

from app.api.auth import ensure_demo_account_ready, router as auth_router
from app.api.auth.oauth import quran_oauth_callback as quran_oauth_callback_handler
from app.api.routes import router
from app.core.config import get_settings
from app.core.logging_config import setup_logging
from app.db.database import SessionLocal
from app.services import ai_service, quran_service

setup_logging()
log = logging.getLogger(__name__)


def _cors_allow_origins() -> list[str]:
    s = get_settings()
    raw = (s.cors_origins or "").strip()
    if raw:
        return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if len(settings.jwt_secret_key) < 24 or "change-me" in settings.jwt_secret_key.lower():
        log.warning(
            "JWT_SECRET_KEY is short or looks like a placeholder — use a long random secret in .env for production"
        )
    client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0),
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=30),
    )
    quran_service.set_http_client(client)
    oa = AsyncOpenAI(
        api_key=settings.longcat_api_key or "missing-longcat-key",
        base_url=settings.longcat_base_url,
    )
    ai_service.set_openai_client(oa)
    with SessionLocal() as db:
        ensure_demo_account_ready(db)
    if (settings.quran_oauth_client_id or settings.quran_client_id) and (
        settings.quran_oauth_redirect_uri or ""
    ).strip():
        log.info(
            "Quran OAuth: register this exact redirect_uri in your Foundation client — %s "
            "(GET /api/v1/auth/quran/redirect-uri-hint for JSON)",
            (settings.quran_oauth_redirect_uri or "").strip(),
        )
    log.info("ASAR Engine started — HTTP + AI clients ready")
    yield
    log.info("ASAR Engine shutting down")
    ai_service.set_openai_client(None)
    quran_service.set_http_client(None)
    await client.aclose()


app = FastAPI(title="ASAR Engine", version="1.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe — no DB or external calls (12-factor disposability)."""
    return {"status": "ok"}


# Quran Foundation OAuth callback at root path (same pattern as official web example `…/callback`).
# Register http://localhost:8000/callback in your OAuth client; /api/v1/auth/callback remains valid too.
app.add_api_route("/callback", quran_oauth_callback_handler, methods=["GET"], tags=["auth"])
# Support extra path requested for production
app.add_api_route("/auth/callback", quran_oauth_callback_handler, methods=["GET"], tags=["auth"])


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(auth_router, prefix="/api/v1")
