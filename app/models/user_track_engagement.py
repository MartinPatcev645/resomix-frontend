"""
User Track Engagement Model
============================

This module defines the UserTrackEngagement SQLAlchemy model.
Handles user engagement with individual tracks (favorites, follows).
"""

from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class UserTrackEngagement(Base):
    """
    UserTrackEngagement model representing the user_track_engagements table.
    Composite PK on (user_id, track_id) prevents duplicate favorites.
    """
    __tablename__ = "user_track_engagements"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Composite primary key
    user_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    track_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="RESTRICT"), primary_key=True)

    # Current states
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_following: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # State transition timestamps
    favorite_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    unfavorite_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    followed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    unfollowed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)

    # Metadata timestamps
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=True, server_default=func.current_timestamp())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, nullable=True, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    track: Mapped["Track"] = relationship("Track", foreign_keys=[track_id])

    def __repr__(self):
        return f"<UserTrackEngagement(user_id={self.user_id}, track_id={self.track_id}, is_favorite={self.is_favorite})>"
