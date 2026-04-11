"""Create SQLite tables. Run from Back-End: python scripts/init_db.py"""

from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

from app.db.database import Base, engine  # noqa: E402
from app.models.domain import ChatMessage, StreakActivity, User, UserSession  # noqa: F401, E402


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db_path = root / "asar.db"
    print(f"Tables created. Expected DB file (if sqlite relative ./): {db_path}")


if __name__ == "__main__":
    main()
