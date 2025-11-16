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
    Column,
    BigInteger,
    Integer,
    String,
    ForeignKey,
    DateTime,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from . import Base


class OperationType(Base):
    """Catalog of throttled/limited operations."""

    __tablename__ = "operation_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    description = Column(String(255), nullable=True)

    # Relationships
    user_limits = relationship(
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
    )

    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    operation_id = Column(Integer, ForeignKey("operation_types.id", ondelete="CASCADE"), primary_key=True)
    limit_value = Column(Integer, nullable=False)
    window_seconds = Column(Integer, nullable=True)
    # Tracks how many times the user has consumed this operation (e.g., number of transfers performed)
    # Backed by an UNSIGNED INT column in DB; default 0.
    usage = Column(Integer, nullable=False, server_default=func.cast(0, Integer))
    created_by = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # Relationships
    operation = relationship("OperationType", back_populates="user_limits")
    user = relationship("User", foreign_keys=[user_id], back_populates="operation_limits")
    created_by_user = relationship("User", foreign_keys=[created_by], viewonly=True)

    def __repr__(self) -> str:
        return (
            f"<UserOperationLimit(user_id={self.user_id}, "
            f"operation_id={self.operation_id}, limit_value={self.limit_value})>"
        )

