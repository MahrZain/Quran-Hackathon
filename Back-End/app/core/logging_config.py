"""File-based logging under Back-End/logs/: app.log, warning.log, error.log (+ console)."""

from __future__ import annotations

import logging
import logging.handlers
from pathlib import Path

_LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_DATEFMT = "%Y-%m-%d %H:%M:%S"

_configured = False


def _log_dir() -> Path:
    base = Path(__file__).resolve().parents[2]
    d = base / "logs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def setup_logging() -> None:
    """
    Configure the ``app`` logger tree: INFO+ to console and app.log;
    WARNING+ also to warning.log; ERROR+ also to error.log.
    Rotating files (5 MB x 5 backups).
    """
    global _configured
    if _configured:
        return
    _configured = True

    root_app = logging.getLogger("app")
    root_app.setLevel(logging.DEBUG)
    root_app.handlers.clear()
    root_app.propagate = False

    formatter = logging.Formatter(_LOG_FORMAT, datefmt=_DATEFMT)
    log_dir = _log_dir()

    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(formatter)

    app_file = logging.handlers.RotatingFileHandler(
        log_dir / "app.log",
        maxBytes=5_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    app_file.setLevel(logging.INFO)
    app_file.setFormatter(formatter)

    warn_file = logging.handlers.RotatingFileHandler(
        log_dir / "warning.log",
        maxBytes=5_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    warn_file.setLevel(logging.WARNING)
    warn_file.setFormatter(formatter)

    err_file = logging.handlers.RotatingFileHandler(
        log_dir / "error.log",
        maxBytes=5_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    err_file.setLevel(logging.ERROR)
    err_file.setFormatter(formatter)

    root_app.addHandler(console)
    root_app.addHandler(app_file)
    root_app.addHandler(warn_file)
    root_app.addHandler(err_file)

    root_app.info("ASAR logging ready — files: logs/app.log, logs/warning.log, logs/error.log")
