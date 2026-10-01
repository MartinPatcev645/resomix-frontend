"""
Document File Model
===================

This module defines the DocumentFile SQLAlchemy model for the Resomix application.
It strictly handles DDEX XMLs, PDFs, Lyrics, etc.
"""

from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class DocumentFile(Base):
    """
    DocumentFile model representing the document_files table.
    """

    __tablename__ = "document_files"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    
    # Foreign keys
    party_id: Mapped[str] = mapped_column(String(100), ForeignKey("parties.party_id"), nullable=False)
    ingest_log_id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), ForeignKey("ingest_logs.id"), nullable=False)
    track_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True, index=True)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), 
        ForeignKey("partners.id", ondelete="RESTRICT"), 
        nullable=False, 
        default=1, 
        index=True
    )
    
    # Relationships
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])
    
    # Storage location
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(1024), nullable=False) # UNIQUE KEY uq_doc_path (stored_path(512))
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Size & Integrity
    file_size_bytes: Mapped[Optional[int]] = mapped_column(mysql.BIGINT(unsigned=True), nullable=True)
    checksum_md5: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    checksum_sha256: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    
    # DDEX Traceability
    ddex_resource_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Category for the admin file browser / analytics:
    # one embedding type per similarity index | "peaks" | "ingest_report" | "manifest_csv" | ...
    doc_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    # Relationships
    track: Mapped[Optional["Track"]] = relationship("Track", backref="document_files")

    def __repr__(self):
        return f"<DocumentFile(id={self.id}, stored_path='{self.stored_path}')>"
