"""
Store link model
================

One row per catalogue track that has a page on an outside download store, holding only the link
(the "Buy on ..." buttons). Traxsource first; Bandcamp fills its own column later.

Only the link is kept here, by decision (George, 9 Oct 2026). The full store data and the evidence
for every match stay in the matcher's SQLite files (`dj-sites-scraper`, `store_links.sqlite` and the
store copies on Alwyzon), which are what fill this table: see ``scripts/catalogue/load_store_links.py``.

Keyed by ``track_id`` (one row per track, either column may be NULL). A track with no row, or with
both columns NULL, shows no store button.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from . import Base


class TrackStoreLink(Base):
    """Outside store links for a catalogue track (``track_store_links``)."""

    __tablename__ = "track_store_links"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)

    track_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("tracks.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    traxsource_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    bandcamp_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    def __repr__(self) -> str:
        return f"<TrackStoreLink(track_id={self.track_id}, traxsource={bool(self.traxsource_url)}, bandcamp={bool(self.bandcamp_url)})>"
