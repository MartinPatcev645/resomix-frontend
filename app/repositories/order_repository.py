"""
Order Repository
================

This repository handles CRUD operations for the Order model.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.ecommerce import Order
from app.repositories.base_repository import BaseRepository

class OrderRepository(BaseRepository[Order]):
    def __init__(self):
        super().__init__(Order)

    async def async_get_by_id(self, db: AsyncSession, order_id: int) -> Order:
        result = await db.execute(select(Order).where(Order.id == order_id))
        return result.scalars().first()

    async def async_create(self, db: AsyncSession, order_data: dict) -> Order:
        order = Order(**order_data)
        db.add(order)
        await db.flush() # Flush to get the ID
        return order

    async def async_update_status(self, db: AsyncSession, order_id: int, status: str, stripe_session_id: str = None) -> Order:
        order = await self.async_get_by_id(db, order_id)
        if order:
            order.status = status
            if stripe_session_id:
                order.stripe_session_id = stripe_session_id
            await db.flush()
        return order
