"""Relevance gate scoring (no network)."""

from app.services.chat_retrieval_gates import apply_relevance_gate, verse_relevance_scores


def test_verse_relevance_scores_basic():
    scores = verse_relevance_scores(
        "merciful patient grateful",
        ["God is merciful", "unrelated astronomy", "be patient and grateful"],
    )
    assert scores[0] > 0
    assert scores[1] == 0.0
    assert scores[2] > scores[1]


def test_gate_clarify_when_weak_multi_hit():
    r = apply_relevance_gate(
        query_for_score="elephant bicycle",
        translations=["God is merciful", "the sky is blue"],
        min_score=0.15,
        trim_to=2,
        gate_enabled=True,
    )
    assert r.action == "clarify"
    assert r.verses_indices == []


def test_gate_pass_single_hit():
    r = apply_relevance_gate(
        query_for_score="anything",
        translations=["one verse only"],
        min_score=0.99,
        trim_to=2,
        gate_enabled=True,
    )
    assert r.action == "pass"
    assert r.verses_indices == [0]


def test_gate_disabled():
    r = apply_relevance_gate(
        query_for_score="x",
        translations=["a", "b"],
        min_score=0.99,
        trim_to=2,
        gate_enabled=False,
    )
    assert r.action == "pass"
    assert len(r.verses_indices) == 2
