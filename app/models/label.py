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
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
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
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    name = Column(String(120), nullable=False, unique=True, index=True)
    website = Column(String(255), nullable=True)
    
    # Relationships
    tracks = relationship("Track", back_populates="label")
    
    def __repr__(self):
        return f"<Label(id={self.id}, name='{self.name}', website='{self.website}')>" 