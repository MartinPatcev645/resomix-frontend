"""
Feedback Model
==============

This module defines the Feedback SQLAlchemy model for the ResomiX application.
It handles user feedback storage including satisfaction ratings, recommendations,
categories, and messages for application improvement and user support.

Provides feedback data modeling for collecting user opinions and managing
customer satisfaction tracking in the audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from sqlalchemy import Column, Integer, BigInteger, String, Text, Enum, ForeignKey, DateTime
from sqlalchemy.sql import func
from . import Base


class Feedback(Base):
    """
    Feedback model representing the feedback table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS feedback (
        id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id       BIGINT UNSIGNED,
        category      VARCHAR(50),
        message       TEXT,
        satisfaction  INT UNSIGNED,
        recommendation INT UNSIGNED,
        status        ENUM('open','resolved') DEFAULT 'open',
        submitted_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        KEY idx_fb_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "feedback"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    category = Column(String(50), nullable=True)
    message = Column(Text, nullable=True)
    satisfaction = Column(Integer, nullable=True)
    recommendation = Column(Integer, nullable=True)
    status = Column(Enum('open', 'resolved', name='feedback_status'), nullable=False, default='open')
    
    # Timestamps
    submitted_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    def __repr__(self):
        return f"<Feedback(id={self.id}, user_id={self.user_id}, category='{self.category}', status='{self.status}')>"
