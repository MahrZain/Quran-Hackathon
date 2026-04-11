#!/usr/bin/env python3
"""
Summarize persisted ASAR activity in SQLite (sessions, chat, streak rows).

Run from repo root or Back-End/:
  python scripts/verify_db_activity.py

Uses DATABASE_URL from the environment if set; otherwise sqlite:///./asar.db
relative to the Back-End directory.
"""

from __future__ import annotations

import os
import re
import sqlite3
import sys
from pathlib import Path

BACK_END = Path(__file__).resolve().parent.parent


def _db_path() -> Path:
    os.chdir(BACK_END)
    url = os.environ.get("DATABASE_URL", "sqlite:///./asar.db")
    m = re.match(r"sqlite:///(.+)", url.strip())
    if not m:
        print("This script only supports sqlite:/// URLs.", file=sys.stderr)
        sys.exit(1)
    p = Path(m.group(1))
    return p if p.is_absolute() else BACK_END / p


def main() -> None:
    db_path = _db_path()
    if not db_path.exists():
        print(f"No database at {db_path}", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    tables = ("user_sessions", "chat_messages", "streak_activities", "users")
    print(f"Database: {db_path}\n")
    for t in tables:
        try:
            n = cur.execute(f"SELECT COUNT(*) AS c FROM {t}").fetchone()["c"]
        except sqlite3.OperationalError:
            n = "(no such table)"
        print(f"  {t}: {n}")

    print("\nLatest chat_messages (up to 8):")
    try:
        rows = cur.execute(
            "SELECT id, session_id, role, substr(content,1,72) AS preview, created_at "
            "FROM chat_messages ORDER BY id DESC LIMIT 8"
        ).fetchall()
        for r in rows:
            print(
                f"    id={r['id']} role={r['role']} session={r['session_id'][:8]}… "
                f"at={r['created_at']}\n      {r['preview']!r}"
            )
    except sqlite3.OperationalError as e:
        print(f"    (skip: {e})")

    print("\nLatest streak_activities (up to 8):")
    try:
        rows = cur.execute(
            "SELECT id, session_id, activity_date, ayah_read FROM streak_activities "
            "ORDER BY id DESC LIMIT 8"
        ).fetchall()
        for r in rows:
            print(
                f"    id={r['id']} day={r['activity_date']} ayah={r['ayah_read']} "
                f"session={r['session_id'][:8]}…"
            )
    except sqlite3.OperationalError as e:
        print(f"    (skip: {e})")

    conn.close()
    print("\nOK — counts reflect what POST /chat and POST /streak persist.")


if __name__ == "__main__":
    main()
