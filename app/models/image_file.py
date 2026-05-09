"""
Image File Model
================

This module defines the ImageFile SQLAlchemy model for the Resomix application.
It strictly handles artwork and profile images.
"""

from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime, BigInteger
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class ImageFile(Base):
    """
    ImageFile model representing the image_files table.
    """

    __tablename__ = "image_files"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    
    # Foreign keys
    party_id: Mapped[str] = mapped_column(String(100), ForeignKey("parties.party_id"), nullable=False)
    ingest_log_id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), ForeignKey("ingest_logs.id"), nullable=False)
    
    # Storage location
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(1024), nullable=False) # UNIQUE KEY uq_image_path (stored_path(512))
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Size & Integrity
    file_size_bytes: Mapped[Optional[int]] = mapped_column(mysql.BIGINT(unsigned=True), nullable=True)
    checksum_md5: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    checksum_sha256: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    
    # Image Specifications
    image_width: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    image_height: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    color_depth: Mapped[Optional[int]] = mapped_column(mysql.TINYINT(unsigned=True), nullable=True)
    image_codec: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # DDEX Traceability
    ddex_resource_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    def __repr__(self):
        return f"<ImageFile(id={self.id}, stored_path='{self.stored_path}')>"
