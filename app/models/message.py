"""
Message Model
=============

This module defines the Message SQLAlchemy model for the Resomix application.
It maps to the messages table which stores DDEX ERN MessageHeader data.
"""

from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from . import Base


class Message(Base):
    """
    Message model representing the messages table.
    Stores metadata for DDEX ingestion messages.
    """

    __tablename__ = "messages"

    # Primary key
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    
    # References
    ingest_log_id = Column(BigInteger, nullable=False) # Simplified for now
    party_id = Column(String(100), ForeignKey("parties.party_id"), nullable=False, index=True)
    
    # DDEX Fields
    message_id = Column(String(255), nullable=False, unique=True, index=True)
    message_thread_id = Column(String(255), nullable=True)
    message_type = Column(String(100), nullable=True)
    ddex_version = Column(String(20), nullable=True)
    sender_dpid = Column(String(100), nullable=True)
    sender_name = Column(String(255), nullable=True)
    recipient_dpid = Column(String(100), nullable=True)
    recipient_name = Column(String(255), nullable=True)
    message_created_at = Column(DateTime, nullable=True)
    is_update = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    def __repr__(self):
        return f"<Message(id={self.id}, message_id='{self.message_id}', type='{self.message_type}')>"
