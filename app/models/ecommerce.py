"""
E-Commerce Models
=================

This module defines the SQLAlchemy models for the Resomix e-commerce platform.
It includes PromoCodes, Carts, Orders, and Purchases.
"""

from typing import List, Optional
from sqlalchemy import String, ForeignKey, DateTime, Enum, Boolean, DECIMAL
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from sqlalchemy.sql import func
from . import Base


class PromoCode(Base):
    """
    PromoCode model representing the promo_codes table
    """
    __tablename__ = "promo_codes"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    discount_type: Mapped[str] = mapped_column(Enum("percentage", "fixed_amount"), nullable=False)
    discount_value: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False)
    max_uses: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), nullable=True)
    uses_count: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), default=0)
    expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Order(Base):
    """
    Order model representing the orders table
    """
    __tablename__ = "orders"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    stripe_session_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    promo_code_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("promo_codes.id", ondelete="SET NULL"), nullable=True)
    
    subtotal_cents: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False)
    discount_cents: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), default=0)
    total_cents: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False)
    
    status: Mapped[str] = mapped_column(Enum("pending", "paid", "failed", "refunded"), default="pending")
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())

    # Relationships
    user: Mapped["User"] = relationship("User")
    promo_code: Mapped[Optional["PromoCode"]] = relationship("PromoCode")
    purchases: Mapped[List["Purchase"]] = relationship("Purchase", back_populates="order")


class Purchase(Base):
    """
    Purchase model representing the purchases table
    """
    __tablename__ = "purchases"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    track_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="RESTRICT"), nullable=True)
    release_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("releases.id", ondelete="RESTRICT"), nullable=True)
    source_playlist_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True)
    
    price_cents: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False)
    purchased_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="purchases")
    user: Mapped[Optional["User"]] = relationship("User")
    track: Mapped[Optional["Track"]] = relationship("Track")
    release: Mapped[Optional["Release"]] = relationship("Release")
    source_playlist: Mapped[Optional["Playlist"]] = relationship("Playlist")


class Cart(Base):
    """
    Cart model representing the carts table
    """
    __tablename__ = "carts"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    promo_code_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("promo_codes.id", ondelete="SET NULL"), nullable=True)
    
    status: Mapped[str] = mapped_column(Enum("active", "pending_checkout", "completed", "abandoned"), default="active")
    created_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    # Relationships
    user: Mapped["User"] = relationship("User")
    promo_code: Mapped[Optional["PromoCode"]] = relationship("PromoCode")
    items: Mapped[List["CartItem"]] = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    """
    CartItem model representing the cart_items table
    """
    __tablename__ = "cart_items"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, autoincrement=True)
    cart_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("carts.id", ondelete="CASCADE"), nullable=False)
    
    track_id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("tracks.id", ondelete="RESTRICT"), nullable=False)
    release_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("releases.id", ondelete="SET NULL"), nullable=True)
    source_playlist_id: Mapped[Optional[int]] = mapped_column(mysql.INTEGER(unsigned=True), ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True)
    
    price_cents: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False)
    added_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())

    # Relationships
    cart: Mapped["Cart"] = relationship("Cart", back_populates="items")
    track: Mapped["Track"] = relationship("Track")
    release: Mapped[Optional["Release"]] = relationship("Release")
    source_playlist: Mapped[Optional["Playlist"]] = relationship("Playlist")
