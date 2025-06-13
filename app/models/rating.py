"""
Rating Models
=============

This module defines the TrackRating and PlaylistRating SQLAlchemy models for the ResomiX application.
It handles user rating storage for tracks and playlists with support for like/dislike functionality
and user-based rating tracking.

Provides rating data modeling for user feedback and recommendation systems
in the audio similarity platform.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# TrackRating, PlaylistRating models 
from sqlalchemy import Column, Integer, BigInteger, String, SmallInteger, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base


class TrackRating(Base):
    """
    TrackRating model representing the track_ratings table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS track_ratings (
        id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id   CHAR(36),
        track_id  BIGINT UNSIGNED NOT NULL,
        rating    TINYINT UNSIGNED,      -- 0/1 "dislike/like"
        rated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
        KEY idx_tr_user (user_id, track_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "track_ratings"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id = Column(String(36), nullable=True)  # Supabase UUID, nullable for anonymous
    rating = Column(SmallInteger, nullable=True)  # 0/1 for dislike/like
    
    # Foreign keys
    track_id = Column(BigInteger, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False)
    
    # Timestamps
    rated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    # Relationships
    track = relationship("Track")
    
    # Composite index for user_id and track_id (idx_tr_user)
    __table_args__ = (
        Index('idx_tr_user', 'user_id', 'track_id'),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}
    )
    
    def __repr__(self):
        return f"<TrackRating(id={self.id}, user_id='{self.user_id}', track_id={self.track_id}, rating={self.rating})>"


class PlaylistRating(Base):
    """
    PlaylistRating model representing the playlist_ratings table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS playlist_ratings (
        id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id    CHAR(36),
        playlist_id BIGINT UNSIGNED NOT NULL,
        rating     TINYINT UNSIGNED,     -- 0-3 stars
        rated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        KEY idx_pr_user (user_id, playlist_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "playlist_ratings"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id = Column(String(36), nullable=True)  # Supabase UUID, nullable for anonymous
    rating = Column(SmallInteger, nullable=True)  # 0-3 stars
    
    # Foreign keys
    playlist_id = Column(BigInteger, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    
    # Timestamps
    rated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    # Relationships
    playlist = relationship("Playlist")
    
    # Composite index for user_id and playlist_id (idx_pr_user)
    __table_args__ = (
        Index('idx_pr_user', 'user_id', 'playlist_id'),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}
    )
    
    def __repr__(self):
        return f"<PlaylistRating(id={self.id}, user_id='{self.user_id}', playlist_id={self.playlist_id}, rating={self.rating})>"
