"""
Purchase Repository
===================

This repository handles database operations for user purchases and subscriptions.
"""

from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from typing import List, Dict, Any, Optional
from app.models.ecommerce import Purchase, CartItem
from app.repositories.base_repository import BaseRepository

class PurchaseRepository(BaseRepository[Purchase]):
    def __init__(self):
        super().__init__(Purchase)

    def _find_existing(self, db: Session, **kwargs) -> Optional[Purchase]:
        """Find existing purchase record based on provided fields."""
        query = db.query(self.model)
        for field, value in kwargs.items():
            if hasattr(self.model, field):
                query = query.filter(getattr(self.model, field) == value)
        return query.first()

    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Purchase]:
        """Find existing purchase record based on provided fields (async)."""
        stmt = select(self.model)
        for field, value in kwargs.items():
            if hasattr(self.model, field):
                stmt = stmt.where(getattr(self.model, field) == value)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

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
                track_id=item.track_id,
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