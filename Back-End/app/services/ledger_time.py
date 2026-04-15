"""Ledger calendar day: IANA timezone from settings and optional user override."""

from __future__ import annotations

import logging
from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import Settings
from app.models.domain import User

log = logging.getLogger(__name__)


def _zone_candidates(settings: Settings, user: User | None) -> list[str]:
    out: list[str] = []
    if user is not None and (user.ledger_timezone or "").strip():
        out.append((user.ledger_timezone or "").strip())
    raw = (settings.asar_ledger_timezone or "").strip()
    if raw:
        out.append(raw)
    out.extend(["Asia/Karachi", "UTC"])
    # de-dupe preserving order
    seen: set[str] = set()
    uniq: list[str] = []
    for name in out:
        if name in seen:
            continue
        seen.add(name)
        uniq.append(name)
    return uniq


def resolve_ledger_zone(settings: Settings, user: User | None) -> tuple[ZoneInfo, str]:
    """Return (ZoneInfo, canonical key) for the first resolvable candidate."""
    for name in _zone_candidates(settings, user):
        try:
            zi = ZoneInfo(name)
            return zi, name
        except ZoneInfoNotFoundError:
            log.warning("Invalid ledger timezone candidate %r — skipping", name)
    return ZoneInfo("UTC"), "UTC"


def effective_ledger_timezone_name(settings: Settings, user: User | None) -> str:
    return resolve_ledger_zone(settings, user)[1]


def today_in_ledger_tz(settings: Settings, user: User | None) -> date:
    zi, _ = resolve_ledger_zone(settings, user)
    return datetime.now(zi).date()
