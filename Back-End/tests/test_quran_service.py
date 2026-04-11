"""Smoke test for Quran HTTP client (optional API key)."""

import os

import httpx
import pytest

from app.services import quran_service


@pytest.fixture
async def httpx_client():
    client = httpx.AsyncClient(timeout=httpx.Timeout(30.0))
    quran_service.set_http_client(client)
    yield client
    quran_service.set_http_client(None)
    await client.aclose()


def _quran_auth_configured() -> bool:
    if os.environ.get("QURAN_API_KEY"):
        return True
    return bool(
        os.environ.get("QURAN_OAUTH_CLIENT_ID")
        and os.environ.get("QURAN_OAUTH_CLIENT_SECRET")
        and os.environ.get("QURAN_OAUTH_TOKEN_URL")
    )


@pytest.mark.asyncio
async def test_fetch_verse_text_with_api_key(httpx_client):
    if not _quran_auth_configured():
        pytest.skip(
            "Set QURAN_API_KEY or QURAN_OAUTH_* (client id, secret, token URL) for integration smoke"
        )
    text = await quran_service.fetch_verse_text("1:1")
    assert isinstance(text, str)
    assert len(text) > 10
