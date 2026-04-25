from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.domain import MessageRole


class ChatRequest(BaseModel):
    session_id: UUID
    message: str = Field(..., min_length=1, max_length=8000)


class ChatTurnIn(BaseModel):
    """One row in a multi-turn client payload (not persisted until echoed by the server)."""

    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=8000)


class ChatMessageRequest(BaseModel):
    """REST-grounded RAG chat: optional `history` for multi-turn; server persists the new `message` and assistant `answer`."""

    session_id: UUID
    history: list[ChatTurnIn] = Field(default_factory=list, max_length=48)
    message: str = Field(..., min_length=1, max_length=8000)
    # Optional ISO 639-1 code (e.g. ur, fr) for answer language and translation lookup.
    answer_language: str | None = Field(default=None, max_length=16)
    # Optional Quran.com translation resource_id override (advanced).
    translation_resource_id: int | None = Field(default=None, ge=1)


class ChatVerseCard(BaseModel):
    ayah: str
    reference: str
    translation: str


class ChatMessageResponse(BaseModel):
    """REST-grounded reply + ayah cards from Quran Foundation HTTP APIs (no streak side effects)."""

    answer: str
    verses: list[ChatVerseCard] = Field(default_factory=list)


class ChatResponse(BaseModel):
    ai_reply: str
    updated_streak_count: int
    verse_key: str = ""
    verse_text_uthmani: str = ""
    verse_translation: str = ""
    audio_url: str | None = None


class VerseBundleResponse(BaseModel):
    """Uthmani text, translation, and optional audio URL for a verse key (e.g. 94:5)."""

    verse_key: str
    verse_text_uthmani: str = ""
    verse_translation: str = ""
    audio_url: str | None = None


class TranslationResourceOut(BaseModel):
    """One Quran.com / Content API translation resource for UI pickers."""

    id: int
    name: str = ""
    author_name: str = ""
    language_name: str = ""
    slug: str = ""


class ChapterSummary(BaseModel):
    """One surah row for the Quran progress / reader index (from upstream chapters API)."""

    id: int
    name: str
    transliteration: str = ""
    verses: int = 0
    revelation: str = ""


class StreakSnapshot(BaseModel):
    """Current streak for a session (from SQLite streak_activities)."""

    updated_streak_count: int


class StreakActivityOut(BaseModel):
    """One day’s logged mark-complete row for the habit ledger."""

    activity_date: date
    ayah_read: str

    model_config = ConfigDict(from_attributes=True)


class HistoryMessage(BaseModel):
    role: MessageRole
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StreakRequest(BaseModel):
    session_id: UUID
    ayah_read: str = Field(..., min_length=1, max_length=32, description="Verse key e.g. 2:255")
    activity_date: date | None = Field(
        default=None,
        description="Ledger calendar date (server TZ); defaults to today in ASAR ledger timezone if omitted",
    )


class StreakResponse(BaseModel):
    ok: bool
    updated_streak_count: int
    message: str = ""
    quran_foundation_synced: bool = False
    next_verse_key: str | None = None
    next_surah_id: int | None = None
    next_ayah_number: int | None = None
    ayahs_marked_today: int = 0
    at_scope_end: bool = False


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LedgerTimezonePatch(BaseModel):
    """IANA timezone name for streak / History Ledger day boundaries (e.g. Asia/Karachi, Europe/London)."""

    ledger_timezone: str = Field(..., min_length=1, max_length=64)


class UserMe(BaseModel):
    id: int
    email: str
    asar_session_id: str
    # Resolved IANA zone for mark-complete / History Ledger (user override or ASAR_LEDGER_TIMEZONE).
    ledger_timezone: str = "Asia/Karachi"
    onboarding_completed: bool = False
    onboarding_goal: str | None = None
    onboarding_level: str | None = None
    onboarding_time_budget: str | None = None
    onboarding_journey_mode: str | None = None
    onboarding_topic_tag: str | None = None
    recommended_verse_key: str | None = None
    current_verse_key: str | None = None
    reading_scope: str | None = None
    reading_scope_surah: int | None = None
    ayahs_marked_today: int = 0
    at_reading_scope_end: bool = False


class OnboardingCompleteRequest(BaseModel):
    goal: Literal["habit", "reading", "understand", "listen"]
    level: Literal["beginner", "intermediate", "daily_learner", "regular"]
    reading_scope: Literal["full_mushaf", "single_surah"] | None = None
    start_location: Literal["beginning", "custom"] | None = None
    start_surah: int | None = Field(None, ge=1, le=114)
    start_ayah: int | None = Field(None, ge=1)
    scope_surah: int | None = Field(None, ge=1, le=114)
    time_budget: Literal["1", "3", "5_plus"] | None = None
    journey_mode: Literal["beginning", "daily_bites", "topic"] | None = None
    topic_tag: Literal["patience", "stress", "gratitude", "hope", "fear", "general"] | None = None


class RecommendedVerseResponse(BaseModel):
    verse_key: str


class BookmarkCreate(BaseModel):
    surah_id: int = Field(..., ge=1, le=114)
    ayah_number: int = Field(..., ge=1)
    note: str | None = Field(None, max_length=2000)


class BookmarkOut(BaseModel):
    id: int
    surah_id: int
    ayah_number: int
    verse_key: str
    note: str | None = None
    created_at: datetime
    quran_sync_status: Literal["pending", "synced", "failed"] = "pending"

    model_config = ConfigDict(from_attributes=True)


class InsightCard(BaseModel):
    kind: str
    title: str
    body: str


class InsightsResponse(BaseModel):
    subtitle: str
    cards: list[InsightCard]
