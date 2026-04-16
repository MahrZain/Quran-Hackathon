"""Per-session chat history."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.api.routes.common import effective_session_id
from app.db.database import get_db
from app.models.domain import ChatMessage, User
from app.models.schemas import HistoryMessage

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/history/{session_id}", response_model=list[HistoryMessage])
def history(
    session_id: UUID,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> list[HistoryMessage]:
    sid = effective_session_id(db, user, str(session_id))
    rows = db.execute(
        select(ChatMessage).where(ChatMessage.session_id == sid).order_by(ChatMessage.created_at.asc())
    ).scalars().all()
    return [HistoryMessage.model_validate(m) for m in rows]


@router.delete("/history/{session_id}", status_code=204)
def clear_history(
    session_id: UUID,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> None:
    """Remove all stored chat turns for this session (same scope as GET /history)."""
    sid = effective_session_id(db, user, str(session_id))
    db.execute(delete(ChatMessage).where(ChatMessage.session_id == sid))
    db.commit()
    log.info("history cleared session=%s", sid)
