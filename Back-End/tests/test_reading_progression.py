"""Next-verse progression within mushaf / single-surah scope."""

from app.services.reading_progression import next_verse


def test_full_mushaf_within_surah():
    r = next_verse(1, 1, scope="full_mushaf", scope_surah=None)
    assert r.surah_id == 1 and r.ayah_number == 2 and not r.at_scope_end


def test_full_mushaf_wraps_to_next_surah():
    r = next_verse(1, 7, scope="full_mushaf", scope_surah=None)
    assert r.surah_id == 2 and r.ayah_number == 1 and not r.at_scope_end


def test_full_mushaf_end_of_quran():
    r = next_verse(114, 6, scope="full_mushaf", scope_surah=None)
    assert r.surah_id == 114 and r.ayah_number == 6 and r.at_scope_end


def test_single_surah_stops_at_last_ayah():
    r = next_verse(94, 8, scope="single_surah", scope_surah=94)
    assert r.surah_id == 94 and r.ayah_number == 8 and r.at_scope_end


def test_single_surah_advances():
    r = next_verse(94, 5, scope="single_surah", scope_surah=94)
    assert r.surah_id == 94 and r.ayah_number == 6 and not r.at_scope_end
