"""
Bandcamp connection model
=========================

One row per user who linked a PUBLIC Bandcamp fan collection (``bandcamp_connections``).

Deliberately not a ``user_service_connections`` row: that table is for OAuth export targets and
requires an encrypted access token. Bandcamp is read from public pages only — nothing here is a
credential, and no password or session is ever stored.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from . import Base


CONNECTION_PENDING = "pending"
CONNECTION_SYNCING = "syncing"
CONNECTION_READY = "ready"
CONNECTION_FAILED = "failed"


class BandcampConnection(Base):
    """A user's linked public Bandcamp username."""

    __tablename__ = "bandcamp_connections"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    bandcamp_username: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=CONNECTION_PENDING)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(mysql.TEXT, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    def to_dict(self) -> dict:
        return {
            "bandcamp_username": self.bandcamp_username,
            "status": self.status,
            "last_synced_at": self.last_synced_at.isoformat() if self.last_synced_at else None,
            "error_message": self.error_message,
        }
