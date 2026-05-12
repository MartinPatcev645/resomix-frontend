"""
Message Model
=============

This module defines the Message SQLAlchemy model for the Resomix application.
It maps to the messages table which stores DDEX ERN MessageHeader data.
"""

from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base
from .partner import Partner


class Message(Base):
    """
    Message model representing the messages table.
    Stores metadata for DDEX ingestion messages.
    """

    __tablename__ = "messages"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    
    # References
    ingest_log_id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), ForeignKey("ingest_logs.id"), nullable=False)
    party_id: Mapped[str] = mapped_column(String(100), ForeignKey("parties.party_id"), nullable=False, index=True)
    
    # DDEX Fields
    message_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    message_thread_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    message_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ddex_version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    sender_dpid: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    sender_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recipient_dpid: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    recipient_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    message_created_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    is_update: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Partner ID: Multi-tenant isolation (W1-4)
    partner_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("partners.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
        index=True,
    )
    
    # Timestamps
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    # Relationships
    partner: Mapped["Partner"] = relationship("Partner", foreign_keys=[partner_id])

    def __repr__(self):
        return f"<Message(id={self.id}, message_id='{self.message_id}', type='{self.message_type}')>"
