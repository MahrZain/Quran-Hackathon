"""Unit tests for REST chat retrieval helpers (no HTTP)."""

from app.models.schemas import ChatTurnIn
from app.services.chat_rag_rest import _retrieval_message_for_search, _wants_urdu


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


def test_retrieval_strips_boilerplate():
    assert _retrieval_message_for_search("please tell me surah 112", []) == "surah 112"
