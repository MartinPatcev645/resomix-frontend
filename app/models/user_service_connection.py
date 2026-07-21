"""
User Service Connection model
=============================

A single, provider-agnostic table (``user_service_connections``) for a user's linked external
music services — Apple Music today, Spotify / Tidal / rekordbox / Beatport / Deezer tomorrow — so
every new export target plugs in with ZERO schema change (just a new ``provider`` value +
provider-specific transfer logic).

Normalization: one row per ``(user_id, provider)`` (enforced by a unique constraint). Every column
depends only on that key (3NF). Provider-specific extras that don't need to be queried live in the
sparse ``meta`` JSON rather than as one-off columns.

Tokens are stored ENCRYPTED (Fernet, see ``app.utils.security_utils``):
  * ``access_token_enc``  — the primary credential (Apple Music User Token, Spotify access token, …).
  * ``refresh_token_enc`` — OAuth refresh token where the provider issues one (Spotify/Tidal); NULL
    for providers without one (Apple).
  * ``expires_at``        — when ``access_token`` expires (OAuth); NULL for long-lived tokens.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, Index, JSON
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from . import Base

if TYPE_CHECKING:
    from .user import User


class UserServiceConnection(Base):
    """A user's linked external music service (one row per user + provider)."""

    __tablename__ = "user_service_connections"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_user_service_connection"),
        Index("ix_user_service_connections_user_id", "user_id"),
        Index("ix_user_service_connections_provider", "provider"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)

    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Provider code — see app.models.constants.ServiceProvider (kept as a string, not a DB ENUM,
    # so adding a provider needs no migration).
    provider: Mapped[str] = mapped_column(String(30), nullable=False)

    # Credentials (encrypted at rest).
    access_token_enc: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_type: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)  # e.g. 'music_user_token', 'bearer'
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Provider account context.
    external_account_id: Mapped[Optional[str]] = mapped_column(String(191), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)   # storefront / market / country
    scopes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # granted OAuth scopes
    meta: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)          # sparse provider-specific extras

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<UserServiceConnection(user_id={self.user_id}, provider='{self.provider}')>"
