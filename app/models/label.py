"""
Label Model
===========

This module defines the Label SQLAlchemy model for the Resomix application.
It handles record label information storage including name, website, and contact details,
with relationships to tracks for label-based organization and filtering.

Provides label data modeling for track categorization and music industry
metadata in the audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Label model 
from sqlalchemy import Column, Integer, BigInteger, String, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base


class Label(Base):
    """
    Label model representing the labels table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS labels (
        id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120)  NOT NULL,
        website VARCHAR(255),
        UNIQUE KEY uk_label_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "labels"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)

    # Foreign keys
    party_id = Column(String(100), ForeignKey("parties.party_id"), nullable=False, index=True)
    
    # Fields
    dpid = Column(String(100), nullable=True)
    label_name = Column(String(512), nullable=False, index=True)
    label_type = Column(
        Enum('RecordLabel','MusicPublisher','OriginalPublisher','SubPublisher','Other', name="label_type_enum"),
        default='RecordLabel'
    )
    created_at = Column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    # Relationships
    tracks = relationship("Track", back_populates="label")
    
    def __repr__(self):
        return f"<Label(id={self.id}, label_name='{self.label_name}', type='{self.label_type}')>"