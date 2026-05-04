"""
Copyright & Content Protection Models
======================================

SQLAlchemy models for copyright protection and manual content takedowns.
"""

from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Enum, DECIMAL, TEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base

if TYPE_CHECKING:
    from .user import User
    from .track import Track


class ManualTakedown(Base):
    """Admin-driven manual content takedown requests."""
    __tablename__ = "manual_takedowns"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    track_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="RESTRICT"), nullable=False, index=True)
    admin_user_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id"), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(TEXT, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())

    track: Mapped["Track"] = relationship("Track")


class ACRInfringementLog(Base):
    """Automated Content Recognition match results for copyright protection."""
    __tablename__ = "acr_infringement_logs"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    attempted_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    matched_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    matched_artists: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    acr_score: Mapped[Optional[float]] = mapped_column(DECIMAL(5, 2), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum('blocked', 'disputed', 'cleared'),
        default='blocked',
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())

    user: Mapped["User"] = relationship("User")
