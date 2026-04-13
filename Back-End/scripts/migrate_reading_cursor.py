"""Add reading cursor columns + reading_daily_stats table (SQLite). Idempotent.

Run from Back-End: python scripts/migrate_reading_cursor.py
"""

from pathlib import Path
import sqlite3
import sys

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

from app.core.config import get_settings  # noqa: E402


def main() -> None:
    url = get_settings().database_url
    if not url.startswith("sqlite"):
        print("This script only supports sqlite DATABASE_URL.")
        sys.exit(1)
    path = url.replace("sqlite:///", "", 1)
    if path.startswith("./"):
        path = str(root / path[2:])
    elif not path.startswith("/"):
        path = str(root / path)

    conn = sqlite3.connect(path)
    try:
        cur = conn.execute("PRAGMA table_info(users)")
        existing = {row[1] for row in cur.fetchall()}
        adds = [
            ("reading_cursor_surah", "INTEGER"),
            ("reading_cursor_ayah", "INTEGER"),
            ("reading_start_surah", "INTEGER"),
            ("reading_start_ayah", "INTEGER"),
            ("reading_scope", "VARCHAR(24)"),
            ("reading_scope_surah", "INTEGER"),
        ]
        for col, typ in adds:
            if col in existing:
                print(f"skip (exists): users.{col}")
                continue
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} {typ}")
            print(f"added: users.{col}")

        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='reading_daily_stats'"
        )
        if cur.fetchone():
            print("skip (exists): reading_daily_stats table")
        else:
            conn.execute(
                """
                CREATE TABLE reading_daily_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    activity_date DATE NOT NULL,
                    marks_count INTEGER NOT NULL DEFAULT 0,
                    UNIQUE (user_id, activity_date)
                )
                """
            )
            conn.execute("CREATE INDEX ix_reading_daily_stats_user_id ON reading_daily_stats (user_id)")
            conn.execute(
                "CREATE INDEX ix_reading_daily_stats_activity_date ON reading_daily_stats (activity_date)"
            )
            print("created: reading_daily_stats")

        conn.commit()
    finally:
        conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
