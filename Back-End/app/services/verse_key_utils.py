"""Shared surah:ayah key parsing helpers (single source for verse-key shape)."""

from __future__ import annotations

import re

VERSE_KEY_PATTERN = re.compile(r"^\d{1,3}:\d{1,3}$")


def is_valid_verse_key_shape(key: str) -> bool:
    return bool(VERSE_KEY_PATTERN.match(key.strip()))
