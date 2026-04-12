"""
REST-only RAG for POST /api/v1/chat/message: Quran.com search + verse fetch, then LLM formatting.
No MCP, no vector DB.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx
from openai import AsyncOpenAI
from app.core.config import Settings, get_settings
from app.models.schemas import ChatTurnIn
from app.services import ai_service, quran_service

log = logging.getLogger(__name__)

_EMPTY_ANSWER = "I cannot find a specific verse for that right now."

_GOLDEN = (
    "Always ensure answers are grounded in the Quran Foundation REST API context. "
    "If no context is returned from the API search, do not generate religious claims or hallucinate verses."
)


@dataclass
class RestVerseCard:
    ayah: str
    reference: str
    translation: str


async def _verse_cards_from_rest(message: str, settings: Settings, limit: int) -> tuple[list[RestVerseCard], str]:
    keys = quran_service.verse_keys_from_natural_language_query(message)
    if not keys:
        try:
            keys = await quran_service.search_verse_keys(message, limit=limit, settings=settings)
        except httpx.HTTPError as e:
            log.warning("REST RAG search failed: %s", e)
            keys = []
    keys = keys[:limit]
    verses: list[RestVerseCard] = []
    lines: list[str] = []
    for vk in keys:
        try:
            uth, tr = await quran_service.fetch_verse_uthmani_and_translation(vk, settings)
        except Exception:
            continue
        uth = (uth or "").strip()
        tr = (tr or "").strip()
        if not (uth or tr):
            continue
        verses.append(RestVerseCard(ayah=uth, reference=vk, translation=tr))
        lines.append(f"[{vk}]\nUthmani: {uth}\nTranslation: {tr}")
    plain = "\n\n".join(lines).strip()
    return verses, plain


def _history_to_openai(history: list[ChatTurnIn]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for row in history[-12:]:
        role = "user" if row.role == "user" else "assistant"
        out.append({"role": role, "content": row.content.strip()})
    return out


async def run_rest_rag_chat(
    *,
    user_message: str,
    history: list[ChatTurnIn],
    settings: Settings | None = None,
) -> tuple[str, list[RestVerseCard]]:
    """
    Returns (answer, verses). Uses REST grounding only; LLM runs only when verse cards exist
    (except greeting short-circuit).
    """
    s = settings or get_settings()
    text = user_message.strip()

    if ai_service._is_greeting_or_meta_chat(text):
        return ai_service._GREETING_REPLY, []

    if not s.longcat_api_key:
        raise ValueError("LONGCAT_API_KEY is not configured")

    verses, plain = await _verse_cards_from_rest(text, s, max(1, min(int(s.quran_ai_max_verses), 5)))
    if not verses or not plain:
        return _EMPTY_ANSWER, []

    system = (
        f"{_GOLDEN}\n\n"
        "You are a concise Muslim assistant. Answer ONLY using the Quran context block below. "
        "Do not invent verses or translations. Be empathetic and clear in 2–4 short paragraphs."
    )
    oa: list[dict[str, str]] = [{"role": "system", "content": system + "\n\n--- Quran REST context ---\n" + plain}]
    oa.extend(_history_to_openai(history))
    oa.append(
        {
            "role": "user",
            "content": text + "\n\nAnswer using only the Quran context above.",
        }
    )

    client: AsyncOpenAI = ai_service._client_or_raise()
    completion = await client.chat.completions.create(
        model=s.longcat_model,
        messages=oa,
        temperature=0.35,
        max_tokens=512,
    )
    choice = completion.choices[0].message.content
    if not choice or not choice.strip():
        raise ValueError("Empty model response")
    return choice.strip(), verses
