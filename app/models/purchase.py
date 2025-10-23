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
        user_id      BIGINT UNSIGNED,                 -- nullable
        track_id     BIGINT UNSIGNED,
        album_id     INT UNSIGNED,
        price_cents  INT UNSIGNED,
        purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE RESTRICT,
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE RESTRICT,
        FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE SET NULL,
        KEY idx_purchase_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "purchases"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Fields
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
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
        user_id                BIGINT UNSIGNED PRIMARY KEY,
        stripe_subscription_id VARCHAR(255) COLLATE utf8mb4_bin NOT NULL UNIQUE,
        subscribed_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    __tablename__ = "user_subscriptions"
    
    # Primary key
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    
    # Fields
    stripe_subscription_id = Column(String(255), nullable=False, unique=True)
    
    # Timestamps
    subscribed_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    
    def __repr__(self):
        return f"<UserSubscription(user_id={self.user_id}, stripe_subscription_id='{self.stripe_subscription_id}')>"
