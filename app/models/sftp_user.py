"""
SFTP User Model
===============

SQLAlchemy model for managing SFTP users associated with labels.
Maps to the `sftp_users` table.

Version: 3.0.1
Init Date: May 02, 2026
"""

from sqlalchemy import (
    String,
    ForeignKey,
    DateTime,
    Boolean,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from typing import List, Optional

from . import Base


class SftpUser(Base):
    """SFTP user configuration for label-specific ingestion."""

    __tablename__ = "sftp_users"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    label_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("labels.id", ondelete="RESTRICT"),
        nullable=False,
    )
    username: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    home_directory: Mapped[str] = mapped_column(String(500), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    # Relationships
    label: Mapped["Label"] = relationship("Label", back_populates="sftp_users")

    def __repr__(self) -> str:
        return f"<SftpUser(id={self.id}, username='{self.username}', label_id={self.label_id})>"
