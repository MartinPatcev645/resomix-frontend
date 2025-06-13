"""
Purchase Models
===============

This module defines the Purchase and UserSubscription SQLAlchemy models for the ResomiX application.
It handles purchase transactions and subscription management with support for payment tracking
and user subscription status monitoring.

Provides purchase and subscription data modeling for monetization features
in the audio similarity platform.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from sqlalchemy import Column, Integer, BigInteger, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base


class Purchase(Base):
    """
    Purchase model representing the purchases table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS purchases (
        id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id      CHAR(36),                      -- nullable
        track_id     BIGINT UNSIGNED,
        album_id     INT UNSIGNED,
        price_cents  INT UNSIGNED,
        purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE RESTRICT,
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE RESTRICT,
        KEY idx_purchase_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "purchases"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id = Column(String(36), nullable=True, index=True)  # Supabase UUID, nullable
    price_cents = Column(Integer, nullable=True)
    
    # Foreign keys (both nullable - either track OR album purchase)
    track_id = Column(BigInteger, ForeignKey("tracks.id", ondelete="RESTRICT"), nullable=True)
    album_id = Column(Integer, ForeignKey("albums.id", ondelete="RESTRICT"), nullable=True)
    
    # Timestamps
    purchased_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    # Relationships
    track = relationship("Track")
    album = relationship("Album")
    
    def __repr__(self):
        return f"<Purchase(id={self.id}, user_id='{self.user_id}', track_id={self.track_id}, album_id={self.album_id}, price_cents={self.price_cents})>"


class UserSubscription(Base):
    """
    UserSubscription model representing the user_subscriptions table
    
    Schema from SQL:
    CREATE TABLE IF NOT EXISTS user_subscriptions (
        user_id                CHAR(36) PRIMARY KEY,   -- must be non-NULL here
        stripe_subscription_id VARCHAR(255) COLLATE utf8mb4_bin NOT NULL UNIQUE,
        subscribed_at          DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "user_subscriptions"
    
    # Primary key
    user_id = Column(String(36), primary_key=True)  # Supabase UUID, NOT NULL
    
    # Fields
    stripe_subscription_id = Column(String(255), nullable=False, unique=True)
    
    # Timestamps
    subscribed_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    def __repr__(self):
        return f"<UserSubscription(user_id='{self.user_id}', stripe_subscription_id='{self.stripe_subscription_id}')>" 