"""
Spotify App Models
==================

SQLAlchemy models for managing multiple Spotify apps and user associations.
Maps to the `spotify_apps` and `user_spotify_apps` tables.

This allows handling more than 25 users by distributing them across multiple
Spotify apps, as Spotify's development mode only allows 25 users per app.

Version: 3.0.1
Init Date: November 14, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from sqlalchemy import (
    String,
    ForeignKey,
    DateTime,
    Boolean,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from typing import List, Optional

from . import Base


class SpotifyApp(Base):
    """Spotify app configuration for managing multiple apps."""

    __tablename__ = "spotify_apps"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    client_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    client_secret: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    user_count: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # Relationships
    user_associations: Mapped[List["UserSpotifyApp"]] = relationship(
        "UserSpotifyApp",
        back_populates="spotify_app",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<SpotifyApp(id={self.id}, name='{self.name}', user_count={self.user_count})>"


class UserSpotifyApp(Base):
    """Association between users and specific Spotify apps."""

    __tablename__ = "user_spotify_apps"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    spotify_app_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("spotify_apps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # Relationships
    spotify_app: Mapped["SpotifyApp"] = relationship("SpotifyApp", back_populates="user_associations")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="spotify_app_association")
    created_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by], viewonly=True)

    def __repr__(self) -> str:
        return (
            f"<UserSpotifyApp(user_id={self.user_id}, "
            f"spotify_app_id={self.spotify_app_id})>"
        )

