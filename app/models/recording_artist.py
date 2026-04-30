"""
RecordingArtist Model
=====================

This module defines the RecordingArtist SQLAlchemy model for the Resomix application.
It handles the many-to-many relationship between tracks and artists with additional
metadata like artist role and sequence number as defined in DDEX.

Version: 1.0.0
Init Date: April 30, 2026
Author: Antigravity
"""

from sqlalchemy import Column, BigInteger, String, SmallInteger, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from . import Base

class RecordingArtist(Base):
    """
    RecordingArtist model representing the recording_artists table (DDEX junction)
    """
    __tablename__ = "recording_artists"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    track_id = Column(
        BigInteger, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False
    )
    artist_id = Column(
        BigInteger, ForeignKey("artists.id", ondelete="CASCADE"), nullable=False
    )
    sequence_num = Column(SmallInteger, default=1)
    artist_role = Column(String(100), default='MainArtist')

    # Constraints
    __table_args__ = (
        UniqueConstraint('track_id', 'artist_id', name='uq_rec_artist'),
    )

    # Relationships
    track = relationship("Track", backref="recording_artist_assocs")
    artist = relationship("Artist", backref="recording_artist_assocs")

    def __repr__(self):
        return f"<RecordingArtist(track_id={self.track_id}, artist_id={self.artist_id}, role='{self.artist_role}')>"
