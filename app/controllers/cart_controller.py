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

    async def remove_from_cart(self, db: AsyncSession, request: Request, user_id: int, track_id: int) -> JSONResponse:
        try:
            await self.cart_service.remove_item(db, user_id, track_id)
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
            checkout_data = await self.cart_service.initiate_checkout(db, user_id, payload)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data=checkout_data
                )
            )
        except ValueError as e:
            error_str = str(e)
            status_code = status.HTTP_404_NOT_FOUND if "User not found" in error_str else status.HTTP_400_BAD_REQUEST
            return JSONResponse(
                status_code=status_code,
                content=format_response(success=False, error=error_str)
            )
        except PermissionError as e:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content=format_response(success=False, error=str(e))
            )
        except Exception as e:
            logger.error(f"Checkout initialization failed: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"Failed to initiate checkout: {str(e)}")
            )
