"""
Admin Operation Log Model
========================

SQLAlchemy model for logging all administrative actions performed by admin users.
Captures forensic details of "who did what, when, and to which resource".

Version: 1.0.0
Date: May 16, 2026
"""

from sqlalchemy import (
    String,
    ForeignKey,
    DateTime,
    CHAR,
    Index
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from typing import Optional, Any
from datetime import datetime

from . import Base


class AdminOperationLog(Base):
    """
    Comprehensive audit log for all administrative operations.
    Used for forensic tracking, compliance, and security monitoring.
    """

    __tablename__ = "admin_operation_logs"
    __table_args__ = (
        Index("idx_admin_op_target", "target_type", "target_id"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    
    # Who performed the operation
    admin_user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # What was the action (e.g., 'feedback.resolve', 'partner.api_key.revoke', 'user.deactivate')
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Target resource type (e.g., 'user', 'partner', 'feedback', 'operation_limit')
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Target resource identifier (UUID or ID as string)
    target_id: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # State changes (JSON snapshots)
    before_state: Mapped[Optional[Any]] = mapped_column(mysql.JSON, nullable=True)
    after_state: Mapped[Optional[Any]] = mapped_column(mysql.JSON, nullable=True)
    
    # Request & context metadata
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    correlation_id: Mapped[Optional[str]] = mapped_column(CHAR(36), nullable=True)
    
    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), index=True
    )

    # Relationships
    admin_user: Mapped["User"] = relationship("User", foreign_keys=[admin_user_id])

    def __repr__(self) -> str:
        return f"<AdminOperationLog(id={self.id}, action='{self.action}', admin_id={self.admin_user_id})>"
