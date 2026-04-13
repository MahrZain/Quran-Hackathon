"""Add onboarding columns to users (SQLite). Idempotent. Run: python scripts/migrate_user_onboarding.py"""

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
            ("onboarding_completed_at", "DATETIME"),
            ("onboarding_goal", "VARCHAR(32)"),
            ("onboarding_level", "VARCHAR(32)"),
            ("onboarding_time_budget", "VARCHAR(16)"),
            ("onboarding_journey_mode", "VARCHAR(32)"),
            ("onboarding_topic_tag", "VARCHAR(32)"),
        ]
        for col, typ in adds:
            if col in existing:
                print(f"skip (exists): {col}")
                continue
            sql = f"ALTER TABLE users ADD COLUMN {col} {typ}"
            conn.execute(sql)
            print(f"added: {col}")
        conn.commit()
    finally:
        conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
