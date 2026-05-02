"""
Operation Limit Models
======================

SQLAlchemy models for admin-configurable operation limits.
Maps to the `operation_types` and `user_operation_limits` tables.

Version: 3.0.1
Init Date: November 05, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from sqlalchemy import (
    String,
    ForeignKey,
    DateTime,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from typing import List, Optional

from . import Base


class OperationType(Base):
    """Catalog of throttled/limited operations."""

    __tablename__ = "operation_types"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    user_limits: Mapped[List["UserOperationLimit"]] = relationship(
        "UserOperationLimit",
        back_populates="operation",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<OperationType(id={self.id}, code='{self.code}')>"


class UserOperationLimit(Base):
    """Per-user limits for specific operations."""

    __tablename__ = "user_operation_limits"
    __table_args__ = (
        UniqueConstraint("user_id", "operation_id", name="uq_user_operation_limit"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    user_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    operation_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("operation_types.id", ondelete="CASCADE"), primary_key=True)
    limit_value: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False)
    window_seconds: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    # Tracks how many times the user has consumed this operation (e.g., number of transfers performed)
    # Backed by an UNSIGNED INT column in DB; default 0.
    usage: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False, server_default=func.cast(0, mysql.INTEGER(unsigned=True)))
    created_by: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # Relationships
    operation: Mapped["OperationType"] = relationship("OperationType", back_populates="user_limits")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="operation_limits")
    created_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by], viewonly=True)

    def __repr__(self) -> str:
        return (
            f"<UserOperationLimit(user_id={self.user_id}, "
            f"operation_id={self.operation_id}, limit_value={self.limit_value})>"
        )

