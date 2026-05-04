"""
Purchases Router
================

This router handles the e-commerce endpoints including cart and checkout operations.
Aligned with documented contract.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.api.dependencies.database import get_database_session
from app.api.dependencies.auth import get_current_user
from app.controllers.cart_controller import CartController
from app.models.user import User

router = APIRouter(tags=["ecommerce"])
cart_controller = CartController()

class AddToCartRequest(BaseModel):
    items: Optional[List[Dict[str, Any]]] = None # [{"track_id": str, "source_playlist_id": str}]
    playlist_id: Optional[str] = None

class PromoRequest(BaseModel):
    code: str

class InitiateCheckoutRequest(BaseModel):
    cart_id: Optional[int] = None


@router.get("/cart")
async def get_cart(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """Hydrate the active cart for the user."""
    return await cart_controller.get_cart(db, request, current_user.id)


@router.post("/cart/add")
async def add_to_cart(
    request: Request,
    payload: AddToCartRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """Add items (Option A) or a playlist (Option B) to the cart."""
    return await cart_controller.add_to_cart(db, request, current_user.id, payload.dict())


@router.delete("/cart/remove/{track_id}")
async def remove_from_cart(
    request: Request,
    track_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """Remove a specific track from the cart."""
    return await cart_controller.remove_from_cart(db, request, current_user.id, track_id)


@router.delete("/cart/remove-playlist/{playlist_id}")
async def remove_playlist_from_cart(
    request: Request,
    playlist_id: str,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """Remove all tracks belonging to a playlist from the cart."""
    return await cart_controller.remove_playlist(db, request, current_user.id, playlist_id)


@router.delete("/cart/clear")
async def clear_cart(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """Clear all items from the cart."""
    return await cart_controller.clear_cart(db, request, current_user.id)


@router.post("/cart/promo")
async def apply_promo(
    request: Request,
    payload: PromoRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """Apply a promo code to the cart."""
    return await cart_controller.apply_promo(db, request, current_user.id, payload.code)


@router.post("/checkout/init")
async def initiate_checkout(
    request: Request,
    payload: InitiateCheckoutRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """
    Phase 2: The Pre-Flight Checkout
    Initializes a pending order and creates a Stripe Checkout Session.
    """
    return await cart_controller.initiate_checkout(db, request, current_user.id, payload.dict())


@router.post("/checkout/create-session")
async def create_checkout_session(
    request: Request,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user)
):
    """Create a Stripe checkout session."""
    return await cart_controller.initiate_checkout(db, request, current_user.id, {})

