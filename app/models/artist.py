"""
Artist Model
============

This module defines the Artist SQLAlchemy model for the Resomix application.
It handles artist information storage with support for relationships to albums
and tracks through many-to-many associations.

Provides artist data modeling with proper foreign key relationships
for the audio similarity and metadata system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Artist model 
from sqlalchemy import Column, BigInteger, String, ForeignKey, Enum
from sqlalchemy.orm import relationship
from . import Base


class Artist(Base):
    """
    Artist model representing the artists table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS artists (
        id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        UNIQUE KEY uk_artist_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "artists"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    party_id = Column(String(100), ForeignKey("parties.party_id"), nullable=False, index=True)
    full_name = Column(String(512), nullable=False, index=True)
    isni = Column(String(30), nullable=True)
    ipn = Column(String(30), nullable=True)
    artist_type = Column(Enum("MainArtist","FeaturedArtist","Remixer","Composer","Lyricist","Producer","Conductor","Orchestra","Other", name="artist_type_enum"), default="MainArtist")
    
    # Relationships
    # Many-to-many relationship with tracks through recording_artists
    recording_artists = relationship("RecordingArtist", back_populates="artist", cascade="all, delete-orphan")
    tracks = relationship("Track", secondary="recording_artists", viewonly=True, overlaps="recording_artists")
    
    def __repr__(self):
        return f"<Artist(id={self.id}, full_name='{self.full_name}', type='{self.artist_type}')>"