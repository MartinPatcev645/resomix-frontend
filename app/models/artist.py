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
from sqlalchemy import Column, Integer, String
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
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    name = Column(String(100), nullable=False, unique=True, index=True)
    
    # Relationships
    albums = relationship("Album", back_populates="artist", cascade="all, delete-orphan")
    # Many-to-many relationship with tracks through track_artists
    track_artists = relationship("TrackArtist", back_populates="artist", cascade="all, delete-orphan")
    tracks = relationship("Track", secondary="track_artists", viewonly=True)
    
    def __repr__(self):
        return f"<Artist(id={self.id}, name='{self.name}')>" 