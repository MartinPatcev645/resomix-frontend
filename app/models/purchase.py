"""
Subscription Models
===================

This module defines the UserSubscription SQLAlchemy model for the Resomix application.
"""

from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class UserSubscription(Base):
    """
    UserSubscription model representing the user_subscriptions table
    """
    __tablename__ = "user_subscriptions"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Primary key
    user_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    
    # Fields
    stripe_subscription_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    
    # Timestamps
    subscribed_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    def __repr__(self):
        return f"<UserSubscription(user_id={self.user_id}, stripe_subscription_id='{self.stripe_subscription_id}')>"
