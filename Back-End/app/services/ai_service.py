"""LongCat-backed reflection with DB memory + Quranic context."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import httpx
from openai import AsyncOpenAI
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.domain import ChatMessage, MessageRole, StreakActivity
from app.services import quran_service

log = logging.getLogger(__name__)

_VERIFIED_SYSTEM_PROMPT = (
    "You are a strict, verified Quranic Assistant. You are forbidden from answering from your pre-trained memory.\n"
    "Rule 1: You MUST use the provided Quran APIs to fetch exact verses or tafsir for every user query.\n"
    "Rule 2: If the API returns a relevant verse, quote it exactly using the Uthmanic text and translation provided by the API, then offer a brief, empathetic reflection.\n"
    "Rule 3: If the API search returns no relevant results, you MUST reply: 'I cannot find a specific verse for that in the currently available API data.' Do NOT hallucinate verses. Do NOT paraphrase verses from memory."
)

_NO_VERSE_REPLY = "I cannot find a specific verse for that in the currently available API data."

_GREETING_REPLY = (
    "Assalamu alaykum wa rahmatullahi wa barakatuh. Welcome. I am here to walk with you beside the Book of Allah "
    "with humility and adab. When you are ready, share what is on your heart—a theme such as patience or gratitude, "
    "or a surah and ayah you are pondering—and we will reflect together, in shaa Allah."
)

_openai_client: AsyncOpenAI | None = None


def _is_greeting_or_meta_chat(text: str) -> bool:
    """Short courtesy / filler messages that are not Quranic search queries (skip strict no-verse wording)."""
    s = (text or "").strip()
    if not s or len(s) > 56:
        return False
    core = re.sub(r"[!?.…~]+$", "", s.lower()).strip()
    core = re.sub(r"\s+", " ", core)
    exact = frozenset(
        {
            "hi",
            "hey",
            "hello",
            "hello there",
            "hii",
            "yo",
            "sup",
            "thanks",
            "thank you",
            "thx",
            "tx",
            "ty",
            "bye",
            "goodbye",
            "ok",
            "okay",
            "k",
            "yes",
            "no",
            "peace",
            "salaam",
            "salam",
            "assalamu alaikum",
            "assalamualaikum",
            "how are you",
            "how r u",
            "what's up",
            "whats up",
            "good morning",
            "good evening",
            "good afternoon",
            "alhamdulillah",
            "jazakallah",
            "jazak allah",
            "lol",
            "haha",
        }
    )
    if core in exact:
        return True
    tokens = [t for t in core.split() if t]
    if not tokens or len(tokens) > 5:
        return False
    courtesy = frozenset(
        {
            "hi",
            "hey",
            "hello",
            "there",
            "yo",
            "sup",
            "thanks",
            "thank",
            "you",
            "thx",
            "tx",
            "ty",
            "bye",
            "goodbye",
            "ok",
            "okay",
            "yes",
            "no",
            "peace",
            "salaam",
            "salam",
            "good",
            "morning",
            "evening",
            "afternoon",
            "how",
            "are",
            "r",
            "u",
            "what's",
            "whats",
            "up",
            "very",
            "much",
            "assalamu",
            "alaikum",
            "assalamualaikum",
        }
    )
    return all(t in courtesy for t in tokens)


@dataclass
class ReflectionResult:
    reply: str
    verse_key: str
    verse_text_uthmani: str
    verse_translation: str
    audio_url: str | None


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


def _last_messages_for_prompt(db: Session, session_id: str, limit: int = 24) -> list[ChatMessage]:
    rows = db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(desc(ChatMessage.created_at))
        .limit(limit)
    ).scalars().all()
    return list(reversed(rows))


async def generate_reflection(session_id: str, user_message: str, db: Session) -> ReflectionResult:
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
    reply = choice.strip()

    uthmani, trans = "", ""
    audio: str | None = None
    try:
        uthmani, trans = await quran_service.fetch_verse_uthmani_and_translation(verse_key, settings)
    except Exception:
        log.warning("verse display fetch failed for %s", verse_key, exc_info=True)
    try:
        audio = await quran_service.fetch_audio_url(verse_key, settings)
    except Exception:
        log.warning("verse audio fetch failed for %s", verse_key, exc_info=True)

    return ReflectionResult(
        reply=reply,
        verse_key=verse_key,
        verse_text_uthmani=uthmani or "",
        verse_translation=trans or "",
        audio_url=audio,
    )


async def generate_verified_chat_turn(session_id: str, user_message: str, db: Session) -> ReflectionResult:
    """
    Multi-turn chat: search Quran API → fetch verse + tafsir/translation → LLM with strict zero-hallucination prompt.
    Does not use streak activity to pick verses (decoupled from habit logging).
    """
    settings = get_settings()
    if not settings.longcat_api_key:
        raise ValueError("LONGCAT_API_KEY is not configured")

    text = user_message.strip()
    if _is_greeting_or_meta_chat(text):
        return ReflectionResult(
            reply=_GREETING_REPLY,
            verse_key="",
            verse_text_uthmani="",
            verse_translation="",
            audio_url=None,
        )

    lim = max(1, int(settings.quran_ai_max_verses))
    explicit_keys = quran_service.verse_keys_from_natural_language_query(text, max_keys=lim)
    if explicit_keys:
        keys = explicit_keys[:lim]
    else:
        try:
            keys = await quran_service.search_verse_keys(text, limit=lim, settings=settings)
        except httpx.HTTPError as e:
            log.warning("Quran search failed for verified chat (upstream or public): %s", e)
            keys = []
    if not keys:
        return ReflectionResult(
            reply=_NO_VERSE_REPLY,
            verse_key="",
            verse_text_uthmani="",
            verse_translation="",
            audio_url=None,
        )

    verse_key = keys[0]
    uthmani, trans = "", ""
    tafsir = ""
    try:
        uthmani, trans = await quran_service.fetch_verse_uthmani_and_translation(verse_key, settings)
    except (httpx.HTTPError, RuntimeError) as e:
        log.warning("verified chat verse fetch failed key=%s: %s", verse_key, e)
    try:
        tafsir = await quran_service.fetch_tafsir_or_translation(verse_key, settings)
    except (httpx.HTTPError, RuntimeError) as e:
        log.warning("verified chat tafsir fetch failed key=%s: %s", verse_key, e)

    if not (uthmani or trans):
        return ReflectionResult(
            reply=_NO_VERSE_REPLY,
            verse_key="",
            verse_text_uthmani="",
            verse_translation="",
            audio_url=None,
        )

    audio: str | None = None
    try:
        audio = await quran_service.fetch_audio_url(verse_key, settings)
    except Exception:
        log.warning("verified chat audio fetch failed for %s", verse_key, exc_info=True)

    facts_parts = [
        f"Primary verse_key from search: {verse_key}",
        f"Uthmanic (API): {uthmani}",
        f"Translation (API): {trans}",
    ]
    if tafsir:
        facts_parts.append("Tafsir / extended translation (API excerpt):\n" + (tafsir[:6000]))
    facts_block = "\n\n".join(facts_parts)

    history = _last_messages_for_prompt(db, session_id, 24)
    oa_messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": _VERIFIED_SYSTEM_PROMPT + "\n\n--- Quran API facts (ground truth; quote only from here) ---\n" + facts_block,
        },
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
            temperature=0.2,
            max_tokens=768,
        )
    except Exception as e:
        log.exception("LongCat verified completion failed: %s", e)
        raise

    choice = completion.choices[0].message.content
    if not choice or not choice.strip():
        raise ValueError("Empty model response")
    reply = choice.strip()

    return ReflectionResult(
        reply=reply,
        verse_key=verse_key,
        verse_text_uthmani=uthmani or "",
        verse_translation=trans or "",
        audio_url=audio,
    )
