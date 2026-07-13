"""
Track Models
============

This module defines the Track SQLAlchemy model for the Resomix application.
It handles track metadata storage including title, duration, BPM, musical key, and file paths,
with support for many-to-many relationships between tracks and contributors.

Provides comprehensive track data modeling with proper foreign key relationships
to releases, genres, and contributors for the audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import List, Optional
from sqlalchemy import String, SmallInteger, ForeignKey, DateTime, JSON, Boolean, Numeric, Enum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class Track(Base):
    """
    Track model representing the tracks table.
    Stores recording-level metadata decoupled from releases and contributors.
    """

    __tablename__ = "tracks"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci", "mysql_row_format": "DYNAMIC"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)

    # Unique identifier
    uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)

    # Foreign keys
    user_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id"), nullable=True, index=True
    )
    party_id: Mapped[Optional[str]] = mapped_column(
        String(100), ForeignKey("parties.party_id"), nullable=True, index=True
    )
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), 
        ForeignKey("partners.id", ondelete="RESTRICT"), 
        nullable=False, 
        default=1, 
        index=True
    )

    # Fields
    resource_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    proprietary_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Original file location on the SOURCE server (e.g. the Electrobuzz catalogue) — the only
    # reference back to the master when the master isn't in our storage. Distinct from
    # audio_files.stored_path (which is a path in OUR storage).
    source_file_path: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)
    isrc: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(1024), nullable=False, index=True)
    version_title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    display_artist: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    duration_ms: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    
    bpm: Mapped[Optional[int]] = mapped_column(mysql.SMALLINT(unsigned=True), nullable=True, index=True)
    musical_key: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, index=True)
    key_signature: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    audio_language: Mapped[Optional[str]] = mapped_column(String(2), default="xx")
    language_of_lyrics: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    
    # Genre — FK → genres.id
    genre_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("genres.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    sub_genre_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("genres.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    price_cents: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), default=99)
    mix_name: Mapped[Optional[str]] = mapped_column(String(150), default="Original Mix")
    track_type: Mapped[Optional[str]] = mapped_column("type", String(50), default="electrobuzz")
    
    p_line_year: Mapped[Optional[int]] = mapped_column(mysql.YEAR, nullable=True)
    p_line_text: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    deal_terms: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    parental_warning: Mapped[Optional[str]] = mapped_column(
        Enum("NoAdviceAvailable", "NotExplicit", "Explicit", "ExplicitContentEdited"), 
        default="NotExplicit"
    )
    is_explicit: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    is_instrumental: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, default=True, index=True)
    
    ingestion_source: Mapped[Optional[str]] = mapped_column(
        Enum("ddex", "cc_by", "user_upload", "csv"),
        default="user_upload",
        index=True
    )
    
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=True, server_default=func.current_timestamp()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=True, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )



    # Genre relationships
    genre: Mapped[Optional["Genre"]] = relationship(
        "Genre", foreign_keys=[genre_id], lazy="joined"
    )
    sub_genre: Mapped[Optional["Genre"]] = relationship(
        "Genre", foreign_keys=[sub_genre_id], lazy="joined"
    )

    # Audio files associated with this track
    audio_files: Mapped[List["AudioFile"]] = relationship(
        "AudioFile", back_populates="track", cascade="all, delete-orphan", uselist=True
    )

    # Many-to-many relationship with releases through ReleaseTrack
    release_assocs: Mapped[List["ReleaseTrack"]] = relationship(
        "ReleaseTrack", back_populates="track", cascade="all, delete-orphan"
    )

    # Many-to-many relationship with contributors through TrackContributor
    recording_contributors: Mapped[List["TrackContributor"]] = relationship(
        "TrackContributor", back_populates="track", cascade="all, delete-orphan"
    )

    # One-to-one relationship with external platform track IDs
    transfer_track: Mapped[Optional["PlaylistTransferTrack"]] = relationship(
        "PlaylistTransferTrack",
        back_populates="track",
        uselist=False,
        cascade="all, delete-orphan",
    )
    
    # Uploader
    uploader: Mapped[Optional["User"]] = relationship(
        "User", back_populates="uploaded_tracks", foreign_keys=[user_id]
    )

    # Partner tenant owning this track
    partner: Mapped["Partner"] = relationship(
        "Partner", foreign_keys=[partner_id]
    )

    @property
    def genre_name(self) -> Optional[str]:
        """Convenience accessor — returns the genre name string (or None)."""
        return self.genre.name if self.genre else None

    @property
    def sub_genre_name(self) -> Optional[str]:
        """Convenience accessor — returns the sub-genre name string (or None)."""
        return self.sub_genre.name if self.sub_genre else None

    @property
    def duration(self) -> Optional[float]:
        """Convert duration_ms to seconds for API responses."""
        return self.duration_ms / 1000.0 if self.duration_ms is not None else None

    def __repr__(self):
        return f"<Track(id={self.id}, title='{self.title}', uuid='{self.uuid}')>"
