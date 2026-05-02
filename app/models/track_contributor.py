"""
Track Contributor Model
=======================

This module defines the TrackContributor SQLAlchemy model.
It handles junction mapping for tracks and contributors with role information.
"""

from typing import Optional
from sqlalchemy import Enum, ForeignKey, DECIMAL
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from . import Base


class TrackContributor(Base):
    """
    TrackContributor model representing the track_contributors table
    """
    __tablename__ = "track_contributors"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    
    # Foreign keys
    track_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    person_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("contributors.id"), nullable=False, index=True)
    
    # Role & Split
    role: Mapped[str] = mapped_column(
        Enum(
            'MainArtist', 'FeaturedArtist', 'Remixer', 'Conductor', 'Orchestra', 'Soloist',
            'Composer', 'Lyricist', 'ComposerLyricist', 'Arranger',
            'Producer', 'ExecutiveProducer', 'MixEngineer', 'MasteringEngineer', 'RecordingEngineer',
            'MusicPublisher', 'SubPublisher', 'AdministratingPublisher', 'Other'
        ),
        nullable=False, index=True
    )
    
    royalty_type: Mapped[str] = mapped_column(
        Enum(
            'MasterRights', 'NeighboringRights', 'Mechanical', 'Performance', 'Producer', 'Sync', 'Other'
        ),
        nullable=False
    )
    
    ownership_share: Mapped[Optional[float]] = mapped_column(DECIMAL(8, 5), nullable=True)
    sequence_num: Mapped[Optional[int]] = mapped_column(mysql.SMALLINT(unsigned=True), default=1)
    
    # Relationships
    track: Mapped["Track"] = relationship("Track", back_populates="recording_contributors")
    contributor: Mapped["Contributor"] = relationship("Contributor", back_populates="track_assocs")

    def __repr__(self):
        return f"<TrackContributor(id={self.id}, track_id={self.track_id}, person_id={self.person_id}, role='{self.role}')>"
