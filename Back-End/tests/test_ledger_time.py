"""Ledger timezone resolution for streak / daily counts."""

from app.core.config import Settings
from app.models.domain import User
from app.services.ledger_time import effective_ledger_timezone_name, resolve_ledger_zone


def test_effective_ledger_timezone_user_override():
    s = Settings(asar_ledger_timezone="Europe/London")
    u = User(email="a@b.c", password_hash="x", ledger_timezone="America/New_York")
    assert effective_ledger_timezone_name(s, u) == "America/New_York"


def test_effective_ledger_timezone_falls_back_to_settings():
    s = Settings(asar_ledger_timezone="Asia/Karachi")
    u = User(email="a@b.c", password_hash="x", ledger_timezone=None)
    assert effective_ledger_timezone_name(s, u) == "Asia/Karachi"


def test_effective_ledger_timezone_demo_user_none():
    s = Settings(asar_ledger_timezone="Pacific/Honolulu")
    assert effective_ledger_timezone_name(s, None) == "Pacific/Honolulu"


def test_invalid_user_override_skips_to_settings():
    s = Settings(asar_ledger_timezone="Asia/Karachi")
    u = User(email="a@b.c", password_hash="x", ledger_timezone="Not/AZone")
    _, name = resolve_ledger_zone(s, u)
    assert name == "Asia/Karachi"
