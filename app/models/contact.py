"""
Contact Model
=============

SQLAlchemy model for the contact table, representing contact form submissions.

Author: AI Assistant
Date: December 2024
"""

from sqlalchemy import Column, BigInteger, String, Text, Enum, DateTime
from sqlalchemy.sql import func
from . import Base


class Contact(Base):
    """
    Contact model representing the contact table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS contact (
        id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id   CHAR(36),
        name      VARCHAR(100),
        email     VARCHAR(100),
        subject   VARCHAR(150),
        phone     VARCHAR(20),
        message   TEXT,
        status    ENUM('open','resolved') DEFAULT 'open',
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_fb_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "contact"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id = Column(String(36), nullable=True, index=True)  # Supabase UUID, nullable
    name = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    subject = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=True)
    message = Column(Text, nullable=True)
    status = Column(Enum('open', 'resolved', name='contact_status'), nullable=False, default='open')
    
    # Timestamps
    submitted_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    def __repr__(self):
        return f"<Contact(id={self.id}, user_id='{self.user_id}', name='{self.name}', email='{self.email}', status='{self.status}')>" 