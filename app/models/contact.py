"""
Contact Model
=============

This module defines the Contact SQLAlchemy model for the ResomiX application.
It handles user contact form submissions including name, email, subject, phone,
and message for customer support and communication management.

Provides contact data modeling for managing user inquiries and support
requests in the audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from sqlalchemy import Column, BigInteger, String, Text, Enum, ForeignKey, DateTime
from sqlalchemy.sql import func
from . import Base


class Contact(Base):
    """
    Contact model representing the contact table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS contact (
        id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id     BIGINT UNSIGNED,
        name        VARCHAR(100),
        email       VARCHAR(100),
        subject     VARCHAR(150),
        phone       VARCHAR(20),
        message     TEXT,
        status      ENUM('open','resolved') DEFAULT 'open',
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        KEY idx_fb_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "contact"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    subject = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=True)
    message = Column(Text, nullable=True)
    status = Column(Enum('open', 'resolved', name='contact_status'), nullable=False, default='open')
    
    # Timestamps
    submitted_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    def __repr__(self):
        return f"<Contact(id={self.id}, user_id={self.user_id}, name='{self.name}', email='{self.email}', status='{self.status}')>"
