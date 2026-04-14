"""Create verse_bookmarks table (SQLite). Idempotent.

Run from Back-End: python scripts/migrate_verse_bookmarks.py
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
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='verse_bookmarks'"
        )
        if cur.fetchone():
            print("skip (exists): verse_bookmarks table")
        else:
            conn.execute(
                """
                CREATE TABLE verse_bookmarks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    surah_id INTEGER NOT NULL,
                    ayah_number INTEGER NOT NULL,
                    note TEXT,
                    created_at DATETIME NOT NULL,
                    quran_bookmark_id VARCHAR(64),
                    quran_sync_status VARCHAR(32) NOT NULL DEFAULT 'pending',
                    quran_synced_at DATETIME,
                    last_sync_error VARCHAR(512),
                    UNIQUE (user_id, surah_id, ayah_number)
                )
                """
            )
            conn.execute("CREATE INDEX ix_verse_bookmarks_user_id ON verse_bookmarks (user_id)")
            conn.execute("CREATE INDEX ix_verse_bookmarks_surah_id ON verse_bookmarks (surah_id)")
            conn.execute("CREATE INDEX ix_verse_bookmarks_ayah_number ON verse_bookmarks (ayah_number)")
            conn.execute(
                "CREATE INDEX ix_verse_bookmarks_quran_bookmark_id ON verse_bookmarks (quran_bookmark_id)"
            )
            conn.execute("CREATE INDEX ix_verse_bookmarks_created_at ON verse_bookmarks (created_at)")
            print("created: verse_bookmarks")

        conn.commit()
    finally:
        conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
