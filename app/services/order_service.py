"""
Order Service
=============

This service handles the business logic for order management.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.order_repository import OrderRepository
from app.models.ecommerce import Order

class OrderService:
    def __init__(self, order_repository: OrderRepository = None):
        self.order_repo = order_repository or OrderRepository()

    async def create_pending_order(
        self, 
        db: AsyncSession, 
        user_id: int, 
        subtotal_cents: int, 
        total_cents: int,
        promo_code_id: int = None,
        discount_cents: int = 0
    ) -> Order:
        order_data = {
            "user_id": user_id,
            "subtotal_cents": subtotal_cents,
            "total_cents": total_cents,
            "discount_cents": discount_cents,
            "promo_code_id": promo_code_id,
            "status": "pending"
        }
        return await self.order_repo.async_create(db, order_data)

    async def get_order(self, db: AsyncSession, order_id: int) -> Order:
        return await self.order_repo.async_get_by_id(db, order_id)

    async def mark_as_paid(self, db: AsyncSession, order_id: int, stripe_session_id: str) -> Order:
        return await self.order_repo.async_update_status(db, order_id, "paid", stripe_session_id)

    async def mark_as_failed(self, db: AsyncSession, order_id: int) -> Order:
        return await self.order_repo.async_update_status(db, order_id, "failed")
