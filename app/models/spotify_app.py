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
    Column,
    BigInteger,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Boolean,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from . import Base


class SpotifyApp(Base):
    """Spotify app configuration for managing multiple apps."""

    __tablename__ = "spotify_apps"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(String(255), nullable=True)
    client_id = Column(String(255), nullable=False, unique=True, index=True)
    client_secret = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    user_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # Relationships
    user_associations = relationship(
        "UserSpotifyApp",
        back_populates="spotify_app",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<SpotifyApp(id={self.id}, name='{self.name}', user_count={self.user_count})>"


class UserSpotifyApp(Base):
    """Association between users and specific Spotify apps."""

    __tablename__ = "user_spotify_apps"

    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    spotify_app_id = Column(
        Integer,
        ForeignKey("spotify_apps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # Relationships
    spotify_app = relationship("SpotifyApp", back_populates="user_associations")
    user = relationship("User", foreign_keys=[user_id], back_populates="spotify_app_association")
    created_by_user = relationship("User", foreign_keys=[created_by], viewonly=True)

    def __repr__(self) -> str:
        return (
            f"<UserSpotifyApp(user_id={self.user_id}, "
            f"spotify_app_id={self.spotify_app_id})>"
        )

