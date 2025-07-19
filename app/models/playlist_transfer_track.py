"""
Playlist Transfer Track Model
=============================

This model represents the playlist_transfer_tracks table that stores
external music platform track IDs for caching purposes during playlist transfers.
It prevents repeated searches on platforms like Spotify, Apple Music, etc.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from . import Base


class PlaylistTransferTrack(Base):
    """Model for external platform track ID caching"""
    
    __tablename__ = "playlist_transfer_tracks"
    
    # Primary key - links to tracks table
    track_id = Column(BigInteger, ForeignKey("tracks.id", ondelete="CASCADE"), primary_key=True)
    
    # External platform IDs
    spotify_id = Column(String(100), nullable=True, index=True)
    apple_music_id = Column(String(100), nullable=True, index=True)
    beatport_id = Column(String(100), nullable=True, index=True)
    deezer_id = Column(String(100), nullable=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.current_timestamp())
    updated_at = Column(DateTime, default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Relationships
    track = relationship("Track", back_populates="transfer_track")
    
    def __repr__(self):
        return f"<PlaylistTransferTrack(track_id={self.track_id}, spotify_id={self.spotify_id})>"
    
    def to_dict(self):
        """Convert to dictionary representation"""
        return {
            "track_id": self.track_id,
            "spotify_id": self.spotify_id,
            "apple_music_id": self.apple_music_id,
            "beatport_id": self.beatport_id,
            "deezer_id": self.deezer_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
