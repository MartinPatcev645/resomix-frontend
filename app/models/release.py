"""
Release Model
=============

This module defines the Release SQLAlchemy model for the Resomix application.
It maps to the releases table which replaces the old albums table for DDEX compliance.
"""

from typing import List, Optional
from sqlalchemy import String, Date, ForeignKey, DateTime, Enum, Boolean
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class Release(Base):
    """
    Release model representing the releases table.
    Stores metadata for albums, singles, EPs, or bundles.
    """

    __tablename__ = "releases"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci", "mysql_row_format": "DYNAMIC"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    
    # External References
    label_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("labels.id", ondelete="SET NULL"), nullable=True, index=True)
    party_id: Mapped[str] = mapped_column(String(100), ForeignKey("parties.party_id"), nullable=False, index=True)
    message_id: Mapped[str] = mapped_column(String(255), ForeignKey("messages.message_id"), nullable=False, index=True)
    partner_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("partners.id"), nullable=False, default=1, index=True)
    
    # DDEX specific
    release_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ern_version: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    raw_xml_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Identifiers
    icpn: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, index=True)
    upc_ean: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    grid: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    catalog_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    
    # Metadata
    title: Mapped[str] = mapped_column(String(1024), nullable=False)
    subtitle: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(mysql.TEXT, nullable=True)
    display_artist: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    release_type: Mapped[Optional[str]] = mapped_column(
        Enum("Album", "EP", "Single"),
        default="Album"
    )
    
    release_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    original_release_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    ingested_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, server_default=func.current_timestamp())
    
    # Rights & Pricing
    p_line_year: Mapped[Optional[int]] = mapped_column(mysql.YEAR, nullable=True)
    p_line_text: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    c_line_year: Mapped[Optional[int]] = mapped_column(mysql.YEAR, nullable=True)
    c_line_text: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    p_line: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    c_line: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    genre: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sub_genre: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    parental_warning: Mapped[Optional[str]] = mapped_column(
        Enum('NoAdviceAvailable','NotExplicit','Explicit','ExplicitContentEdited'),
        default='NotExplicit'
    )
    
    is_compilation: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, default=True, index=True)
    price_cents: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    cover_image: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Timestamps
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )
    
    # Relationships
    
    # Label
    label: Mapped[Optional["Label"]] = relationship("Label", back_populates="releases")
    
    # Many-to-many with Tracks through ReleaseTrack
    release_track_assocs: Mapped[List["ReleaseTrack"]] = relationship(
        "ReleaseTrack", back_populates="release", cascade="all, delete-orphan"
    )
    
    # Many-to-many with Contributors through ReleaseContributor
    contributor_assocs: Mapped[List["ReleaseContributor"]] = relationship(
        "ReleaseContributor", back_populates="release", cascade="all, delete-orphan"
    )

    # Partner tenant owning this release
    partner: Mapped["Partner"] = relationship(
        "Partner", foreign_keys=[partner_id]
    )

    def __repr__(self):
        return f"<Release(id={self.id}, title='{self.title}', icpn='{self.icpn}')>"
