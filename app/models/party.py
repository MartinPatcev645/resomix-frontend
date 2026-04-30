"""
Party Model
===========

This module defines the Party SQLAlchemy model for the Resomix application.
It maps to the parties table which stores distributors, aggregators, or labels.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from . import Base


class Party(Base):
    """
    Party model representing the parties table.
    Used to identify the content owner (distributor/label).
    """

    __tablename__ = "parties"

    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # DDEX PartyId (unique string identifier)
    party_id = Column(String(100), nullable=False, unique=True, index=True)
    
    # Descriptive fields
    party_name = Column(String(255), nullable=False)
    dpid = Column(String(100), nullable=True) # DDEX Party ID (DPID)
    email = Column(String(255), nullable=True)
    
    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Timestamps
    created_at = Column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at = Column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    def __repr__(self):
        return f"<Party(id={self.id}, party_id='{self.party_id}', name='{self.party_name}')>"
