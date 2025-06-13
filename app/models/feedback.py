"""
Feedback Model
==============

SQLAlchemy model for the feedback table, representing user feedback submissions.

Author: AI Assistant
Date: December 2024
"""

from sqlalchemy import Column, Integer, BigInteger, String, Text, Enum, DateTime
from sqlalchemy.sql import func
from . import Base


class Feedback(Base):
    """
    Feedback model representing the feedback table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS feedback (
        id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id   CHAR(36),
        category  VARCHAR(50),
        message   TEXT,
        satisfaction INT UNSIGNED,
        recommendation INT UNSIGNED,
        status    ENUM('open','resolved') DEFAULT 'open',
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_fb_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "feedback"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id = Column(String(36), nullable=True, index=True)  # Supabase UUID, nullable
    category = Column(String(50), nullable=True)
    message = Column(Text, nullable=True)
    satisfaction = Column(Integer, nullable=True)
    recommendation = Column(Integer, nullable=True)
    status = Column(Enum('open', 'resolved', name='feedback_status'), nullable=False, default='open')
    
    # Timestamps
    submitted_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    def __repr__(self):
        return f"<Feedback(id={self.id}, user_id='{self.user_id}', category='{self.category}', status='{self.status}')>" 