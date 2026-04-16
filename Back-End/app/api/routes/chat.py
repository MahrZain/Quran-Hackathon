"""LLM-backed chat endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.api.routes.common import ensure_session, effective_session_id
from app.db.database import get_db
from app.models.domain import ChatMessage, MessageRole, User
from app.models.schemas import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatRequest,
    ChatResponse,
    ChatVerseCard,
)
from app.services import ai_service, chat_rag_rest
from app.services.streak_logic import compute_streak_count

log = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> ChatResponse:
    sid = effective_session_id(db, user, str(payload.session_id))
    ensure_session(db, sid)

    db.add(ChatMessage(session_id=sid, role=MessageRole.user, content=payload.message.strip()))
    db.commit()

    try:
        result = await ai_service.generate_verified_chat_turn(sid, payload.message, db)
    except ValueError as e:
        log.warning("chat unavailable session=%s: %s", sid, e)
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        log.error("chat runtime error session=%s: %s", sid, e)
        raise HTTPException(status_code=500, detail=str(e)) from e

    db.add(ChatMessage(session_id=sid, role=MessageRole.assistant, content=result.reply))
    db.commit()

    streak = compute_streak_count(sid, db)
    log.info(
        "chat ok session=%s msg_len=%d reply_len=%d streak=%d verse=%s",
        sid,
        len(payload.message),
        len(result.reply),
        streak,
        result.verse_key,
    )
    return ChatResponse(
        ai_reply=result.reply,
        updated_streak_count=streak,
        verse_key=result.verse_key,
        verse_text_uthmani=result.verse_text_uthmani,
        verse_translation=result.verse_translation,
        audio_url=result.audio_url,
    )


@router.post("/chat/message", response_model=ChatMessageResponse)
async def chat_message(
    payload: ChatMessageRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> ChatMessageResponse:
    """
    REST-grounded RAG chat (Quran.com search + verse fetch, then LLM formatting only).
    Optional `history` for multi-turn; streak is unchanged.
    """
    if payload.history:
        log.debug("chat/message client sent history=%d turns", len(payload.history))
    sid = effective_session_id(db, user, str(payload.session_id))
    ensure_session(db, sid)

    db.add(ChatMessage(session_id=sid, role=MessageRole.user, content=payload.message.strip()))
    db.commit()

    try:
        answer, verse_cards = await chat_rag_rest.run_rest_rag_chat(
            user_message=payload.message,
            history=payload.history,
            answer_language=payload.answer_language,
            translation_resource_id=payload.translation_resource_id,
        )
    except ValueError as e:
        log.warning("chat/message unavailable session=%s: %s", sid, e)
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        log.error("chat/message error session=%s: %s", sid, e)
        raise HTTPException(status_code=500, detail="Chat failed") from e

    db.add(ChatMessage(session_id=sid, role=MessageRole.assistant, content=answer))
    db.commit()

    verses = [ChatVerseCard(ayah=v.ayah, reference=v.reference, translation=v.translation) for v in verse_cards]
    log.info(
        "chat/message ok session=%s msg_len=%d answer_len=%d verses=%d",
        sid,
        len(payload.message),
        len(answer),
        len(verses),
    )
    return ChatMessageResponse(answer=answer, verses=verses)
