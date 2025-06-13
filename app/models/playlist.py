"""
Playlist Models
===============

This module defines the Playlist and PlaylistTrack SQLAlchemy models for the ResomiX application.
It handles playlist creation and management with support for track ordering and user associations.

Provides playlist data modeling with many-to-many relationships between playlists
and tracks for music organization in the audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Playlist, PlaylistTrack models 
from sqlalchemy import Column, Integer, BigInteger, String, Boolean, Enum, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base


class Playlist(Base):
    """
    Playlist model representing the playlists table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS playlists (
        id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id     CHAR(36),                         -- nullable (anon)
        name        VARCHAR(150) NOT NULL,
        is_public   TINYINT(1) DEFAULT 0,
        type        ENUM('custom','similarity') DEFAULT 'custom',
        seed_track_id BIGINT UNSIGNED,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seed_track_id) REFERENCES tracks(id) ON DELETE SET NULL,
        KEY idx_playlist_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "playlists"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id = Column(String(36), nullable=True, index=True)  # Supabase UUID, nullable for anonymous
    name = Column(String(150), nullable=False)
    is_public = Column(Boolean, nullable=False, default=False)
    type = Column(Enum('custom', 'similarity', name='playlist_type'), nullable=False, default='custom')
    
    # Foreign keys
    seed_track_id = Column(BigInteger, ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    # Relationships
    seed_track = relationship("Track", foreign_keys=[seed_track_id])
    playlist_tracks = relationship("PlaylistTrack", back_populates="playlist", cascade="all, delete-orphan")
    tracks = relationship("Track", secondary="playlist_tracks", viewonly=True)
    
    def __repr__(self):
        return f"<Playlist(id={self.id}, name='{self.name}', type='{self.type}', user_id='{self.user_id}')>"


class PlaylistTrack(Base):
    """
    PlaylistTrack model representing the playlist_tracks table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id BIGINT UNSIGNED NOT NULL,
        track_id    BIGINT UNSIGNED NOT NULL,
        position    INT UNSIGNED NOT NULL,
        PRIMARY KEY (playlist_id, track_id),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE CASCADE,
        KEY idx_pt_track (track_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "playlist_tracks"
    
    # Composite primary key
    playlist_id = Column(BigInteger, ForeignKey("playlists.id", ondelete="CASCADE"), primary_key=True)
    track_id = Column(BigInteger, ForeignKey("tracks.id", ondelete="CASCADE"), primary_key=True, index=True)
    
    # Fields
    position = Column(Integer, nullable=False)
    
    # Relationships
    playlist = relationship("Playlist", back_populates="playlist_tracks")
    track = relationship("Track")
    
    def __repr__(self):
        return f"<PlaylistTrack(playlist_id={self.playlist_id}, track_id={self.track_id}, position={self.position})>" 