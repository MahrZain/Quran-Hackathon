"""Smoke test for Quran HTTP client (optional API key)."""

import os

import httpx
import pytest

from app.core.config import Settings
from app.services import quran_service
from app.services.quran_service import normalize_translation_resource_row


def test_adjacent_verse_keys():
    assert quran_service.adjacent_verse_keys("1:1") == ["1:1", "1:2"]
    assert "2:1" in quran_service.adjacent_verse_keys("1:7")
    mid = quran_service.adjacent_verse_keys("2:255")
    assert mid == ["2:254", "2:255", "2:256"]


def test_verse_keys_surah_ikhlas_typo_whole_surah():
    keys = quran_service.verse_keys_from_natural_language_query("tell me sura iklas", max_keys=8)
    assert keys == ["112:1", "112:2", "112:3", "112:4"]


def test_verse_keys_surah_112_number_only():
    keys = quran_service.verse_keys_from_natural_language_query("surah 112 please", max_keys=8)
    assert keys == ["112:1", "112:2", "112:3", "112:4"]


def test_verse_keys_al_fatihah_ayah_5():
    keys = quran_service.verse_keys_from_natural_language_query("al fatihah ayah 5", max_keys=8)
    assert keys == ["1:5"]


def test_verse_keys_numeric_colon():
    assert quran_service.verse_keys_from_natural_language_query("see 1:5", max_keys=8) == ["1:5"]


def test_verse_keys_surah_ad_duha_comma_before_ayah():
    keys = quran_service.verse_keys_from_natural_language_query("Surah Ad-Duha, ayah 7", max_keys=8)
    assert keys == ["93:7"]


def test_verse_keys_first_ayah_of_quran():
    keys = quran_service.verse_keys_from_natural_language_query("what is the first ayat of quran", max_keys=8)
    assert keys == ["1:1"]


def test_verse_keys_sura_iklash_typo():
    keys = quran_service.verse_keys_from_natural_language_query("sura iklash", max_keys=8)
    assert keys == ["112:1", "112:2", "112:3", "112:4"]


def test_verse_keys_surat_nas_with_roman_suffix():
    keys = quran_service.verse_keys_from_natural_language_query("surat nas ka turjma", max_keys=5)
    assert keys, "expected surah 114 resolved, not a broken single-letter capture"
    assert keys[0].startswith("114:")


def test_normalize_translation_resource_row():
    row = {"id": 234, "name": "Jalandhari", "author_name": "A", "language_name": "urdu", "slug": "ur-j"}
    out = normalize_translation_resource_row(row)
    assert out is not None
    assert out["id"] == 234
    assert out["name"] == "Jalandhari"
    assert out["language_name"] == "urdu"
    assert normalize_translation_resource_row({}) is None
    assert normalize_translation_resource_row({"id": 0}) is None


def test_verse_payload_flat_and_resource_pick():
    uth, tr = quran_service._verse_uthmani_and_translation_from_payload(
        {"text_uthmani": "abc", "translations": [{"resource_id": 10, "text": "t10"}, {"resource_id": 20, "text": "t20"}]},
        preferred_translation_resource_id=20,
    )
    assert uth == "abc" and tr == "t20"
    uth2, tr2 = quran_service._verse_uthmani_and_translation_from_payload(
        {"verse": {"text": "x", "translations": [{"text": "fallback"}]}},
        preferred_translation_resource_id=99,
    )
    assert tr2 == "fallback"


def test_search_hits_normalization():
    body = {"search": {"results": [{"verse_key": " 2:255 "}]}}
    rows = quran_service._search_result_dicts(body)
    assert len(rows) == 1
    assert quran_service._verse_key_from_search_hit(rows[0]) == "2:255"
    nested = {"results": [{"verse": {"verse_key": "1:1"}}]}
    assert quran_service._verse_key_from_search_hit(quran_service._search_result_dicts(nested)[0]) == "1:1"


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


@pytest.mark.asyncio
async def test_fetch_verse_uthmani_retries_after_connect_error(httpx_client, monkeypatch):
    """Primary host (public v4): retries same URL on transient ConnectError before succeeding."""
    calls: list[str] = []
    payload = {
        "text_uthmani": "بسم",
        "translations": [{"resource_id": 85, "text": "In the name"}],
    }

    async def fake_get(url: str, **kwargs: object) -> httpx.Response:
        calls.append(str(url))
        if len(calls) == 1:
            raise httpx.ConnectError("simulated", request=httpx.Request("GET", url))
        return httpx.Response(200, json=payload, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx_client, "get", fake_get)
    s = Settings(quran_api_base_url="https://api.quran.com/api/v4", quran_translation_resource_id=85)
    uth, tr = await quran_service.fetch_verse_uthmani_and_translation("1:1", settings=s)
    assert uth == "بسم" and tr == "In the name"
    assert len(calls) == 2
    assert all("api.quran.com" in u for u in calls)


@pytest.mark.asyncio
async def test_fetch_verse_uthmani_public_fallback_after_primary_transport_errors(httpx_client, monkeypatch):
    """Non-public base: after exhausting primary transport retries, GET public api.quran.com."""
    calls: list[str] = []
    payload = {
        "text_uthmani": "x",
        "translations": [{"resource_id": 85, "text": "y"}],
    }

    async def fake_get(url: str, **kwargs: object) -> httpx.Response:
        calls.append(str(url))
        if "prelive-api.quran.foundation" in str(url):
            raise httpx.ConnectError("simulated", request=httpx.Request("GET", url))
        return httpx.Response(200, json=payload, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx_client, "get", fake_get)
    s = Settings(
        quran_api_base_url="https://prelive-api.quran.foundation/api/v4",
        quran_translation_resource_id=85,
    )
    uth, tr = await quran_service.fetch_verse_uthmani_and_translation("1:1", settings=s)
    assert uth == "x" and tr == "y"
    assert any("api.quran.com" in c for c in calls)
    assert sum(1 for c in calls if "prelive-api.quran.foundation" in c) == 3
