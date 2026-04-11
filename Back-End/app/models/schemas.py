from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.domain import MessageRole


class ChatRequest(BaseModel):
    session_id: UUID
    message: str = Field(..., min_length=1, max_length=8000)


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
        description="UTC calendar date; defaults to today UTC if omitted",
    )


class StreakResponse(BaseModel):
    ok: bool
    updated_streak_count: int
    message: str = ""
    quran_foundation_synced: bool = False


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


class UserMe(BaseModel):
    id: int
    email: str

    model_config = {"from_attributes": True}
