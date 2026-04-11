from contextlib import asynccontextmanager
import logging

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI

from app.api.auth_routes import ensure_demo_account_ready, router as auth_router
from app.api.routes import router
from app.core.config import get_settings
from app.core.logging_config import setup_logging
from app.db.database import SessionLocal
from app.services import ai_service, quran_service

setup_logging()
log = logging.getLogger(__name__)

_s = get_settings()
if len(_s.jwt_secret_key) < 24 or "change-me" in _s.jwt_secret_key.lower():
    log.warning(
        "JWT_SECRET_KEY is short or looks like a placeholder — use a long random secret in .env for production"
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
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
    log.info("ASAR Engine started — HTTP + AI clients ready")
    yield
    log.info("ASAR Engine shutting down")
    ai_service.set_openai_client(None)
    quran_service.set_http_client(None)
    await client.aclose()


app = FastAPI(title="ASAR Engine", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(auth_router, prefix="/api/v1")
