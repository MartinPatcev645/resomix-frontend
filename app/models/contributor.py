"""
Contributor Model
=================

This module defines the Contributor SQLAlchemy model for the Resomix application.
It replaces the legacy Artist model to properly handle all participants (Artists, Composers, etc.).
"""

from typing import List, Optional
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class Contributor(Base):
    """
    Contributor model representing the contributors table.
    Replaces the legacy Artist table for DDEX compliance.
    """

    __tablename__ = "contributors"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    
    # Foreign keys
    party_id: Mapped[str] = mapped_column(String(100), ForeignKey("parties.party_id"), nullable=False, index=True)
    partner_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("partners.id"), nullable=False, default=1, index=True)
    
    # Fields
    full_name: Mapped[str] = mapped_column(String(512), nullable=False)
    isni: Mapped[str] = mapped_column(String(30), nullable=False, default='')
    ipi: Mapped[str] = mapped_column(String(30), nullable=False, default='')
    ipn: Mapped[str] = mapped_column(String(30), nullable=False, default='')
    dpid: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    pro_affiliation: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    artist_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    # Relationships
    track_assocs: Mapped[List["TrackContributor"]] = relationship(
        "TrackContributor", back_populates="contributor", cascade="all, delete-orphan"
    )
    
    release_assocs: Mapped[List["ReleaseContributor"]] = relationship(
        "ReleaseContributor", back_populates="contributor", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Contributor(id={self.id}, full_name='{self.full_name}')>"
