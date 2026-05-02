"""
Release Track Model
===================

This module defines the ReleaseTrack SQLAlchemy model.
It handles junction mapping for releases and tracks.
"""

from typing import Optional
from sqlalchemy import String, ForeignKey, Enum, Boolean, DateTime
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class ReleaseTrack(Base):
    """
    ReleaseTrack model representing the release_tracks table
    """
    __tablename__ = "release_tracks"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    
    # Foreign keys
    release_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("releases.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Position metadata
    track_number: Mapped[Optional[int]] = mapped_column(mysql.SMALLINT(unsigned=True), nullable=True)
    disc_number: Mapped[Optional[int]] = mapped_column(mysql.SMALLINT(unsigned=True), default=1)
    sequence_num: Mapped[Optional[int]] = mapped_column(mysql.SMALLINT(unsigned=True), nullable=True)
    
    display_title_override: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    # Context
    release_context: Mapped[str] = mapped_column(
        Enum('Original', 'Single', 'Album', 'Compilation', 'Deluxe', 'Remaster', 'BonusTrack', 'HiddenTrack', 'Other'),
        default='Original'
    )
    
    is_bonus_track: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    is_hidden_track: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    
    deal_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    
    # Relationships
    release: Mapped["Release"] = relationship("Release", back_populates="release_track_assocs")
    track: Mapped["Track"] = relationship("Track", back_populates="release_assocs")

    def __repr__(self):
        return f"<ReleaseTrack(id={self.id}, release_id={self.release_id}, track_id={self.track_id})>"
