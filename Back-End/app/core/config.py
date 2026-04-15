import json
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Comma-separated browser origins allowed for CORS (credentials). If empty, dev defaults only — set in production.
    # Example: https://fnwholesale.pk,https://www.fnwholesale.pk
    cors_origins: str = ""

    database_url: str = "sqlite:///./asar.db"

    longcat_api_key: str = ""
    longcat_base_url: str = "https://api.longcat.chat/openai/v1"
    # LongCat platform experimental chat model (FAQ / quota docs). Override with LONGCAT_MODEL e.g.
    # LongCat-Flash-Chat, LongCat-Flash-Lite, LongCat-Flash-Thinking-2601 for stable tiers.
    longcat_model: str = "LongCat-Flash-Chat-2602-Exp"
    # POST /chat/message only (other AI paths keep their own limits)
    longcat_chat_max_tokens: int = 384
    longcat_chat_temperature: float = 0.35

    quran_api_base_url: str = "https://api.quran.com/api/v4"
    quran_api_key: str = ""
    # Primary translation resource_id for verse fetches (see GET /api/v4/resources/translations on your host).
    # 85 = M.A.S. Abdel Haleem (English); 20 = Saheeh International (English).
    quran_translation_resource_id: int = 85
    # Content API `language` query param (chapter metadata, verse payloads). ISO 639-1 e.g. en, ar, ur, fr.
    quran_content_language: str = "en"
    # When using a non-primary translation resource (e.g. Urdu resource id), set this to that locale (e.g. ur).
    # Empty = reuse quran_content_language (works when primary and alternate share the same API language).
    quran_secondary_content_language: str = ""
    # Optional /search `language` filter; empty = omit (widest matching behavior on mixed hosts).
    quran_search_language: str = ""
    # Urdu translation resource for /chat/message when the user writes in Urdu or asks e.g. "in urdu".
    # 0 = disabled (Urdu script questions fall back to primary translation). Common api.quran.com ids:
    # 234 Fatah Muhammad Jalandhari, 54 Junagarhi, 97 Maududi (Tafheem). Override in .env if you prefer another edition.
    quran_urdu_translation_resource_id: int = 234
    quran_default_verse_key: str = "1:1"
    quran_ai_max_verses: int = 3
    # REST chat (/chat/message): lexical relevance gate (0 = disabled). Trims or clarifies on weak multi-hit retrieval.
    quran_chat_relevance_gate_enabled: bool = True
    quran_chat_relevance_min_score: float = 0.06
    quran_chat_relevance_trim_to: int = 2
    # Optional English search phrase via LLM when user text is poor for /search (non-Latin-heavy, etc.).
    quran_chat_query_bridge_enabled: bool = True
    quran_chat_query_bridge_max_tokens: int = 64
    quran_chat_query_bridge_min_latin_ratio: float = 0.35
    # Optional JSON search planner (LongCat): one structured object with search_phrase / topic_keywords before /search.
    # On parse failure or when disabled, existing query bridge + heuristics apply unchanged.
    quran_chat_query_planner_enabled: bool = False
    quran_chat_query_planner_max_tokens: int = 128
    # Include previous/next ayah in LLM context (and response cards) when enabled; hard cap on total verses.
    quran_chat_neighbor_context_enabled: bool = False
    quran_chat_neighbor_max_verses: int = 9
    # Second LLM pass: YES/NO grounding check then one strict rewrite if NO (~one extra LongCat call per reply when verses exist).
    quran_chat_alignment_check_enabled: bool = True
    quran_chat_alignment_max_tokens: int = 96
    # JSON map ISO 639-1 code -> Quran.com translation resource_id (see Back-End/.env.example and GET /resources/translations).
    quran_chat_translation_resources_json: str = "{}"
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
    # Space-separated scopes for Continue with Quran.com — must match your Request Access client (invalid_scope if not).
    # Default matches https://api-docs.quran.foundation/docs/tutorials/oidc/user-apis-quickstart/ “Common scopes”.
    # If Quran Foundation enabled extra scopes for your app (e.g. activity_day), set QURAN_OAUTH_AUTHORIZE_SCOPES in .env.
    quran_oauth_authorize_scopes: str = "openid offline_access user streak bookmark"
    quran_oauth_redirect_uri: str = "http://127.0.0.1:8000/api/v1/auth/callback"
    quran_user_api_base_url: str = "https://apis-prelive.quran.foundation"
    # Override if Foundation path differs (default: {quran_user_api_base_url}/auth/v1/bookmarks)
    quran_bookmarks_url: str = ""
    # POST target for activity / streak sync (override if Foundation path differs)
    quran_activity_sync_post_url: str = ""
    # POST /auth/v1/activity-days body (see Quran Foundation “Add/update activity day” docs)
    quran_activity_mushaf_id: int = 4  # 4 = UthmaniHafs per api-docs.quran.foundation
    quran_activity_seconds_default: int = 60  # required >= 1; nominal reading seconds for “mark complete”
    quran_activity_timezone: str = "Etc/UTC"  # IANA tz for x-timezone (day boundaries / streaks)
    # Mark-complete streak + History Ledger calendar day (POST /streak default, daily counts, heatmap copy).
    asar_ledger_timezone: str = "Asia/Karachi"
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

    @model_validator(mode="after")
    def _mirror_quran_client_credentials(self) -> "Settings":
        """
        Quran Foundation often issues one pre-live client for both client_credentials (content)
        and authorization_code (Continue with Quran.com). Allow filling only QURAN_OAUTH_* or only QURAN_*.
        """
        oid, uid = (self.quran_oauth_client_id or "").strip(), (self.quran_client_id or "").strip()
        osec, usec = (self.quran_oauth_client_secret or "").strip(), (self.quran_client_secret or "").strip()
        if oid and not uid:
            self.quran_client_id = oid
        elif uid and not oid:
            self.quran_oauth_client_id = uid
        if osec and not usec:
            self.quran_client_secret = osec
        elif usec and not osec:
            self.quran_oauth_client_secret = usec
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
