from app.services.verse_key_utils import VERSE_KEY_PATTERN, is_valid_verse_key_shape


def test_verse_key_pattern_accepts_colon_form():
    assert VERSE_KEY_PATTERN.match("1:1")
    assert VERSE_KEY_PATTERN.match("114:6")


def test_is_valid_verse_key_shape_trims():
    assert is_valid_verse_key_shape("  2:255  ")
    assert not is_valid_verse_key_shape("x:y")
