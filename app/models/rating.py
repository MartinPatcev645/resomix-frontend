"""
Rating Models
=============

This module defines the TrackRating and PlaylistRating SQLAlchemy models for the Resomix application.
It handles user rating storage for tracks and playlists with support for like/dislike functionality
and user-based rating tracking.
"""

from typing import Optional
from sqlalchemy import Text, SmallInteger, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class TrackRating(Base):
    """
    TrackRating model representing the track_ratings table
    """
    __tablename__ = "track_ratings"
    __table_args__ = (
        Index('idx_tr_user', 'user_id', 'track_id'),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    )
    
    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(mysql.TINYINT(unsigned=True), nullable=True)  # 0/1 for dislike/like
    
    # Foreign keys
    track_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False)
    playlist_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("playlists.id", ondelete="CASCADE"), nullable=True)
    
    # Timestamps
    rated_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    # Relationships
    track: Mapped["Track"] = relationship("Track")
    playlist: Mapped[Optional["Playlist"]] = relationship("Playlist")
    
    def __repr__(self):
        return f"<TrackRating(id={self.id}, user_id='{self.user_id}', track_id={self.track_id}, playlist_id={self.playlist_id}, rating={self.rating})>"


class PlaylistRating(Base):
    """
    PlaylistRating model representing the playlist_ratings table
    """
    __tablename__ = "playlist_ratings"
    __table_args__ = (
        Index('idx_pr_user', 'user_id', 'playlist_id'),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    )
    
    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(mysql.TINYINT(unsigned=True), nullable=True)  # 0-3 stars
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Optional user message/feedback
    
    # Foreign keys
    playlist_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    
    # Timestamps
    rated_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    # Relationships
    playlist: Mapped["Playlist"] = relationship("Playlist")
    
    def __repr__(self):
        return f"<PlaylistRating(id={self.id}, user_id='{self.user_id}', playlist_id={self.playlist_id}, rating={self.rating}, message='{self.message[:50] if self.message else None}')>"
