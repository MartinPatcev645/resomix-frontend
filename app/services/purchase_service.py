"""
Purchase Service
================

This service handles the fulfillment of orders after successful payment.
"""

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.order_repository import OrderRepository
from app.repositories.purchase_repository import PurchaseRepository
from app.repositories.cart_repository import CartRepository

logger = logging.getLogger(__name__)

class PurchaseService:
    def __init__(self):
        self.order_repo = OrderRepository()
        self.purchase_repo = PurchaseRepository()
        self.cart_repo = CartRepository()

    async def fulfill_order(self, db: AsyncSession, stripe_session: dict) -> bool:
        """
        Phase 4: Atomic Fulfillment
        Goal: Translate a successful payment into digital ownership.
        """
        metadata = stripe_session.get("metadata", {})
        internal_order_id = metadata.get("internal_order_id")
        user_id = metadata.get("user_id")

        if not internal_order_id or not user_id:
            logger.error(f"Missing metadata in Stripe session: {stripe_session.get('id')}")
            return False

        try:
            # 1. Fetch Order and Cart
            order = await self.order_repo.async_get_by_id(db, int(internal_order_id))
            if not order:
                logger.error(f"Order {internal_order_id} not found for fulfillment")
                return False

            if order.status == "paid":
                logger.info(f"Order {internal_order_id} already marked as paid")
                return True

            cart = await self.cart_repo.async_get_active_cart(db, int(user_id))
            if not cart or not cart.items:
                logger.error(f"Active cart not found for user {user_id} during fulfillment")
                # Even if cart is gone, we might have processed it already? 
                # But status check above should handle that.
                return False

            # 2. Update Order Status
            order.status = "paid"
            order.stripe_session_id = stripe_session.get("id")
            order.payment_intent_id = stripe_session.get("payment_intent")
            
            # 3. Create Purchase Records
            await self.purchase_repo.async_create_from_cart_items(
                db, 
                order_id=order.id, 
                user_id=order.user_id, 
                cart_items=cart.items
            )

            # 4. Clear the Cart
            cart.status = "completed"
            
            # Note: The caller (WebhookController) handles the commit/rollback
            logger.info(f"Order {order.id} fulfilled successfully for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Fulfillment failed for order {internal_order_id}: {str(e)}")
            raise e # Re-raise for controller handling

    async def handle_dispute(self, db: AsyncSession, dispute: dict) -> bool:
        """
        Phase 5: Security & Dispute Automation
        Goal: Protect platform from friendly fraud by revoking access.
        """
        payment_intent_id = dispute.get("payment_intent")
        if not payment_intent_id:
            return False

        try:
            # Find the order associated with this payment intent
            from app.models.ecommerce import Order
            stmt = select(Order).where(Order.payment_intent_id == payment_intent_id)
            result = await db.execute(stmt)
            order = result.scalars().first()

            if order:
                order.status = "failed"
                logger.warning(f"Order {order.id} revoked due to dispute {dispute.get('id')}")
                # (Optional) Flag purchases as revoked
                return True
            return False
        except Exception as e:
            logger.error(f"Dispute handling failed: {str(e)}")
            return False