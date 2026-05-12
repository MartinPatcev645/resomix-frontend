"""
Feedback Model
==============

SQLAlchemy model for user feedback submissions.
"""

from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Enum, TEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base
from .partner import Partner

if TYPE_CHECKING:
    from .user import User


class Feedback(Base):
    """
    Feedback model representing the feedback table
    """
    __tablename__ = "feedbacks"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, index=True, autoincrement=True)
    
    # Foreign key to user
    user_id: Mapped[Optional[int]] = mapped_column(
        mysql.INTEGER(unsigned=True), 
        ForeignKey("users.id", ondelete="SET NULL"), 
        nullable=True, 
        index=True
    )

    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )
    
    # Fields
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(TEXT, nullable=True)
    satisfaction: Mapped[Optional[int]] = mapped_column(mysql.INTEGER, nullable=True)
    recommendation: Mapped[Optional[int]] = mapped_column(mysql.INTEGER, nullable=True)
    
    status: Mapped[str] = mapped_column(
        Enum('open', 'resolved', name='feedback_status'), 
        nullable=False, 
        default='open'
    )
    
    # Timestamps
    submitted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    # Relationship
    user: Mapped[Optional["User"]] = relationship("User")
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])

    def __repr__(self):
        return f"<Feedback(id={self.id}, user_id={self.user_id}, status='{self.status}')>"
