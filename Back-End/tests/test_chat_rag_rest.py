"""Unit tests for REST chat retrieval helpers (no HTTP)."""

from app.core.config import Settings
from app.models.schemas import ChatTurnIn
from app.services.chat_rag_rest import (
    _answer_language_phrase,
    _boost_search_query_for_topics,
    _clarify_relevance_message,
    _extract_json_object,
    _is_thin_language_followup,
    _latin_letter_ratio,
    _merge_planner_phrase_and_keywords,
    _parse_search_plan_json,
    _resolve_translation_resource_id,
    _retrieval_message_for_search,
    _roman_urdu_needs_english_search_bridge,
    _sanitize_model_answer,
    _translation_resource_map,
    _wants_urdu,
)


def test_wants_urdu_phrases_and_script():
    assert _wants_urdu("explain in urdu")
    assert _wants_urdu("In Urdu please.")
    assert _wants_urdu("یہ کیا ہے")
    assert not _wants_urdu("what does2:255 mean")


def test_retrieval_uses_prior_user_turn_for_language_meta():
    h = [
        ChatTurnIn(role="user", content="surah ikhlas"),
        ChatTurnIn(role="assistant", content="Here is surah Ikhlas."),
    ]
    assert _retrieval_message_for_search("in urdu", h) == "surah ikhlas"


def test_retrieval_in_urdu_tell_that_reuses_prior_user_question():
    h = [
        ChatTurnIn(
            role="user",
            content="What adab should I keep when opening the Quran?",
        ),
        ChatTurnIn(role="assistant", content="From verses 18:76 and 5:101 ..."),
    ]
    assert _is_thin_language_followup("in urdu tell that")
    q = _retrieval_message_for_search("in urdu tell that", h)
    assert "adab" in q.lower() or "quran" in q.lower()


def test_sanitize_strips_bibr_and_tags():
    raw = "Arabic أَbibr>bibrbibr>text <b>x</b> end"
    out = _sanitize_model_answer(raw)
    assert "bibr" not in out.lower()
    assert "<b>" not in out


def test_sanitize_strips_tatweel_digit_garbage():
    raw = "لَا تَــ077 وَٱللَّهُ غَفُ077"
    out = _sanitize_model_answer(raw)
    assert "077" not in out


def test_sanitize_strips_markdown_artifacts():
    raw = (
        "**From the verses (paraphrase):**\n"
        "— line\n"
        "## Reflection:\n"
        "x __y__\n"
        "### z"
    )
    out = _sanitize_model_answer(raw)
    assert "**" not in out
    assert "__" not in out
    assert "From the verses (paraphrase):" in out
    assert not out.lstrip().startswith("#")


def test_boost_search_adds_patience_synonyms_for_sabr():
    q = _boost_search_query_for_topics("verses about sabr")
    assert "patience" in q.lower()
    assert "steadfast" in q.lower()


def test_clarify_urdu_when_explicit_intent():
    assert "سورۃ" in _clarify_relevance_message("in urdu please", "en")
    assert "rephrase" in _clarify_relevance_message("what is patience", "en").lower()


def test_clarify_english_when_ui_urdu_but_question_in_english():
    msg = "What does the Quran say about gratitude and Allah's mercy?"
    out = _clarify_relevance_message(msg, "ur")
    assert "rephrase" in out.lower()
    assert "سورۃ" not in out


def test_boost_adds_gratitude_keywords_for_shukar():
    q = _boost_search_query_for_topics("shukar ka leya roman urdu")
    assert "gratitude" in q.lower() or "thankful" in q.lower()


def test_roman_urdu_triggers_search_bridge_heuristic():
    assert _roman_urdu_needs_english_search_bridge("shukar ka leya")
    assert not _roman_urdu_needs_english_search_bridge("pure English gratitude verses please")


def test_retrieval_strips_boilerplate():
    assert _retrieval_message_for_search("please tell me surah 112", []) == "surah 112"


def test_latin_letter_ratio():
    assert _latin_letter_ratio("hello world") >= 0.99
    assert _latin_letter_ratio("السلام") < 0.2


def test_translation_resource_map_json_and_urdu_merge():
    s = Settings(
        quran_chat_translation_resources_json='{"fr": 31}',
        quran_urdu_translation_resource_id=131,
    )
    m = _translation_resource_map(s)
    assert m["fr"] == 31
    assert m["ur"] == 131


def test_resolve_translation_explicit_and_iso():
    s = Settings(
        quran_translation_resource_id=85,
        quran_urdu_translation_resource_id=131,
        quran_chat_translation_resources_json='{"fr": 40}',
    )
    assert _resolve_translation_resource_id(s, "hello", answer_language=None, translation_resource_id=99) == 99
    assert _resolve_translation_resource_id(s, "hello", answer_language="fr", translation_resource_id=None) == 40


def test_answer_language_phrase():
    assert "Urdu" in _answer_language_phrase("in urdu please", None)
    assert _answer_language_phrase("in urdu please", "en") == "Urdu"
    assert _answer_language_phrase("hi", "fr") == "French"


def test_extract_json_object_strips_fence():
    raw = '```json\n{"search_phrase": "patience"}\n```'
    blob = _extract_json_object(raw)
    assert blob is not None
    sp, _, _ = _parse_search_plan_json(blob)
    assert sp == "patience"


def test_parse_search_plan_json_valid():
    blob = '{"search_phrase":"mercy comfort","wants_verse_ref":false,"topic_keywords":["steadfast","hardship"]}'
    sp, kws, wvr = _parse_search_plan_json(blob)
    assert sp == "mercy comfort"
    assert "steadfast" in kws
    assert wvr is False


def test_parse_search_plan_json_rejects_bad():
    assert _parse_search_plan_json("{}")[0] is None
    assert _parse_search_plan_json("not json")[0] is None


def test_merge_planner_phrase_and_keywords_dedupes():
    out = _merge_planner_phrase_and_keywords("patience", ["patience", "sabr"])
    assert "patience" in out
    assert "sabr" in out.lower()
