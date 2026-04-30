"""
Purchase Repository
===================

This repository handles database operations for user purchases and subscriptions.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from typing import List, Dict, Any
from app.models.ecommerce import Purchase, CartItem
from app.repositories.base_repository import BaseRepository

class PurchaseRepository(BaseRepository[Purchase]):
    def __init__(self):
        super().__init__(Purchase)

    async def async_create_from_cart_items(
        self, 
        db: AsyncSession, 
        order_id: int, 
        user_id: int, 
        cart_items: List[CartItem]
    ) -> List[Purchase]:
        """
        Phase 4: Create permanent purchase records from cart items.
        """
        purchases = []
        for item in cart_items:
            purchase = Purchase(
                order_id=order_id,
                user_id=user_id,
                track_format_id=item.track_format_id,
                price_cents=item.price_cents,
                # Additional fields like discount_cents could be mapped here if needed
            )
            db.add(purchase)
            purchases.append(purchase)
        
        await db.flush()
        return purchases

    async def async_get_user_purchases(self, db: AsyncSession, user_id: int) -> List[Purchase]:
        """Get all successful purchases for a user."""
        stmt = select(Purchase).where(Purchase.user_id == user_id).order_by(Purchase.created_at.desc())
        result = await db.execute(stmt)
        return result.scalars().all()