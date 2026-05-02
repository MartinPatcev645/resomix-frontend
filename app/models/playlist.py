"""
Playlist Models
===============

This module defines the Playlist and PlaylistTrack SQLAlchemy models for the Resomix application.
It handles playlist creation and management with support for track ordering and user associations.
"""

import uuid
from typing import List, Optional
from sqlalchemy import String, Boolean, Enum, ForeignKey, DateTime, DECIMAL
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
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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
