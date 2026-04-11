"""Add quran_access_token / quran_refresh_token to users if missing (SQLite). Run: python scripts/migrate_user_quran_columns.py"""

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
    for col in ("quran_access_token", "quran_refresh_token"):
        try:
            cur.execute(f"ALTER TABLE users ADD COLUMN {col} TEXT")
            print(f"Added column users.{col}")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print(f"Column users.{col} already exists")
            else:
                raise
    conn.commit()
    conn.close()
    print("OK")


if __name__ == "__main__":
    main()
