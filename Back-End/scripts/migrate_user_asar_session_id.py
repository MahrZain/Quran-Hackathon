"""Add users.asar_session_id if missing (SQLite). Run: python scripts/migrate_user_asar_session_id.py"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

from app.core.config import get_settings  # noqa: E402


def main() -> None:
    url = get_settings().database_url
    if not url.startswith("sqlite:///"):
        print("This migration only supports sqlite URLs.")
        sys.exit(1)
    path = url.replace("sqlite:///", "", 1)
    db_path = Path(path)
    if not db_path.is_absolute():
        db_path = root / db_path
    if not db_path.exists():
        print(f"No DB at {db_path}")
        sys.exit(1)
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    try:
        cur.execute("ALTER TABLE users ADD COLUMN asar_session_id VARCHAR(36)")
        print("Added column users.asar_session_id")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("Column users.asar_session_id already exists")
        else:
            raise
    conn.commit()
    conn.close()
    print("OK")


if __name__ == "__main__":
    main()
