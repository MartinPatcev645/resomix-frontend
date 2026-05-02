"""
Party Model
===========

This module defines the Party SQLAlchemy model for the Resomix application.
It maps to the parties table which stores distributors, aggregators, or labels.
"""

from typing import Optional
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class Party(Base):
    """
    Party model representing the parties table.
    Used to identify the content owner (distributor/label).
    """

    __tablename__ = "parties"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    
    # DDEX PartyId (unique string identifier)
    party_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    
    # Descriptive fields
    party_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dpid: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # DDEX Party ID (DPID)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    
    # Timestamps
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    def __repr__(self):
        return f"<Party(id={self.id}, party_id='{self.party_id}', name='{self.party_name}')>"
