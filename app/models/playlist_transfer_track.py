"""
Playlist Transfer Track Model
=============================

SQLAlchemy model for mapping tracks between internal and external platforms (Spotify, Apple Music, etc).
"""

from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base

if TYPE_CHECKING:
    from .track import Track


class PlaylistTransferTrack(Base):
    """
    Cross-platform mapping (Spotify/Apple ID) for playlist migration.
    """
    __tablename__ = "playlist_transfer_tracks"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Foreign key to track (also primary key for 1:1 relationship)
    track_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), 
        ForeignKey("tracks.id", ondelete="CASCADE"), 
        primary_key=True
    )
    
    # External Platform IDs
    spotify_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    apple_music_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    beatport_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    deezer_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    tidal_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        nullable=False, 
        server_default=func.current_timestamp(), 
        onupdate=func.current_timestamp()
    )

    # Relationship
    track: Mapped["Track"] = relationship("Track", back_populates="transfer_track")

    def __repr__(self):
        return f"<PlaylistTransferTrack(track_id={self.track_id}, spotify_id='{self.spotify_id}')>"
