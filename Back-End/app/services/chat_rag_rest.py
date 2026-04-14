"""
REST-only RAG for POST /api/v1/chat/message: Quran.com search + verse fetch, then LLM formatting.
No MCP, no vector DB.
"""

from __future__ import annotations

import asyncio
import logging
import re
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

_VERSE_CITATION_RE = re.compile(r"\[(\d{1,3}):(\d{1,3})\]|\b(\d{1,3})\s*:\s*(\d{1,3})\b")

_META_URDU_ONLY = re.compile(
    r"^\s*(in urdu|urdu only|translate to urdu|urdu translation|in urdu please)\s*[.!?,]*\s*$",
    re.I,
)


def _wants_urdu(text: str) -> bool:
    t = (text or "").strip()
    low = t.lower()
    if _META_URDU_ONLY.match(t):
        return True
    if re.search(r"\bin urdu\b", low, re.I):
        return True
    if re.search(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]", t):
        return True
    return False


def _is_language_meta_only(text: str) -> bool:
    t = (text or "").strip()
    if len(t) > 120:
        return False
    if _META_URDU_ONLY.match(t):
        return True
    return bool(re.fullmatch(r"(urdu|english|arabic)\s*[.!?,]*", t, re.I))


def _strip_search_boilerplate(q: str) -> str:
    t = re.sub(
        r"\b(please|kindly|tell me|can you|could you|would you|i want to know|what does the quran say|will you)\b",
        " ",
        q,
        flags=re.I,
    )
    t = re.sub(r"\s+", " ", t).strip(" ,.?!")
    return t[:280]


def _retrieval_message_for_search(message: str, history: list[ChatTurnIn]) -> str:
    if _is_language_meta_only(message) and history:
        for row in reversed(history[-8:]):
            if row.role != "user":
                continue
            c = row.content.strip()
            if c and not _is_language_meta_only(c):
                return c
        return ""
    raw = _strip_search_boilerplate(message)
    return raw if len(raw) >= 2 else (message or "").strip()


def _allowed_refs_from_verses(verses: list["RestVerseCard"]) -> set[str]:
    return {v.reference.strip() for v in verses}


def _answer_citations_subset_of_context(answer: str, allowed: set[str]) -> bool:
    for m in _VERSE_CITATION_RE.finditer(answer):
        if m.group(1):
            ref = f"{int(m.group(1))}:{int(m.group(2))}"
        else:
            ref = f"{int(m.group(3))}:{int(m.group(4))}"
        if ref not in allowed:
            return False
    return True


@dataclass
class RestVerseCard:
    ayah: str
    reference: str
    translation: str


async def _verse_cards_from_rest(
    message: str,
    settings: Settings,
    limit: int,
    history: list[ChatTurnIn],
) -> tuple[list[RestVerseCard], str]:
    keys = quran_service.verse_keys_from_natural_language_query(message, max_keys=limit)
    search_q = _retrieval_message_for_search(message, history)
    if not keys and search_q:
        try:
            keys = await quran_service.search_verse_keys(search_q, limit=limit, settings=settings)
        except httpx.HTTPError as e:
            log.warning("REST RAG search failed: %s", e)
            keys = []
    keys = keys[:limit]

    urdu_id = int(getattr(settings, "quran_urdu_translation_resource_id", 0) or 0)
    tr_override: int | None = urdu_id if urdu_id > 0 and _wants_urdu(message) else None

    async def _one_verse(vk: str) -> RestVerseCard | None:
        try:
            if tr_override is not None:
                uth, tr = await quran_service.fetch_verse_uthmani_and_translation(
                    vk, settings, translation_resource_id=tr_override
                )
            else:
                uth, tr = await quran_service.fetch_verse_uthmani_and_translation(vk, settings)
        except Exception:
            return None
        uth = (uth or "").strip()
        tr = (tr or "").strip()
        if not (uth or tr):
            return None
        return RestVerseCard(ayah=uth, reference=vk, translation=tr)

    fetched = await asyncio.gather(*[_one_verse(vk) for vk in keys]) if keys else []
    verses: list[RestVerseCard] = [c for c in fetched if c is not None]
    lines = [f"[{c.reference}]\nUthmani: {c.ayah}\nTranslation: {c.translation}" for c in verses]
    plain = "\n\n".join(lines).strip()
    return verses, plain


def _history_to_openai(history: list[ChatTurnIn]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for row in history[-12:]:
        role = "user" if row.role == "user" else "assistant"
        out.append({"role": role, "content": row.content.strip()})
    return out


async def _chat_completion(
    *,
    s: Settings,
    system_content: str,
    history: list[ChatTurnIn],
    user_tail: str,
) -> str:
    oa: list[dict[str, str]] = [{"role": "system", "content": system_content}]
    oa.extend(_history_to_openai(history))
    oa.append({"role": "user", "content": user_tail})
    client: AsyncOpenAI = ai_service._client_or_raise()
    max_tok = max(64, int(s.longcat_chat_max_tokens))
    temp = float(s.longcat_chat_temperature)
    completion = await client.chat.completions.create(
        model=s.longcat_model,
        messages=oa,
        temperature=temp,
        max_tokens=max_tok,
    )
    choice = completion.choices[0].message.content
    if not choice or not choice.strip():
        raise ValueError("Empty model response")
    return choice.strip()


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

    lim = max(1, min(int(s.quran_ai_max_verses), 5))
    verses, plain = await _verse_cards_from_rest(text, s, lim, history)
    if not verses or not plain:
        return _EMPTY_ANSWER, []

    allowed = _allowed_refs_from_verses(verses)
    ref_list = ", ".join(sorted(allowed))
    base_rules = (
        f"{_GOLDEN}\n\n"
        "You are a concise Muslim assistant. Answer ONLY using the Quran context block below. "
        "Do not invent verses or translations. When you mention a verse, cite ONLY references that "
        f"appear in the context block (exactly: {ref_list}). Do not cite any other surah:ayah numbers. "
        "Be empathetic and clear in 2–4 short paragraphs."
    )
    system = base_rules + "\n\n--- Quran REST context ---\n" + plain
    user_tail = text + "\n\nAnswer using only the Quran context above."

    answer = await _chat_completion(s=s, system_content=system, history=history, user_tail=user_tail)
    if not _answer_citations_subset_of_context(answer, allowed):
        log.info("chat/message: model cited verses outside context; retrying with stricter instruction")
        strict = (
            base_rules
            + "\n\nYour previous draft cited verse numbers not in the context. Rewrite the answer. "
            f"Permitted references ONLY: {ref_list}. Do not output any other surah:ayah."
            + "\n\n--- Quran REST context ---\n"
            + plain
        )
        answer = await _chat_completion(s=s, system_content=strict, history=history, user_tail=user_tail)

    return answer, verses
