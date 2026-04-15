"""
REST-only RAG for POST /api/v1/chat/message: Quran.com search + verse fetch, then LLM formatting.
No MCP, no vector DB.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass

import httpx
from openai import AsyncOpenAI

from app.core.config import Settings, get_settings
from app.models.schemas import ChatTurnIn
from app.services import ai_service, quran_service
from app.services.chat_retrieval_gates import apply_relevance_gate

log = logging.getLogger(__name__)

_EMPTY_ANSWER = "I cannot find a specific verse for that right now."
_CLARIFY_RELEVANCE = (
    "The verses retrieved may not closely match your question. "
    "Could you rephrase, or name a surah and verse number if you have one?"
)
_CLARIFY_RELEVANCE_UR = (
    "جو آیات ملیں وہ آپ کے سوال سے واضح طور پر میل نہیں کھاتیں۔ براہ کرم دوبارہ پوچھیں، "
    "یا سورۃ اور آیت نمبر لکھ دیں۔"
)

_GOLDEN = (
    "Always ensure answers are grounded in the Quran Foundation REST API context. "
    "If no context is returned from the API search, do not generate religious claims or hallucinate verses."
)

_ANSWER_POLICY = (
    "Structure your reply in two labeled parts (use exactly these headings): "
    "**From the verses (paraphrase):** — only restate what the provided translations say, verse by verse if needed. "
    "**Reflection:** — at most 2 short sentences of gentle personal reflection tied strictly to those meanings; "
    "label it clearly and do not present reflection as a literal Quranic quote. "
    "Do not stretch a verse to an unrelated theme (e.g. do not use the Khidr and Mūsā story about "
    "\"patience without knowledge\" to answer being wronged by other people unless that exact topic appears in the text). "
    "Where scholarly interpretation of a phrase differs, say briefly that interpretations differ; "
    "do not assert one reading as the only meaning. "
    "Never output HTML, XML, BBCode, or angle-bracket markup inside Arabic or English; "
    "plain text and markdown headings/bullets only. "
    "Do not invent or truncate Arabic phrases: for any Arabic words outside the supplied Uthmani lines, "
    "omit them rather than guessing."
)

_VERSE_CITATION_RE = re.compile(r"\[(\d{1,3}):(\d{1,3})\]|\b(\d{1,3})\s*:\s*(\d{1,3})\b")

_META_URDU_ONLY = re.compile(
    r"^\s*(in urdu|urdu only|translate to urdu|urdu translation|in urdu please)\s*[.!?,]*\s*$",
    re.I,
)

_ISO_639_1_TO_EN = {
    "ur": "Urdu",
    "fr": "French",
    "ar": "Arabic",
    "es": "Spanish",
    "de": "German",
    "tr": "Turkish",
    "id": "Indonesian",
    "en": "English",
    "bn": "Bengali",
    "hi": "Hindi",
    "ms": "Malay",
}


def _translation_resource_map(settings: Settings) -> dict[str, int]:
    raw = (getattr(settings, "quran_chat_translation_resources_json", None) or "{}").strip()
    try:
        d = json.loads(raw)
    except json.JSONDecodeError:
        d = {}
    out: dict[str, int] = {}
    if isinstance(d, dict):
        for k, v in d.items():
            if isinstance(k, str):
                try:
                    iv = int(v)
                except (TypeError, ValueError):
                    continue
                if iv > 0:
                    out[k.lower().strip()[:8]] = iv
    ur = int(getattr(settings, "quran_urdu_translation_resource_id", 0) or 0)
    if ur > 0:
        out.setdefault("ur", ur)
    return out


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


def _is_thin_language_followup(text: str) -> bool:
    """
    Short follow-ups like 'in urdu tell that' — reuse prior user turn for /search, not this string.
    """
    t = (text or "").strip()
    if not t or len(t) > 180:
        return False
    low = t.lower()
    if re.search(r"\b(what|why|how|explain|describe|tell me about)\b.{25,}", low):
        return False
    if re.search(r"\bin urdu\b", low):
        return True
    if re.match(
        r"^\s*(translate|say|give|tell)\s+(me\s+)?(that|this|it)\s+(in|to)\s+urdu",
        low,
    ):
        return True
    if re.match(r"^\s*urdu\s+(version|translation|please)\b", low):
        return True
    return False


def _strip_search_boilerplate(q: str) -> str:
    t = re.sub(
        r"\b(please|kindly|tell me|can you|could you|would you|i want to know|what does the quran say|will you)\b",
        " ",
        q,
        flags=re.I,
    )
    t = re.sub(r"\s+", " ", t).strip(" ,.?!")
    return t[:280]


def _boost_search_query_for_topics(q: str) -> str:
    """
    Append English keywords for /search when the user uses Islamic terms or short topics,
    to reduce hits on disconnected surah headers (e.g. Hizb markers).
    """
    base = (q or "").strip()
    if not base:
        return base
    low = base.lower()
    tail: list[str] = []
    if re.search(r"\bsabr\b|صبر|patience|patient|endure|persever", low, re.I):
        tail.extend(["patience", "steadfast", "endure", "hardship"])
    if re.search(r"\banxiety\b|anxious|worried|worry|fear|afraid|grief|sad|distress", low, re.I):
        tail.extend(["mercy", "comfort", "heart", "fear God"])
    if re.search(r"\badab\b|manners|etiquette|respect|reverence", low, re.I):
        tail.extend(["manners", "respect", "Quran", "ask"])
    if re.search(
        r"\bgratitude\b|\bthankful\b|\bthanks\b|\bshukr\b|\bshukar\b|\bsukar\b|"
        r"\bmashkoor\b|\bshukriya\b|\bgrateful\b",
        low,
        re.I,
    ):
        tail.extend(["gratitude", "thankful", "blessings", "give thanks", "God"])
    seen: set[str] = set()
    add: list[str] = []
    for w in tail:
        wl = w.lower()
        if wl not in seen:
            seen.add(wl)
            add.append(w)
    if not add:
        return base[:280]
    return f"{base} {' '.join(add)}"[:280]


def _retrieval_message_for_search(message: str, history: list[ChatTurnIn]) -> str:
    if (_is_language_meta_only(message) or _is_thin_language_followup(message)) and history:
        for row in reversed(history[-12:]):
            if row.role != "user":
                continue
            c = row.content.strip()
            if not c:
                continue
            if _is_language_meta_only(c) or _is_thin_language_followup(c):
                continue
            return c
        return ""
    raw = _strip_search_boilerplate(message)
    return raw if len(raw) >= 2 else (message or "").strip()


def _clarify_relevance_message(user_message: str, answer_language: str | None) -> str:
    """
    Match clarify language to how the user wrote, not only UI `answer_language`
    (e.g. English question + Urdu reply locale should still get English clarify).
    """
    if _urdu_explicit_intent(user_message) or _wants_urdu(user_message):
        return _CLARIFY_RELEVANCE_UR
    return _CLARIFY_RELEVANCE


def _sanitize_model_answer(text: str) -> str:
    """Strip leaked markup / known corruption patterns from model output."""
    if not text:
        return text
    t = re.sub(r"(?i)bibr+", "", text)
    t = re.sub(r"<[^>\n]{0,400}?>", "", t)
    t = re.sub(r"</[a-zA-Z]{1,20}>", "", t)
    # Models sometimes inject digit runs after tatweel/kashida/diacritics (e.g. "تَــ077", "غَفُ077").
    for _ in range(6):
        t2 = re.sub(
            r"(?:[\u0640\u064B-\u0652\u0670]|ـ|-){1,}\s*0*\d{2,3}\b",
            "",
            t,
        )
        t2 = re.sub(r"(?<=[\u0600-\u06FF])[\u064B-\u065F]{1,6}\s*0*\d{2,3}\b", "", t2)
        if t2 == t:
            break
        t = t2
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t.strip()


def _latin_letter_ratio(text: str) -> float:
    t = text or ""
    letters = sum(1 for c in t if c.isalpha())
    latin = sum(1 for c in t if "a" <= c <= "z" or "A" <= c <= "Z")
    return latin / max(1, letters)


_ROMAN_URDU_PARTICLE_RE = re.compile(
    r"\b(ka|ke|ki|ko|se|par|mein|mai|liya|leya|liye|keliye|wala|walay|hai|kya|"
    r"tum|hum|mujhe|mera|apna|batao|batayein)\b",
    re.I,
)


def _roman_urdu_needs_english_search_bridge(text: str) -> bool:
    """
    Roman Urdu uses Latin letters but is not good for English /search; still run the bridge
    even when latin_letter_ratio would normally skip it.
    """
    if re.search(r"[\u0600-\u06FF]", text or ""):
        return False
    if _latin_letter_ratio(text) < 0.35:
        return False
    low = (text or "").lower()
    if not _ROMAN_URDU_PARTICLE_RE.search(low):
        return False
    return bool(
        re.search(
            r"\b(shukar|shukr|sukar|mashkor|shukriya|rahma|rehm|dua|namaz|roza|sawab|gunah|"
            r"quran|sabr|allah|khuda|nabi|risalah|iman|ibadat)\b",
            low,
            re.I,
        )
    )


def _resolve_translation_resource_id(
    settings: Settings,
    message: str,
    *,
    answer_language: str | None,
    translation_resource_id: int | None,
) -> int | None:
    if translation_resource_id is not None and int(translation_resource_id) > 0:
        return int(translation_resource_id)
    lang_map = _translation_resource_map(settings)
    if answer_language:
        code = answer_language.strip().lower()[:2]
        if code in lang_map:
            return lang_map[code]
    if _wants_urdu(message):
        ur = int(getattr(settings, "quran_urdu_translation_resource_id", 0) or 0)
        return ur if ur > 0 else None
    return None


def _urdu_explicit_intent(text: str) -> bool:
    """User asked for Urdu (meta phrase), not script-only detection."""
    t = (text or "").strip()
    if _META_URDU_ONLY.match(t):
        return True
    return bool(re.search(r"\bin urdu\b", t.lower(), re.I))


def _answer_language_phrase(message: str, answer_language: str | None) -> str:
    # Prefer explicit "in urdu" over browser locale (often English OS).
    if _urdu_explicit_intent(message):
        return "Urdu"
    if answer_language and answer_language.strip():
        al = answer_language.strip()
        if len(al) == 2:
            return _ISO_639_1_TO_EN.get(al.lower(), al)
        return al
    if _wants_urdu(message):
        return "Urdu"
    return "the same primary language the user used in their latest message (match their language)"


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


def _expand_primary_keys_with_neighbors(primary_keys: list[str], settings: Settings) -> list[str]:
    if not getattr(settings, "quran_chat_neighbor_context_enabled", False):
        return primary_keys
    cap = max(3, int(getattr(settings, "quran_chat_neighbor_max_verses", 9)))
    seen: set[str] = set()
    ordered: list[str] = []
    for k in primary_keys:
        for nk in quran_service.adjacent_verse_keys(k):
            if nk not in seen:
                seen.add(nk)
                ordered.append(nk)
            if len(ordered) >= cap:
                return ordered
    return ordered


async def _maybe_bridge_english_search_query(
    user_message: str,
    search_basis: str,
    settings: Settings,
) -> tuple[str, bool]:
    if not settings.quran_chat_query_bridge_enabled:
        return search_basis, False
    t = (user_message or "").strip()
    if len(t) < 10 and not _roman_urdu_needs_english_search_bridge(t):
        return search_basis, False
    if _latin_letter_ratio(t) >= float(settings.quran_chat_query_bridge_min_latin_ratio) and not (
        _roman_urdu_needs_english_search_bridge(t)
    ):
        return search_basis, False
    client: AsyncOpenAI = ai_service._client_or_raise()
    sys = (
        "You output exactly one line: a short English keyword phrase (max 14 words) suitable for "
        "full-text search in an English Quran translation. No quotes, no surah numbers unless the user gave them. "
        "No religious advice—search terms only."
    )
    user_content = f"User message:\n{t}\n\nPrior topic for search:\n{search_basis or t}"
    try:
        completion = await client.chat.completions.create(
            model=settings.longcat_model,
            messages=[{"role": "system", "content": sys}, {"role": "user", "content": user_content}],
            temperature=0.1,
            max_tokens=max(16, int(settings.quran_chat_query_bridge_max_tokens)),
        )
        choice = completion.choices[0].message.content
        line = (choice or "").strip().split("\n")[0].strip()
        line = re.sub(r"^[\"']|[\"']$", "", line)
        if len(line) < 3:
            return search_basis, False
        log.debug("chat/message query_bridge used latin_ratio=%.2f bridged=%r", _latin_letter_ratio(t), line[:120])
        return line[:280], True
    except Exception as e:
        log.warning("query bridge failed: %s", e)
        return search_basis, False


def _extract_json_object(raw: str) -> str | None:
    """Strip optional ```json fences and return the first {...} slice."""
    t = (raw or "").strip()
    if not t:
        return None
    t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.I)
    t = re.sub(r"\s*```\s*$", "", t)
    start = t.find("{")
    end = t.rfind("}")
    if start < 0 or end <= start:
        return None
    return t[start : end + 1]


def _parse_search_plan_json(blob: str) -> tuple[str | None, list[str], bool]:
    """
    Returns (search_phrase, topic_keywords, wants_verse_ref).
    Invalid or empty search_phrase => (None, [], False).
    """
    try:
        obj = json.loads(blob)
    except json.JSONDecodeError:
        return None, [], False
    if not isinstance(obj, dict):
        return None, [], False
    sp = obj.get("search_phrase")
    if not isinstance(sp, str):
        return None, [], False
    sp = re.sub(r"\s+", " ", sp).strip()
    if len(sp) < 2 or len(sp) > 280:
        return None, [], False
    kw_raw = obj.get("topic_keywords")
    keywords: list[str] = []
    if isinstance(kw_raw, list):
        for item in kw_raw[:12]:
            if isinstance(item, str) and (s := item.strip()) and len(s) <= 48:
                keywords.append(s)
    wvr = bool(obj.get("wants_verse_ref"))
    return sp, keywords, wvr


def _merge_planner_phrase_and_keywords(search_phrase: str, topic_keywords: list[str]) -> str:
    if not topic_keywords:
        return search_phrase[:280]
    seen: set[str] = {search_phrase.lower()}
    add: list[str] = []
    for w in topic_keywords:
        wl = w.lower()
        if wl in seen:
            continue
        seen.add(wl)
        add.append(w)
        if len(search_phrase) + 1 + len(" ".join(add)) > 260:
            break
    if not add:
        return search_phrase[:280]
    return f"{search_phrase} {' '.join(add)}"[:280]


async def _maybe_planned_search_basis(
    user_message: str,
    search_basis: str,
    history: list[ChatTurnIn],
    settings: Settings,
) -> tuple[str | None, bool]:
    """
    Optional LongCat JSON planner: English search phrase + topic keywords for /search.
    Returns (merged phrase or None, planner_used).
    """
    if not getattr(settings, "quran_chat_query_planner_enabled", False):
        return None, False
    t = (user_message or "").strip()
    if len(t) < 8:
        return None, False
    client: AsyncOpenAI = ai_service._client_or_raise()
    hist = _history_to_openai(history)[-8:]
    hist_txt = "\n".join(f"{m['role']}: {m['content'][:400]}" for m in hist)[:3500]
    sys = (
        "You help retrieve Quranic verses via a search API. Output a single JSON object only, no markdown, no prose. "
        'Schema: {"search_phrase": string, "wants_verse_ref": boolean, "topic_keywords": string[]}. '
        "search_phrase: max 14 words, English keywords only, suitable for full-text search in an English Quran "
        "translation (no advice, no invented ayah text). "
        "topic_keywords: 0–6 extra English tokens (synonyms/themes) that help recall, not full sentences. "
        "wants_verse_ref: true only if the user is clearly asking for a specific surah:ayah they named."
    )
    user_block = f"Latest user message:\n{t}\n\nRetrieval basis (may be shortened):\n{search_basis or t}\n\nRecent turns:\n{hist_txt or '(none)'}"
    max_tok = max(48, int(getattr(settings, "quran_chat_query_planner_max_tokens", 128)))
    try:
        completion = await client.chat.completions.create(
            model=settings.longcat_model,
            messages=[{"role": "system", "content": sys}, {"role": "user", "content": user_block}],
            temperature=0.15,
            max_tokens=max_tok,
        )
        raw = (completion.choices[0].message.content or "").strip()
        blob = _extract_json_object(raw)
        if not blob:
            return None, False
        sp, kws, wvr = _parse_search_plan_json(blob)
        if not sp:
            return None, False
        merged = _merge_planner_phrase_and_keywords(sp, kws)
        log.debug(
            "chat/message query_planner used wants_verse_ref=%s phrase=%r",
            wvr,
            merged[:120],
        )
        return merged, True
    except Exception as e:
        log.warning("query planner failed: %s", e)
        return None, False


async def _fetch_cards_for_keys(
    keys: list[str],
    settings: Settings,
    tr_override: int | None,
) -> list[RestVerseCard]:
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

    if not keys:
        return []
    fetched = await asyncio.gather(*[_one_verse(vk) for vk in keys])
    return [c for c in fetched if c is not None]


def _cards_plain_for_llm(verses: list[RestVerseCard]) -> str:
    lines = [f"[{c.reference}]\nUthmani: {c.ayah}\nTranslation: {c.translation}" for c in verses]
    return "\n\n".join(lines).strip()


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
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    oa: list[dict[str, str]] = [{"role": "system", "content": system_content}]
    oa.extend(_history_to_openai(history))
    oa.append({"role": "user", "content": user_tail})
    client: AsyncOpenAI = ai_service._client_or_raise()
    max_tok = max(64, int(max_tokens if max_tokens is not None else s.longcat_chat_max_tokens))
    temp = float(s.longcat_chat_temperature if temperature is None else temperature)
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


async def _alignment_yes_no(*, s: Settings, plain: str, answer: str) -> bool:
    client: AsyncOpenAI = ai_service._client_or_raise()
    sys = (
        "You validate whether an assistant answer stays within the evidence of given Quran translations. "
        "Reply with exactly YES if every substantive claim in the answer is supported by or paraphrases "
        "only those translations. Reply exactly NO if the answer adds theological claims, unrelated themes, "
        "or verse meanings not in the text. One word only: YES or NO."
    )
    user = f"--- Translations context ---\n{plain}\n\n--- Answer ---\n{answer}"
    try:
        completion = await client.chat.completions.create(
            model=s.longcat_model,
            messages=[{"role": "system", "content": sys}, {"role": "user", "content": user}],
            temperature=0.0,
            max_tokens=max(8, int(s.quran_chat_alignment_max_tokens)),
        )
        raw = (completion.choices[0].message.content or "").strip().upper()
        return raw.startswith("Y")
    except Exception as e:
        log.warning("alignment check failed: %s", e)
        return True


async def run_rest_rag_chat(
    *,
    user_message: str,
    history: list[ChatTurnIn],
    settings: Settings | None = None,
    answer_language: str | None = None,
    translation_resource_id: int | None = None,
) -> tuple[str, list[RestVerseCard]]:
    """
    Returns (answer, verses). Uses REST grounding only; LLM runs only when verse cards exist
    (except greeting short-circuit).
    """
    s = settings or get_settings()
    text = user_message.strip()
    bridge_used = False
    planner_used = False
    gate_action = "pass"

    if ai_service._is_greeting_or_meta_chat(text):
        return ai_service._GREETING_REPLY, []

    if not s.longcat_api_key:
        raise ValueError("LONGCAT_API_KEY is not configured")

    lim = max(1, min(int(s.quran_ai_max_verses), 5))
    tr_override = _resolve_translation_resource_id(
        s, text, answer_language=answer_language, translation_resource_id=translation_resource_id
    )

    search_q = _retrieval_message_for_search(text, history)
    keys = quran_service.verse_keys_from_natural_language_query(text, max_keys=lim)
    if (search_q or "").strip() and search_q.strip() != text.strip():
        extra = quran_service.verse_keys_from_natural_language_query(search_q, max_keys=lim)
        seen = set(keys)
        for k in extra:
            if k not in seen:
                seen.add(k)
                keys.append(k)
            if len(keys) >= lim:
                break
    keys = keys[:lim]
    planned_basis: str | None = None
    if not keys:
        planned_basis, planner_used = await _maybe_planned_search_basis(text, search_q or text, history, s)
    if planner_used and planned_basis:
        bridge_used = False
        effective_search = planned_basis
    else:
        bridged_q, bridge_used = await _maybe_bridge_english_search_query(text, search_q or text, s)
        effective_search = bridged_q if bridge_used else (search_q or text)
    search_api_q = _boost_search_query_for_topics(effective_search)

    if not keys and search_api_q:
        try:
            keys = await quran_service.search_verse_keys(search_api_q, limit=lim, settings=s)
        except httpx.HTTPError as e:
            log.warning("REST RAG search failed: %s", e)
            keys = []
    keys = keys[:lim]

    primary_keys = list(keys)
    if not primary_keys:
        log.info(
            "chat/message retrieval empty bridge_used=%s planner_used=%s search_len=%d",
            bridge_used,
            planner_used,
            len(search_api_q or ""),
        )
        return _EMPTY_ANSWER, []

    primary_cards = await _fetch_cards_for_keys(primary_keys, s, tr_override)
    if not primary_cards:
        return _EMPTY_ANSWER, []

    if s.quran_chat_relevance_gate_enabled and len(primary_cards) >= 2:
        query_for_score = f"{search_api_q}\n{text}"
        gate = apply_relevance_gate(
            query_for_score=query_for_score,
            translations=[c.translation for c in primary_cards],
            min_score=float(s.quran_chat_relevance_min_score),
            trim_to=max(1, int(s.quran_chat_relevance_trim_to)),
            gate_enabled=s.quran_chat_relevance_gate_enabled,
        )
        gate_action = gate.action
        if gate.action == "clarify":
            log.info(
                "chat/message relevance clarify bridge_used=%s primaries=%s",
                bridge_used,
                [c.reference for c in primary_cards],
            )
            return _clarify_relevance_message(text, answer_language), []
        if gate.action == "trim" and gate.verses_indices:
            idx_set = set(gate.verses_indices)
            primary_cards = [primary_cards[i] for i in sorted(idx_set) if i < len(primary_cards)]
            primary_keys = [c.reference for c in primary_cards]

    expanded_keys = _expand_primary_keys_with_neighbors(primary_keys, s)
    if expanded_keys != primary_keys:
        verses = await _fetch_cards_for_keys(expanded_keys, s, tr_override)
    else:
        verses = primary_cards

    if not verses:
        return _EMPTY_ANSWER, []

    plain = _cards_plain_for_llm(verses)
    allowed = _allowed_refs_from_verses(verses)
    ref_list = ", ".join(sorted(allowed))
    lang_phrase = _answer_language_phrase(text, answer_language)

    base_rules = (
        f"{_GOLDEN}\n\n{_ANSWER_POLICY}\n\n"
        "You are a concise Muslim assistant. Answer ONLY using the Quran context block below. "
        "Do not invent verses or translations. When you mention a verse, cite ONLY references that "
        f"appear in the context block (exactly: {ref_list}). Do not cite any other surah:ayah numbers. "
        f"Write the **entire** answer in {lang_phrase}, except keep Arabic Uthmani script as given. "
        "Do not paste HTML/XML/BBCode tags inside Arabic text."
    )
    system = base_rules + "\n\n--- Quran REST context ---\n" + plain
    user_tail = text + "\n\nAnswer using only the Quran context above."

    log.info(
        "chat/message rag bridge_used=%s planner_used=%s gate_action=%s verse_keys=%s",
        bridge_used,
        planner_used,
        gate_action,
        [v.reference for v in verses],
    )

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

    if s.quran_chat_alignment_check_enabled:
        ok = await _alignment_yes_no(s=s, plain=plain, answer=answer)
        if not ok:
            log.info("chat/message alignment rewrite")
            rewrite_sys = (
                base_rules
                + "\n\nYour prior answer went beyond the translations. Rewrite: keep **From the verses** "
                "strictly to paraphrase; shorten **Reflection** or omit if unsupported."
                + "\n\n--- Quran REST context ---\n"
                + plain
            )
            answer = await _chat_completion(
                s=s, system_content=rewrite_sys, history=history, user_tail=user_tail, temperature=0.25
            )

    return _sanitize_model_answer(answer), verses
