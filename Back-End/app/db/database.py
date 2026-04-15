from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _make_engine():
    url = get_settings().database_url
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_engine(url, connect_args=connect_args, future=True)


def _ensure_sqlite_user_ledger_timezone(engine) -> None:
    """Idempotent ALTER for dev SQLite DBs created before ledger_timezone existed."""
    if not str(engine.url).startswith("sqlite"):
        return
    insp = inspect(engine)
    if not insp.has_table("users"):
        return
    names = {c["name"] for c in insp.get_columns("users")}
    if "ledger_timezone" in names:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN ledger_timezone VARCHAR(64)"))


engine = _make_engine()
_ensure_sqlite_user_ledger_timezone(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
