"""
Playlist Engagement Models
==========================

This module defines the UserPlaylistEngagement SQLAlchemy model for the Resomix application.
It handles user engagement with playlists including favorites and follows.

Provides playlist engagement data modeling with relationships between users and playlists
for tracking favorite and follow states in the audio similarity system.

Version: 3.0.1
Init Date: November 04, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from sqlalchemy import Column, BigInteger, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base


class UserPlaylistEngagement(Base):
    """
    UserPlaylistEngagement model representing the user_playlist_engagements table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS user_playlist_engagements (
        user_id            BIGINT UNSIGNED NOT NULL,
        playlist_id        BIGINT UNSIGNED NOT NULL,
        is_favorite        TINYINT(1) NOT NULL DEFAULT 0,
        is_following       TINYINT(1) NOT NULL DEFAULT 0,
        favorite_at        DATETIME DEFAULT NULL,
        unfavorite_at      DATETIME DEFAULT NULL,
        followed_at        DATETIME DEFAULT NULL,
        unfollowed_at      DATETIME DEFAULT NULL,
        created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, playlist_id),
        FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id)  ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "user_playlist_engagements"
    
    # Composite primary key
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    playlist_id = Column(BigInteger, ForeignKey("playlists.id", ondelete="CASCADE"), primary_key=True)
    
    # Current states
    is_favorite = Column(Boolean, nullable=False, default=False)
    is_following = Column(Boolean, nullable=False, default=False)
    
    # State transition timestamps (last time each state became true/false)
    favorite_at = Column(DateTime, nullable=True)
    unfavorite_at = Column(DateTime, nullable=True)
    followed_at = Column(DateTime, nullable=True)
    unfollowed_at = Column(DateTime, nullable=True)
    
    # Metadata timestamps
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    playlist = relationship("Playlist", foreign_keys=[playlist_id])
    
    def __repr__(self):
        return f"<UserPlaylistEngagement(user_id={self.user_id}, playlist_id={self.playlist_id}, is_favorite={self.is_favorite}, is_following={self.is_following})>"

