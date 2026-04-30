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
from app.repositories.cart_repository import CartRepository
from app.utils.response_utils import format_response

class CartController:
    def __init__(self):
        self.cart_repository = CartRepository()
        self.cart_service = CartService(self.cart_repository)

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

    async def create_checkout_session(self, db: AsyncSession, request: Request, user_id: int) -> JSONResponse:
        try:
            # 1. Get the current cart
            cart_data = await self.cart_service.hydrate_cart(db, user_id)
            
            if not cart_data.get("items"):
                return format_response(
                    success=False,
                    error="Cart is empty",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            # 2. Mock Stripe session creation
            # We would normally use stripe.checkout.Session.create(...) here
            
            # TODO: Integrate actual Stripe SDK when keys are ready
            mock_session_url = "https://checkout.stripe.com/c/pay/cs_test_mock_session_url_123"
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data={
                        "stripe_url": mock_session_url
                    }
                )
            )
            
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error=f"Failed to create checkout session: {str(e)}")
            )
