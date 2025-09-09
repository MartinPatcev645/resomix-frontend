"""
Waitlist Model
==============

This module defines the Waitlist SQLAlchemy model for the ResomiX application.
It handles waitlist email submissions including email storage, status tracking,
and timestamp management for user waitlist management.

Provides waitlist data modeling for managing user email submissions and
waitlist status in the audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from sqlalchemy import Column, BigInteger, String, Enum, DateTime
from sqlalchemy.sql import func
from . import Base


class Waitlist(Base):
    """
    Waitlist model representing the waitlist table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS waitlist (
        id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email     VARCHAR(255) NOT NULL UNIQUE,
        status    ENUM('pending','approved','rejected') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_waitlist_email (email),
        KEY idx_waitlist_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "waitlist"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    email = Column(String(255), nullable=False, unique=True, index=True)
    status = Column(Enum('pending', 'approved', 'rejected', name='waitlist_status'), 
                   nullable=False, default='pending', index=True)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), 
                       onupdate=func.current_timestamp())
    
    def __repr__(self):
        return f"<Waitlist(id={self.id}, email='{self.email}', status='{self.status}')>"
