import os
from datetime import datetime
from typing import Literal

LogLevel = Literal["INFO", "WARNING", "ERROR"]


class FileLogger:
    """Very small, dependency-free file logger.

    Typical usage:
    >>> logger = FileLogger("timing.txt")
    >>> logger.info("GET /tracks 0.123s")
    """

    def __init__(self, filename: str):
        self.filename = filename
        # Ensure file exists so that external tail/monitor commands do not fail
        if not os.path.exists(self.filename):
            # Create directory path if necessary
            os.makedirs(os.path.dirname(self.filename) or ".", exist_ok=True)
            open(self.filename, "w").close()

    def _write(self, level: LogLevel, message: str) -> None:
        timestamp = datetime.utcnow().isoformat(sep=" ", timespec="seconds")
        with open(self.filename, "a", encoding="utf-8") as fp:
            fp.write(f"{timestamp} {level} {message}\n")

    def info(self, message: str) -> None:
        self._write("INFO", message)

    def warning(self, message: str) -> None:
        self._write("WARNING", message)

    def error(self, message: str) -> None:
        self._write("ERROR", message)
