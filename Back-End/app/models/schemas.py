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
