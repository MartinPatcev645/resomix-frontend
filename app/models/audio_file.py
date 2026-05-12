"""
Audio File Model
================

This module defines the AudioFile SQLAlchemy model for the Resomix application.
It stores strictly streaming and download assets for tracks.
"""

from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime, Enum, Boolean, BigInteger
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class AudioFile(Base):
    """
    AudioFile model representing the audio_files table.
    """

    __tablename__ = "audio_files"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    
    # Foreign keys
    party_id: Mapped[str] = mapped_column(String(100), ForeignKey("parties.party_id"), nullable=False)
    ingest_log_id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), ForeignKey("ingest_logs.id"), nullable=False)
    track_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), 
        ForeignKey("partners.id", ondelete="RESTRICT"), 
        nullable=False, 
        default=1, 
        index=True
    )
    
    # Fields
    asset_class: Mapped[str] = mapped_column(
        Enum('Master', 'StreamingProfile', 'Ephemeral'), 
        default='Master', 
        nullable=False
    )
    expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True, index=True)
    
    # Storage location
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(1024), nullable=False) # UNIQUE KEY uq_audio_path (stored_path(512))
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Size & Integrity
    file_size_bytes: Mapped[Optional[int]] = mapped_column(mysql.BIGINT(unsigned=True), nullable=True)
    checksum_md5: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    checksum_sha256: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    
    # Audio Specifications
    duration_seconds: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    audio_codec: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    sample_rate: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    bit_depth: Mapped[Optional[int]] = mapped_column(mysql.SMALLINT(unsigned=True), nullable=True)
    channels: Mapped[Optional[int]] = mapped_column(mysql.TINYINT(unsigned=True), nullable=True)
    bitrate_kbps: Mapped[Optional[int]] = mapped_column(mysql.SMALLINT(unsigned=True), nullable=True)
    ddex_resource_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    # Relationships
    track: Mapped["Track"] = relationship("Track", back_populates="audio_files")
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])

    def __repr__(self):
        return f"<AudioFile(id={self.id}, track_id={self.track_id}, asset_class='{self.asset_class}')>"
