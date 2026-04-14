"""Create SQLite tables. Run from Back-End: python scripts/init_db.py

Existing DBs: run `python scripts/migrate_user_onboarding.py` and `python scripts/migrate_reading_cursor.py` once after model changes.
"""

from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

from app.db.database import Base, engine  # noqa: E402
from app.models.domain import (  # noqa: F401, E402
    ChatMessage,
    ReadingDailyStat,
    StreakActivity,
    User,
    UserSession,
    VerseBookmark,
)


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db_path = root / "asar.db"
    print(f"Tables created. Expected DB file (if sqlite relative ./): {db_path}")


if __name__ == "__main__":
    main()
