"""
Track Models
============

This module defines the Track and TrackArtist SQLAlchemy models for the ResomiX application.
It handles track metadata storage including title, duration, BPM, musical key, and file paths,
with support for many-to-many relationships between tracks and artists.

Provides comprehensive track data modeling with proper foreign key relationships
to albums, labels, genres, and artists for the audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Track, TrackArtist models 
from sqlalchemy import Column, Integer, BigInteger, String, SmallInteger, ForeignKey, DateTime, Text, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base


class Track(Base):
    """
    Track model representing the tracks table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS tracks (
        id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        uuid          VARCHAR(36) NOT NULL UNIQUE,
        album_id      INT UNSIGNED,                -- NULL for singles
        label_id      INT UNSIGNED,
        genre_id      INT UNSIGNED,                -- Single genre per track
        title         VARCHAR(255) NOT NULL,
        year          YEAR,
        duration_sec  INT UNSIGNED,
        bpm           SMALLINT UNSIGNED,
        musical_key   VARCHAR(5),                  -- e.g. "C#m"
        file_path     VARCHAR(500) NOT NULL,       -- original / full file
        preview_path  VARCHAR(500),                -- 128kbps MP3 etc.
        file_size     BIGINT UNSIGNED,             -- bytes
        type          VARCHAR(50) NOT NULL DEFAULT 'electrobuzz', -- Track source type
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL,
        FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE SET NULL,
        FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE SET NULL,
        KEY idx_track_album  (album_id),
        KEY idx_track_label  (label_id),
        KEY idx_track_genre  (genre_id),
        KEY idx_track_title  (title),
        KEY idx_track_bpm    (bpm),
        KEY idx_track_key    (musical_key),
        KEY idx_track_type   (type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "tracks"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Unique identifier
    uuid = Column(String(36), nullable=False, unique=True, index=True)
    
    # Foreign keys (all nullable as per schema)
    album_id = Column(Integer, ForeignKey("albums.id", ondelete="SET NULL"), nullable=True, index=True)
    label_id = Column(Integer, ForeignKey("labels.id", ondelete="SET NULL"), nullable=True, index=True)
    genre_id = Column(Integer, ForeignKey("genres.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Fields
    title = Column(String(255), nullable=False, index=True)
    year = Column(Integer, nullable=True)  # YEAR type maps to Integer
    duration_sec = Column(Numeric(8, 3), nullable=True)
    bpm = Column(SmallInteger, nullable=True, index=True)
    musical_key = Column(String(5), nullable=True, index=True)
    file_path = Column(String(500), nullable=False)
    preview_path = Column(String(500), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    type = Column(String(50), nullable=False, default='electrobuzz', index=True)  # Track source type
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    # Relationships
    album = relationship("Album", back_populates="tracks")
    label = relationship("Label", back_populates="tracks")
    genre = relationship("Genre", back_populates="tracks")
    
    # Many-to-many relationship with artists through track_artists
    track_artists = relationship("TrackArtist", back_populates="track", cascade="all, delete-orphan")
    artists = relationship("Artist", secondary="track_artists", viewonly=True)
    
    # One-to-one relationship with external platform track IDs
    transfer_track = relationship("PlaylistTransferTrack", back_populates="track", uselist=False, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Track(id={self.id}, title='{self.title}', uuid='{self.uuid}', type='{self.type}')>"


class TrackArtist(Base):
    """
    TrackArtist model representing the track_artists many-to-many table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS track_artists (
        track_id  BIGINT UNSIGNED NOT NULL,
        artist_id INT UNSIGNED    NOT NULL,
        PRIMARY KEY (track_id, artist_id),
        FOREIGN KEY (track_id)  REFERENCES tracks(id)  ON DELETE CASCADE,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "track_artists"
    
    # Composite primary key
    track_id = Column(BigInteger, ForeignKey("tracks.id", ondelete="CASCADE"), primary_key=True)
    artist_id = Column(Integer, ForeignKey("artists.id", ondelete="CASCADE"), primary_key=True)
    
    # Relationships
    track = relationship("Track", back_populates="track_artists")
    artist = relationship("Artist", back_populates="track_artists")
    
    def __repr__(self):
        return f"<TrackArtist(track_id={self.track_id}, artist_id={self.artist_id})>" 