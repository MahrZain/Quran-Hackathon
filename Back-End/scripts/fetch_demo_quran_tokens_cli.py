#!/usr/bin/env python3
"""
Fill DEMO_QURAN_ACCESS_TOKEN / DEMO_QURAN_REFRESH_TOKEN in Back-End/.env.

1) SQLite: prefer a user row with a non-empty quran_refresh_token (typical after “Continue with Quran.com”),
   else demo@asar.local if it has quran_access_token, else any user with access (latest id).
2) Else client_credentials (scope=content) — access only; no refresh_token from Hydra.

Run from Back-End:  python scripts/fetch_demo_quran_tokens_cli.py
"""

from __future__ import annotations

import re
import sqlite3
import sys
from pathlib import Path

import httpx

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

from app.core.config import get_settings  # noqa: E402


def _db_path() -> Path:
    url = get_settings().database_url
    if not url.startswith("sqlite:///"):
        raise SystemExit("Only sqlite DATABASE_URL supported")
    p = Path(url.replace("sqlite:///", "", 1))
    return p if p.is_absolute() else root / p


def _read_tokens_from_sqlite() -> tuple[str | None, str | None, str]:
    """Returns (access, refresh, source_label)."""
    db = _db_path()
    if not db.exists():
        return None, None, ""

    def row_ok(a: object, r: object) -> tuple[str | None, str | None]:
        acc = a if isinstance(a, str) and a.strip() else None
        ref = r if isinstance(r, str) and r.strip() else None
        return acc, ref

    conn = sqlite3.connect(str(db))
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT quran_access_token, quran_refresh_token, email FROM users
            WHERE quran_access_token IS NOT NULL AND trim(quran_access_token) != ''
              AND quran_refresh_token IS NOT NULL AND trim(quran_refresh_token) != ''
            ORDER BY id DESC LIMIT 1
            """
        )
        row = cur.fetchone()
        if row:
            acc, ref = row_ok(row[0], row[1])
            if acc:
                return acc, ref, f"sqlite (OAuth user: {row[2]})"

        cur.execute(
            """
            SELECT quran_access_token, quran_refresh_token FROM users
            WHERE lower(email) = ? AND quran_access_token IS NOT NULL AND trim(quran_access_token) != ''
            LIMIT 1
            """,
            ("demo@asar.local",),
        )
        row = cur.fetchone()
        if row:
            acc, ref = row_ok(row[0], row[1])
            if acc:
                return acc, ref, "sqlite (demo@asar.local)"

        cur.execute(
            """
            SELECT quran_access_token, quran_refresh_token FROM users
            WHERE quran_access_token IS NOT NULL AND trim(quran_access_token) != ''
            ORDER BY id DESC LIMIT 1
            """
        )
        row = cur.fetchone()
        if not row:
            return None, None, ""
        acc, ref = row_ok(row[0], row[1])
        if acc:
            return acc, ref, "sqlite (latest user with access token)"
        return None, None, ""
    finally:
        conn.close()


def _fetch_client_credentials_access() -> tuple[str | None, str | None]:
    s = get_settings()
    url = (s.quran_oauth_token_url or "").strip()
    cid = (s.quran_oauth_client_id or "").strip()
    csec = (s.quran_oauth_client_secret or "").strip()
    if not url or not cid or not csec:
        raise SystemExit("Set QURAN_OAUTH_TOKEN_URL, QURAN_OAUTH_CLIENT_ID, QURAN_OAUTH_CLIENT_SECRET in .env")
    scope = (s.quran_oauth_scope or "").strip() or "content"
    with httpx.Client(timeout=30.0) as c:
        r = c.post(
            url,
            data={"grant_type": "client_credentials", "scope": scope},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            auth=httpx.BasicAuth(cid, csec),
        )
        r.raise_for_status()
        body = r.json()
    tok = body.get("access_token")
    if not isinstance(tok, str) or not tok:
        raise SystemExit(f"No access_token in response: {body}")
    return tok, None  # client_credentials: no refresh_token from token endpoint


def _patch_env(env_path: Path, access: str | None, refresh: str | None) -> None:
    text = env_path.read_text(encoding="utf-8")

    def set_line(key: str, val: str | None) -> None:
        nonlocal text
        val = val or ""
        line = f"{key}={val}"
        if re.search(rf"^{re.escape(key)}=.*$", text, flags=re.M):
            text = re.sub(rf"^{re.escape(key)}=.*$", line, text, flags=re.M)
        else:
            if not text.endswith("\n"):
                text += "\n"
            text += line + "\n"

    set_line("DEMO_QURAN_ACCESS_TOKEN", access)
    set_line("DEMO_QURAN_REFRESH_TOKEN", refresh)
    env_path.write_text(text, encoding="utf-8")


def main() -> None:
    env_path = root / ".env"
    if not env_path.exists():
        raise SystemExit(f"No {env_path}")

    acc, ref, src = _read_tokens_from_sqlite()
    source = src or ""
    if not acc:
        acc, ref = _fetch_client_credentials_access()
        source = "client_credentials (scope=content)"
        ref = None  # Hydra does not issue refresh for this grant

    _patch_env(env_path, acc, ref)
    print(f"Updated {env_path} from {source}.")
    if not ref:
        print(
            "Note: no refresh_token in .env. Complete “Continue with Quran.com” (user row must have "
            "quran_refresh_token), then re-run this script."
        )


if __name__ == "__main__":
    main()
