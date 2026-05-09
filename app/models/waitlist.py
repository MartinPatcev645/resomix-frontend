"""
Waitlist Model
==============

This module defines the Waitlist SQLAlchemy model for the Resomix application.
"""

from typing import Optional
from datetime import datetime
from sqlalchemy import String, Enum, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class Waitlist(Base):
    """
    Waitlist model representing the waitlist table.
    Handles user email submissions for early access.
    """
    __tablename__ = "waitlists"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, index=True, autoincrement=True)
    
    # Fields
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(
        Enum('pending', 'approved', 'rejected', name='waitlist_status'), 
        nullable=False, 
        default='pending', 
        index=True
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        nullable=False, 
        server_default=func.current_timestamp(), 
        onupdate=func.current_timestamp()
    )
    
    def __repr__(self):
        return f"<Waitlist(id={self.id}, email='{self.email}', status='{self.status}')>"
