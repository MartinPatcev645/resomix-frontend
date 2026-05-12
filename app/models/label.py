"""
Label Model
===========

This module defines the Label SQLAlchemy model for the Resomix application.
It handles record label information storage including name, website, and contact details,
with relationships to tracks for label-based organization and filtering.

Provides label data modeling for track categorization and music industry
metadata in the audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Label model 
from sqlalchemy import String, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from typing import List, Optional
from . import Base
from .partner import Partner


class Label(Base):
    """
    Label model representing the labels table
    """
    __tablename__ = "labels"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, index=True, autoincrement=True)

    # Foreign keys
    party_id: Mapped[str] = mapped_column(String(100), ForeignKey("parties.party_id"), nullable=False, index=True)
    
    # Fields
    dpid: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    label_name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    label_type: Mapped[str] = mapped_column(
        Enum('RecordLabel','MusicPublisher','OriginalPublisher','SubPublisher','Other', name="label_type_enum"),
        default='RecordLabel'
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    
    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )

    # Relationships
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])
    releases: Mapped[List["Release"]] = relationship("Release", back_populates="label")
    sftp_users: Mapped[List["SftpUser"]] = relationship("SftpUser", back_populates="label", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Label(id={self.id}, label_name='{self.label_name}', type='{self.label_type}')>"
