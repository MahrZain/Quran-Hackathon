"""Add ledger_timezone to users (SQLite). Idempotent. Run: python scripts/migrate_user_ledger_timezone.py"""

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
        if "ledger_timezone" in existing:
            print("skip (exists): ledger_timezone")
        else:
            conn.execute("ALTER TABLE users ADD COLUMN ledger_timezone VARCHAR(64)")
            print("added: ledger_timezone")
        conn.commit()
    finally:
        conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
