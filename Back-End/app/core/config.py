from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./asar.db"

    longcat_api_key: str = ""
    longcat_base_url: str = "https://api.longcat.chat/openai/v1"
    longcat_model: str = "LongCat-Flash-Lite"

    quran_api_base_url: str = "https://api.quran.com/api/v4"
    quran_api_key: str = ""
    quran_translation_resource_id: int = 85
    quran_default_verse_key: str = "1:1"
    quran_user_activity_url: str = ""
    # When the verse API omits `audio` (common on api.quran.com), build URL from this template.
    # {block} = 6 digits, surah padded to 3 + ayah padded to 3 (e.g. 094005 for 94:5). Public CDN allows * origin.
    quran_verse_audio_url_template: str = "https://verses.quran.com/Alafasy/mp3/{block}.mp3"

    # Quran Foundation OAuth2 (client_credentials). If set, Bearer token is used for Quran HTTP calls.
    # Token URLs from OpenID metadata: .../oauth2/token
    quran_oauth_token_url: str = ""
    quran_oauth_client_id: str = ""
    quran_oauth_client_secret: str = ""
    quran_oauth_scope: str = ""

    # User OAuth (Authorization Code + PKCE) & Activity sync — QURAN_CLIENT_ID / QURAN_CLIENT_SECRET
    quran_client_id: str = ""
    quran_client_secret: str = ""
    # Optional full authorize URL; if empty, derived from quran_oauth_token_url (…/oauth2/token → …/oauth2/auth)
    quran_oauth_authorize_url: str = ""
    quran_oauth_redirect_uri: str = "http://127.0.0.1:8000/api/v1/auth/callback"
    quran_user_api_base_url: str = "https://apis-prelive.quran.foundation"
    # POST target for activity / streak sync (override if Foundation path differs)
    quran_activity_sync_post_url: str = ""
    # Browser origin for post–Quran OAuth return (redirects to {this}/welcome/oauth#asar_token=…)
    frontend_after_oauth_url: str = "http://localhost:5173"
    # Demo “armed” User API tokens (optional; injected on POST /auth/demo)
    demo_quran_access_token: str = ""
    demo_quran_refresh_token: str = ""

    # JWT (set JWT_SECRET_KEY in .env for any shared environment)
    jwt_secret_key: str = "change-me-use-long-random-secret-in-env-32chars+"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # One-tap demo JWT (disable in production: ENABLE_DEMO_LOGIN=false)
    enable_demo_login: bool = True
    demo_user_email: str = "demo@asar.local"
    demo_user_password: str = "AsarJudge2026!"


@lru_cache
def get_settings() -> Settings:
    return Settings()
