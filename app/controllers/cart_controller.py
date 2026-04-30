"""
Cart Controller
===============

This controller handles HTTP requests for the shopping cart.
"""

from fastapi import status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List

from app.services.cart_service import CartService
from app.services.order_service import OrderService
from app.repositories.cart_repository import CartRepository
from app.repositories.user_repository import UserRepository
from app.utils.response_utils import format_response
from app.core.config import settings

import stripe
import logging
logger = logging.getLogger(__name__)

class CartController:
    def __init__(self):
        self.cart_repository = CartRepository()
        self.user_repo = UserRepository()
        self.cart_service = CartService(self.cart_repository)
        self.order_service = OrderService()
        
        # Initialize stripe
        stripe.api_key = settings.stripe_secret_key

    async def get_cart(self, db: AsyncSession, request: Request, user_id: int) -> JSONResponse:
        try:
            cart_data = await self.cart_service.hydrate_cart(db, user_id)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=cart_data)
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"Failed to get cart: {str(e)}")
            )

    async def add_to_cart(self, db: AsyncSession, request: Request, user_id: int, payload: Dict[str, Any]) -> JSONResponse:
        try:
            if "playlist_id" in payload:
                # Option B: Add entire playlist
                cart_data = await self.cart_service.add_playlist(db, user_id, payload["playlist_id"])
            else:
                # Option A: Individual items
                items = payload.get("items", [])
                cart_data = await self.cart_service.add_items(db, user_id, items)
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True)
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"Failed to add to cart: {str(e)}")
            )

    async def remove_playlist(self, db: AsyncSession, request: Request, user_id: int, playlist_id: str) -> JSONResponse:
        try:
            await self.cart_service.remove_playlist(db, user_id, playlist_id)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True)
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"Failed to remove playlist from cart: {str(e)}")
            )

    async def remove_from_cart(self, db: AsyncSession, request: Request, user_id: int, track_format_id: int) -> JSONResponse:
        try:
            await self.cart_service.remove_item(db, user_id, track_format_id)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True)
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"Failed to remove from cart: {str(e)}")
            )

    async def clear_cart(self, db: AsyncSession, request: Request, user_id: int) -> JSONResponse:
        try:
            await self.cart_service.clear_cart(db, user_id)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True)
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"Failed to clear cart: {str(e)}")
            )

    async def apply_promo(self, db: AsyncSession, request: Request, user_id: int, code: str) -> JSONResponse:
        try:
            cart_data = await self.cart_service.apply_promo(db, user_id, code)
            if "error" in cart_data:
                return format_response(
                    success=False,
                    error=cart_data["error"],
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data={
                        "code": cart_data["promo_code"],
                        "discount_cents": cart_data["discount_cents"],
                        "subtotal_cents": cart_data["subtotal_cents"],
                        "total_cents": cart_data["total_cents"]
                    }
                )
            )
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"Failed to apply promo code: {str(e)}")
            )

    async def initiate_checkout(self, db: AsyncSession, request: Request, user_id: int, payload: Dict[str, Any]) -> JSONResponse:
        """
        Phase 2: The Pre-Flight Checkout
        Goal: Transition user to Stripe hosted checkout securely.
        """
        try:
            # 1. Get User and active cart
            user = await self.user_repo.async_get_by_id(db, user_id)
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User not found")
                )

            # Map cart_id from payload if provided, else get active cart
            cart_id = payload.get("cart_id")
            if cart_id:
                # Security: Ensure this cart belongs to the user
                cart = await self.cart_repository.async_get_active_cart(db, user_id)
                if not cart or cart.id != cart_id:
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content=format_response(success=False, error="Invalid cart access")
                    )
            else:
                cart = await self.cart_repository.async_get_active_cart(db, user_id)

            if not cart or not cart.items:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(success=False, error="Cart is empty")
                )

            # 2. Calculate Totals Securely (Do not trust frontend prices)
            subtotal_cents = 0
            line_items = []
            
            for item in cart.items:
                # Each item.track_format is already loaded via selectinload in repository
                price = item.track_format.price_cents
                subtotal_cents += price
                
                line_items.append({
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": f"{item.track_format.track.title} ({item.track_format.audio_format.upper()})",
                            "description": f"Artist: {item.track_format.track.display_artist or 'Various'}",
                            "metadata": {
                                "track_uuid": item.track_format.track.uuid,
                                "format_id": item.track_format.id
                            }
                        },
                        "unit_amount": price,
                    },
                    "quantity": 1,
                })

            # Handle Promo Codes (Phase 6 placeholder)
            total_cents = subtotal_cents # For now, simple sum
            discount_cents = 0
            promo_code_id = None
            
            if cart.promo_code:
                promo_code_id = cart.promo_code.id
                # Calculate discount based on type
                if cart.promo_code.discount_type == "percentage":
                    discount_cents = int(subtotal_cents * (cart.promo_code.discount_value / 100))
                else: # fixed_amount
                    discount_cents = cart.promo_code.discount_value
                
                total_cents = max(0, subtotal_cents - discount_cents)

            # 3. Create Pending Order
            order = await self.order_service.create_pending_order(
                db, 
                user_id=user.id,
                subtotal_cents=subtotal_cents,
                total_cents=total_cents,
                promo_code_id=promo_code_id,
                discount_cents=discount_cents
            )

            # 4. Create Stripe Session
            # Ensure stripe_customer_id exists
            if not user.stripe_customer_id:
                try:
                    customer = stripe.Customer.create(
                        email=user.email,
                        name=user.name or user.username,
                        metadata={"user_id": user.id, "user_uuid": user.uuid}
                    )
                    user.stripe_customer_id = customer.id
                    # Note: We rely on the caller or a subsequent commit to save this
                except Exception as e:
                    logger.error(f"Stripe Customer creation failed: {e}")
                    # Fallback to creating session without customer ID if needed, 
                    # but usually better to have it.

            checkout_session = stripe.checkout.Session.create(
                customer=user.stripe_customer_id,
                payment_method_types=["card"],
                line_items=line_items,
                mode="payment",
                success_url=f"{settings.frontend_url}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{settings.frontend_url}/cart",
                metadata={
                    "internal_order_id": order.id,
                    "user_id": user.id,
                    "cart_id": cart.id
                },
                # allow_promotion_codes=True if not promo_code_id else False 
                # (If we applied a local promo, we might not want them to add another in Stripe)
                allow_promotion_codes=True
            )

            # Update order with session ID (for tracking)
            order.stripe_session_id = checkout_session.id
            await db.commit()

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data={
                        "stripe_url": checkout_session.url,
                        "session_id": checkout_session.id,
                        "order_id": order.id
                    }
                )
            )
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Checkout initialization failed: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"Failed to initiate checkout: {str(e)}")
            )
