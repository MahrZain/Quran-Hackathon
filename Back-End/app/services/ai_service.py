"""LongCat-backed reflection with DB memory + Quranic context."""

from __future__ import annotations

import logging

from openai import AsyncOpenAI
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.domain import ChatMessage, MessageRole, StreakActivity
from app.services import quran_service

log = logging.getLogger(__name__)

_openai_client: AsyncOpenAI | None = None


def set_openai_client(client: AsyncOpenAI | None) -> None:
    global _openai_client
    _openai_client = client


def _client_or_raise() -> AsyncOpenAI:
    if _openai_client is None:
        raise RuntimeError("OpenAI client not initialized (app lifespan)")
    return _openai_client


def _latest_verse_key(db: Session, session_id: str) -> str:
    row = db.execute(
        select(StreakActivity)
        .where(StreakActivity.session_id == session_id)
        .order_by(desc(StreakActivity.activity_date), desc(StreakActivity.id))
        .limit(1)
    ).scalar_one_or_none()
    if row and row.ayah_read.strip():
        return row.ayah_read.strip()
    return get_settings().quran_default_verse_key


def _last_messages_for_prompt(db: Session, session_id: str, limit: int = 5) -> list[ChatMessage]:
    rows = db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(desc(ChatMessage.created_at))
        .limit(limit)
    ).scalars().all()
    return list(reversed(rows))


async def generate_reflection(session_id: str, user_message: str, db: Session) -> str:
    settings = get_settings()
    if not settings.longcat_api_key:
        raise ValueError("LONGCAT_API_KEY is not configured")

    verse_key = _latest_verse_key(db, session_id)
    history = _last_messages_for_prompt(db, session_id, 5)

    quranic = await quran_service.build_quranic_context(verse_key, settings)
    if not quranic.strip():
        quranic = f"(Context unavailable; anchor verse key: {verse_key})"

    system = (
        "You are a gentle, adab-aware Muslim mentor in the ASAR app. "
        "Ground your answer in the Quranic context provided when relevant. "
        "Reply with one short reflection suitable to speak aloud in about nineteen seconds: "
        "clear, warm, and practical—no bullet lists unless essential."
    )

    oa_messages: list[dict[str, str]] = [
        {"role": "system", "content": system + "\n\n--- Quranic context ---\n" + quranic},
    ]
    for m in history:
        if m.role == MessageRole.user:
            oa_messages.append({"role": "user", "content": m.content})
        else:
            oa_messages.append({"role": "assistant", "content": m.content})

    client = _client_or_raise()
    try:
        completion = await client.chat.completions.create(
            model=settings.longcat_model,
            messages=oa_messages,
            temperature=0.7,
            max_tokens=512,
        )
    except Exception as e:
        log.exception("LongCat completion failed: %s", e)
        raise

    choice = completion.choices[0].message.content
    if not choice or not choice.strip():
        raise ValueError("Empty model response")
    return choice.strip()
