"""
Cart Repository
===============

This repository handles database operations for Cart, CartItem, and PromoCode.
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.models.ecommerce import Cart, CartItem, PromoCode, TrackFormat
from app.models.track import Track, TrackArtist
from app.repositories.base_repository import BaseRepository

class CartRepository(BaseRepository[Cart]):
    def __init__(self):
        super().__init__(Cart)

    async def async_get_active_cart(self, db: AsyncSession, user_id: int) -> Optional[Cart]:
        """Get the user's active cart with all items."""
        stmt = (
            select(Cart)
            .options(
                selectinload(Cart.items)
                    .selectinload(CartItem.track_format)
                    .selectinload(TrackFormat.track)
                    .selectinload(Track.track_artists)
                    .selectinload(TrackArtist.artist),
                selectinload(Cart.promo_code)
            )
            .where(
                and_(
                    Cart.user_id == user_id,
                    Cart.status == "active"
                )
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_create_cart(self, db: AsyncSession, user_id: int) -> Cart:
        """Create a new active cart for the user."""
        cart = Cart(user_id=user_id, status="active")
        db.add(cart)
        await db.flush()
        return cart

    async def async_add_item(
        self, 
        db: AsyncSession, 
        cart_id: int, 
        track_format_id: int, 
        source_playlist_id: Optional[int] = None
    ) -> Optional[CartItem]:
        """Add an item to the cart if the track format exists."""
        # 1. Fetch the track format to get price
        stmt = select(TrackFormat).where(TrackFormat.id == track_format_id)
        result = await db.execute(stmt)
        track_format = result.scalar_one_or_none()
        
        if not track_format:
            return None

        # 2. Check if already exists in cart to prevent duplicates
        check_stmt = select(CartItem).where(
            and_(
                CartItem.cart_id == cart_id,
                CartItem.track_format_id == track_format_id
            )
        )
        check_result = await db.execute(check_stmt)
        if check_result.scalar_one_or_none():
            return None # Already exists

        # 3. Add to cart
        item = CartItem(
            cart_id=cart_id,
            track_format_id=track_format_id,
            source_playlist_id=source_playlist_id,
            price_cents=track_format.price_cents
        )
        db.add(item)
        await db.flush()
        return item

    async def async_remove_item(self, db: AsyncSession, cart_id: int, track_format_id: int) -> bool:
        """Remove an item from the cart."""
        stmt = delete(CartItem).where(
            and_(
                CartItem.cart_id == cart_id,
                CartItem.track_format_id == track_format_id
            )
        )
        result = await db.execute(stmt)
        return result.rowcount > 0

    async def async_clear_cart(self, db: AsyncSession, cart_id: int) -> bool:
        """Remove all items from the cart."""
        stmt = delete(CartItem).where(CartItem.cart_id == cart_id)
        await db.execute(stmt)
        return True

    async def async_get_promo_code(self, db: AsyncSession, code: str) -> Optional[PromoCode]:
        """Fetch a promo code by its code string if it is active and valid."""
        stmt = select(PromoCode).where(
            and_(
                PromoCode.code == code,
                PromoCode.is_active == True
            )
        )
        result = await db.execute(stmt)
        promo = result.scalar_one_or_none()
        
        if not promo:
            return None
            
        # Check expiration
        if promo.expires_at and promo.expires_at < datetime.utcnow():
            return None
            
        # Check max uses
        if promo.max_uses is not None and promo.uses_count >= promo.max_uses:
            return None
            
        return promo

    async def async_apply_promo_code(self, db: AsyncSession, cart_id: int, promo_code_id: Optional[int]) -> bool:
        """Apply or remove a promo code from a cart."""
        stmt = select(Cart).where(Cart.id == cart_id)
        result = await db.execute(stmt)
        cart = result.scalar_one_or_none()
        
        if not cart:
            return False
            
        cart.promo_code_id = promo_code_id
        await db.flush()
        return True

    async def async_create_promo_code(self, db: AsyncSession, promo_data: dict) -> PromoCode:
        """Create a new promo code."""
        promo = PromoCode(**promo_data)
        db.add(promo)
        await db.flush()
        return promo
