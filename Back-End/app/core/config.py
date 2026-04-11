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

    # Quran Foundation OAuth2 (client_credentials). If set, Bearer token is used for Quran HTTP calls.
    # Token URLs from OpenID metadata: .../oauth2/token
    quran_oauth_token_url: str = ""
    quran_oauth_client_id: str = ""
    quran_oauth_client_secret: str = ""
    quran_oauth_scope: str = ""

    # JWT (set JWT_SECRET_KEY in .env for any shared environment)
    jwt_secret_key: str = "change-me-use-long-random-secret-in-env-32chars+"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7


@lru_cache
def get_settings() -> Settings:
    return Settings()
