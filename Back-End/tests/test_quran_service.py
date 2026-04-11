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
async def test_oauth_token_cache_does_not_overwrite_coroutine(httpx_client, monkeypatch):
    """Failed OAuth must not assign into a global that shadows `_oauth_access_token()` (regression)."""
    from app.core.config import Settings

    async def fake_post(*args: object, **kwargs: object) -> httpx.Response:
        req = httpx.Request("POST", "https://oauth.example/oauth2/token")
        return httpx.Response(401, request=req)

    monkeypatch.setattr(httpx_client, "post", fake_post)
    s = Settings(
        quran_oauth_token_url="https://prelive-oauth2.quran.foundation/oauth2/token",
        quran_oauth_client_id="x",
        quran_oauth_client_secret="y",
    )
    for _ in range(3):
        assert await quran_service._oauth_access_token(s) is None
        assert callable(quran_service._oauth_access_token)
    headers = await quran_service._auth_headers(s)
    assert isinstance(headers, dict)
    assert callable(quran_service._oauth_access_token)


@pytest.mark.asyncio
async def test_fetch_verse_text_with_api_key(httpx_client):
    if not _quran_auth_configured():
        pytest.skip(
            "Set QURAN_API_KEY or QURAN_OAUTH_* (client id, secret, token URL) for integration smoke"
        )
    text = await quran_service.fetch_verse_text("1:1")
    assert isinstance(text, str)
    assert len(text) > 10
