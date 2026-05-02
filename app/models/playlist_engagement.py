"""
Playlist Engagement Models
==========================

This module defines the UserPlaylistEngagement SQLAlchemy model for the Resomix application.
It handles user engagement with playlists including favorites and follows.
"""

from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class UserPlaylistEngagement(Base):
    """
    UserPlaylistEngagement model representing the user_playlist_engagements table
    """
    __tablename__ = "user_playlist_engagements"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Composite primary key
    user_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    playlist_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("playlists.id", ondelete="CASCADE"), primary_key=True)
    
    # Current states
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_following: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    
    # State transition timestamps (last time each state became true/false)
    favorite_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    unfavorite_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    followed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    unfollowed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    
    # Metadata timestamps
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    playlist: Mapped["Playlist"] = relationship("Playlist", foreign_keys=[playlist_id])
    
    def __repr__(self):
        return f"<UserPlaylistEngagement(user_id={self.user_id}, playlist_id={self.playlist_id}, is_favorite={self.is_favorite}, is_following={self.is_following})>"
