import enum
from datetime import date, datetime, timezone


def _utc_naive_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"


class UserSession(Base):
    __tablename__ = "user_sessions"

    session_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_naive_now)

    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    streaks: Mapped[list["StreakActivity"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_sessions.session_id"), index=True)
    role: Mapped[MessageRole] = mapped_column(
        SAEnum(
            MessageRole,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        )
    )
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_naive_now, index=True)

    session: Mapped["UserSession"] = relationship(back_populates="messages")


class StreakActivity(Base):
    __tablename__ = "streak_activities"
    __table_args__ = (UniqueConstraint("session_id", "activity_date", name="uq_streak_session_day"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_sessions.session_id"), index=True)
    activity_date: Mapped[date] = mapped_column(Date, index=True)
    ayah_read: Mapped[str] = mapped_column(String(32))

    session: Mapped["UserSession"] = relationship(back_populates="streaks")


class User(Base):
    """Registered account (JWT subject is stringified id)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    # Server-owned ASAR chat/streak session; anonymous clients use X-Session-ID only.
    asar_session_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_naive_now)
    quran_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    quran_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    # First-time onboarding (nullable = not completed or legacy row)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    onboarding_goal: Mapped[str | None] = mapped_column(String(32), nullable=True)
    onboarding_level: Mapped[str | None] = mapped_column(String(32), nullable=True)
    onboarding_time_budget: Mapped[str | None] = mapped_column(String(16), nullable=True)
    onboarding_journey_mode: Mapped[str | None] = mapped_column(String(32), nullable=True)
    onboarding_topic_tag: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Sequential reading (dashboard cursor); null until onboarding or legacy seed
    reading_cursor_surah: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reading_cursor_ayah: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reading_start_surah: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reading_start_ayah: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reading_scope: Mapped[str | None] = mapped_column(String(24), nullable=True)
    reading_scope_surah: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Optional IANA override for streak ledger day (null = use ASAR_LEDGER_TIMEZONE from settings).
    ledger_timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)

    reading_daily_stats: Mapped[list["ReadingDailyStat"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    verse_bookmarks: Mapped[list["VerseBookmark"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class ReadingDailyStat(Base):
    """Per-user ledger-calendar-day count of Mark complete taps (for dashboard ring / analytics)."""

    __tablename__ = "reading_daily_stats"
    __table_args__ = (UniqueConstraint("user_id", "activity_date", name="uq_reading_daily_user_day"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    activity_date: Mapped[date] = mapped_column(Date, index=True)
    marks_count: Mapped[int] = mapped_column(Integer, default=0)

    user: Mapped["User"] = relationship(back_populates="reading_daily_stats")


class QuranBookmarkSyncStatus(str, enum.Enum):
    pending = "pending"
    synced = "synced"
    failed = "failed"


class VerseBookmark(Base):
    """Per-user saved verse; optional sync to Quran Foundation User API."""

    __tablename__ = "verse_bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "surah_id", "ayah_number", name="uq_bookmark_user_verse"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    surah_id: Mapped[int] = mapped_column(Integer, index=True)
    ayah_number: Mapped[int] = mapped_column(Integer, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_naive_now, index=True)
    quran_bookmark_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    quran_sync_status: Mapped[QuranBookmarkSyncStatus] = mapped_column(
        SAEnum(
            QuranBookmarkSyncStatus,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=QuranBookmarkSyncStatus.pending,
    )
    quran_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_sync_error: Mapped[str | None] = mapped_column(String(512), nullable=True)

    user: Mapped["User"] = relationship(back_populates="verse_bookmarks")
