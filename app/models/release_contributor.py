"""
Release Contributor Model
=========================

This module defines the ReleaseContributor SQLAlchemy model.
It handles junction mapping for releases and contributors.
"""

from typing import Optional
from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from . import Base


class ReleaseContributor(Base):
    """
    ReleaseContributor model representing the release_contributors table
    """
    __tablename__ = "release_contributors"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    
    # Foreign keys
    release_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("releases.id", ondelete="CASCADE"), nullable=False, index=True)
    person_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("contributors.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Role & Sequence
    role: Mapped[str] = mapped_column(
        Enum('MainArtist', 'FeaturedArtist', 'Producer', 'Other'),
        nullable=False, default='MainArtist'
    )
    sequence_num: Mapped[Optional[int]] = mapped_column(mysql.SMALLINT(unsigned=True), default=1)
    
    # Relationships
    release: Mapped["Release"] = relationship("Release", back_populates="contributor_assocs")
    contributor: Mapped["Contributor"] = relationship("Contributor", back_populates="release_assocs")

    def __repr__(self):
        return f"<ReleaseContributor(id={self.id}, release_id={self.release_id}, person_id={self.person_id}, role='{self.role}')>"
