"""
E-Commerce Models
=================

This module defines the SQLAlchemy models for the Resomix e-commerce platform.
It includes TrackFormats, PromoCodes, Carts, Orders, and Purchases.
"""

from sqlalchemy import Column, Integer, BigInteger, String, ForeignKey, DateTime, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base

class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False)
    discount_type = Column(Enum("percentage", "fixed_amount"), nullable=True)
    discount_value = Column(Integer, nullable=False)
    max_uses = Column(Integer, nullable=True)
    uses_count = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)


class TrackFormat(Base):
    __tablename__ = "track_formats"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    track_id = Column(BigInteger, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False)
    audio_format = Column(Enum("mp3", "wav", "flac", "aiff"), nullable=False)
    price_cents = Column(Integer, nullable=False)
    file_path = Column(String(500), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    is_generated = Column(Boolean, default=False)
    last_downloaded_at = Column(DateTime, nullable=True)

    track = relationship("Track")


class Order(Base):
    __tablename__ = "orders"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    stripe_session_id = Column(String(255), unique=True, nullable=True)
    promo_code_id = Column(BigInteger, ForeignKey("promo_codes.id", ondelete="SET NULL"), nullable=True)
    subtotal_cents = Column(Integer, nullable=False)
    discount_cents = Column(Integer, default=0)
    total_cents = Column(Integer, nullable=False)
    status = Column(Enum("pending", "paid", "failed", "refunded"), default="pending")
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())

    user = relationship("User")
    promo_code = relationship("PromoCode")
    purchases = relationship("Purchase", back_populates="order")


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    order_id = Column(BigInteger, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    track_format_id = Column(BigInteger, ForeignKey("track_formats.id", ondelete="RESTRICT"), nullable=True)
    source_playlist_id = Column(BigInteger, ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True)
    release_id = Column(Integer, nullable=True) # Assuming release is an Integer
    price_cents = Column(Integer, nullable=True)
    purchased_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())

    order = relationship("Order", back_populates="purchases")
    user = relationship("User")
    track_format = relationship("TrackFormat")
    source_playlist = relationship("Playlist")


class Cart(Base):
    __tablename__ = "carts"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    promo_code_id = Column(BigInteger, ForeignKey("promo_codes.id", ondelete="SET NULL"), nullable=True)
    status = Column(Enum("active", "pending_checkout", "completed", "abandoned"), default="active")
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    user = relationship("User")
    promo_code = relationship("PromoCode")
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    cart_id = Column(BigInteger, ForeignKey("carts.id", ondelete="CASCADE"), nullable=False)
    track_format_id = Column(BigInteger, ForeignKey("track_formats.id", ondelete="RESTRICT"), nullable=False)
    source_playlist_id = Column(BigInteger, ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True)
    price_cents = Column(Integer, nullable=False)
    added_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())

    cart = relationship("Cart", back_populates="items")
    track_format = relationship("TrackFormat")
    source_playlist = relationship("Playlist")
