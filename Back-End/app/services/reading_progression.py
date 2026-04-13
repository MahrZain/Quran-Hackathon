"""Compute next verse from current position and reading scope."""

from __future__ import annotations

from dataclasses import dataclass

from app.services.surah_verse_counts import verse_count_for_surah


@dataclass(frozen=True)
class NextVerseResult:
    surah_id: int
    ayah_number: int
    at_scope_end: bool
    """True when there is no further verse in scope (cursor should stay on current)."""


def next_verse(
    surah_id: int,
    ayah_number: int,
    *,
    scope: str,
    scope_surah: int | None = None,
) -> NextVerseResult:
    """
    Return the verse after (surah_id, ayah_number) within scope.

    scope: full_mushaf | single_surah
    scope_surah: required when scope is single_surah (the surah being studied).
    """
    sc = (scope or "full_mushaf").strip().lower()
    if sc not in ("full_mushaf", "single_surah"):
        sc = "full_mushaf"

    vc = verse_count_for_surah(surah_id)
    if vc is None or ayah_number < 1:
        return NextVerseResult(surah_id=max(1, min(surah_id, 114)), ayah_number=1, at_scope_end=True)

    ay = min(ayah_number, vc)

    if sc == "single_surah":
        ss = scope_surah if scope_surah is not None else surah_id
        svc = verse_count_for_surah(ss) or 1
        if surah_id != ss:
            return NextVerseResult(surah_id=ss, ayah_number=min(ay, svc), at_scope_end=False)
        if ay < svc:
            return NextVerseResult(surah_id=ss, ayah_number=ay + 1, at_scope_end=False)
        return NextVerseResult(surah_id=ss, ayah_number=svc, at_scope_end=True)

    # full_mushaf
    if ay < vc:
        return NextVerseResult(surah_id=surah_id, ayah_number=ay + 1, at_scope_end=False)
    if surah_id < 114:
        return NextVerseResult(surah_id=surah_id + 1, ayah_number=1, at_scope_end=False)
    return NextVerseResult(surah_id=114, ayah_number=vc, at_scope_end=True)
