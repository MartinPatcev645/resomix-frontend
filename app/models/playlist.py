"""
Playlist Models
===============

This module defines the Playlist and PlaylistTrack SQLAlchemy models for the Resomix application.
It handles playlist creation and management with support for track ordering and user associations.
"""

import uuid
from typing import List, Optional
from sqlalchemy import String, Boolean, Enum, ForeignKey, DateTime, DECIMAL, text
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class Playlist(Base):
    """
    Playlist model representing the playlists table
    """
    __tablename__ = "playlists"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    
    # Unique identifier
    uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    
    # Fields
    user_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), 
        ForeignKey("partners.id", ondelete="RESTRICT"), 
        nullable=False, 
        default=1, 
        index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # True once the owner has uploaded a custom cover (stored on the media server by playlist uuid).
    # Drives the frontend cover source: custom → seed-track cover → bundled default.
    has_custom_cover: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    type: Mapped[str] = mapped_column(Enum('custom', 'similarity', 'waiting_segments', name='playlist_type'), nullable=False, default='custom')
    
    # Foreign keys
    seed_track_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True)
    fork_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("playlists.uuid", ondelete="SET NULL"), nullable=True)
    forked_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    fork_count: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)
    num_tracks: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)
    play_time: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, default=0)
    
    # Timestamps
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    # Soft-delete marker: NULL = active, non-NULL = deleted at that time. User-facing reads
    # exclude soft-deleted playlists; the row is retained for history/quota reconciliation.
    deleted_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True, index=True, default=None)
    # For guest-created playlists (user_id IS NULL): the guest's visitor_id, used for daily-limit
    # enforcement and for reparenting to a user on login (then set NULL, user_id set).
    guest_visitor_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True, default=None)

    # Listed in the Library page, or reachable only by link. Decided ONCE at creation against the
    # plan's `library_playlists_max` and then left alone: deleting a visible playlist frees a slot
    # but never promotes a hidden one, so the state is not derivable from created_at ordering.
    is_library_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("1"))

    # Relationships
    seed_track: Mapped[Optional["Track"]] = relationship("Track", foreign_keys=[seed_track_id])
    # The fork relationship to another Playlist object uses the fork_id string referencing the uuid string
    fork: Mapped[Optional["Playlist"]] = relationship("Playlist", remote_side=[uuid], foreign_keys=[fork_id])
    playlist_tracks: Mapped[List["PlaylistTrack"]] = relationship("PlaylistTrack", back_populates="playlist", cascade="all, delete-orphan")
    
    def __init__(self, **kwargs):
        """Initialize playlist with auto-generated UUID if not provided."""
        if 'uuid' not in kwargs:
            kwargs['uuid'] = str(uuid.uuid4())
        super().__init__(**kwargs)
    
    def __repr__(self):
        return f"<Playlist(id={self.id}, uuid='{self.uuid}', name='{self.name}', type='{self.type}', user_id='{self.user_id}')>"


class PlaylistTrack(Base):
    """
    PlaylistTrack model representing the playlist_tracks table
    """
    __tablename__ = "playlist_tracks"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Composite primary key
    playlist_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("playlists.id", ondelete="CASCADE"), primary_key=True)
    track_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="CASCADE"), primary_key=True, index=True)
    
    # Fields
    position: Mapped[float] = mapped_column(DECIMAL(12, 6), nullable=False)  # High precision for efficient reordering
    score: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 8), nullable=True)  # Store similarity scores as decimal values
    
    # Relationships
    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="playlist_tracks")
    track: Mapped["Track"] = relationship("Track")
    
    def __repr__(self):
        return f"<PlaylistTrack(playlist_id={self.playlist_id}, track_id={self.track_id}, position={self.position})>"


class PlaylistEmbedToken(Base):
    """An owner-minted, revocable token that authorises embedding one playlist (pricing v2.1 G1).

    The embed widget used to fetch any playlist by UUID from the public route, so a Pro gate on the
    Embed button protected nothing — the button was gated, the data was not. This token moves the
    gate onto the data: a dedicated embed endpoint serves a playlist only when the token matches.

    It is **not** an authentication credential. It says "the owner authorised this playlist to be
    embedded", nothing more — the playlist must still be public to be served, so the token can never
    widen access beyond what the owner already published. Two independent conditions, neither
    redundant: `is_public` decides who may see it, the token decides whether it may be embedded.
    """

    __tablename__ = "playlist_embed_tokens"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    playlist_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("playlists.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    token: Mapped[str] = mapped_column(String(16), nullable=False, unique=True, index=True)
    created_by: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Soft revocation — the row survives so a withdrawn embed stays distinguishable from one that
    # was never minted.
    revoked_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    def __repr__(self) -> str:
        state = "revoked" if self.revoked_at else "active"
        return f"<PlaylistEmbedToken(playlist_id={self.playlist_id}, {state})>"
