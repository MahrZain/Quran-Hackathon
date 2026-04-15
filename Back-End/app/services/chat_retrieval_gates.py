"""Lexical relevance scoring for REST RAG verse hits (no embeddings)."""

from __future__ import annotations

import re
from dataclasses import dataclass

# Minimal English stopwords for overlap scoring (expand if needed).
_EN_STOP = frozenset(
    """
    a an the and or but if in on at to for of as is was are were be been being
    it its this that these those i you he she we they what which who whom when where
    why how all each every both few more most other some such no nor not only own same so
    than too very can could should would may might must shall will do does did doing
    about into through during before after above below from up down out off over under
    again further then once here there when where why all any both each few more most
    other some such
    """.split()
)


def _tokens(text: str) -> set[str]:
    raw = re.findall(r"[\w\u0600-\u06FF]+", (text or "").lower())
    return {t for t in raw if len(t) > 2 and t not in _EN_STOP}


def verse_relevance_scores(
    query_text: str,
    translations: list[str],
) -> list[float]:
    """One score per verse translation: |Q ∩ T| / max(1, |Q|)."""
    q = _tokens(query_text)
    if not q:
        return [0.0] * len(translations)
    scores: list[float] = []
    for tr in translations:
        tset = _tokens(tr)
        inter = len(q & tset)
        scores.append(inter / max(1, len(q)))
    return scores


@dataclass(frozen=True)
class RelevanceGateResult:
    verses_indices: list[int]
    action: str  # pass | trim | clarify


def apply_relevance_gate(
    *,
    query_for_score: str,
    translations: list[str],
    min_score: float,
    trim_to: int,
    gate_enabled: bool,
) -> RelevanceGateResult:
    """
    If gate disabled or min_score <= 0: pass all indices.
    Single verse: always pass.
    Multiple verses: if best score < min_score -> clarify.
    If best score ok but spread is bad: trim to top `trim_to` by score.
    """
    n = len(translations)
    if not gate_enabled or min_score <= 0.0 or n <= 1:
        return RelevanceGateResult(verses_indices=list(range(n)), action="pass")

    scores = verse_relevance_scores(query_for_score, translations)
    best = max(scores) if scores else 0.0
    if best < min_score:
        return RelevanceGateResult(verses_indices=[], action="clarify")

    order = sorted(range(n), key=lambda i: scores[i], reverse=True)
    # Many hits with modest overlap: keep top-N to reduce off-topic rationalization.
    if n > trim_to and best > 0 and scores[order[trim_to - 1]] < best * 0.45:
        return RelevanceGateResult(verses_indices=sorted(order[:trim_to]), action="trim")
    return RelevanceGateResult(verses_indices=list(range(n)), action="pass")
