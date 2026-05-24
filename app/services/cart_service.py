"""
Cart Service
============

This service implements the write-through cache pattern for the shopping cart.
It synchronizes state between MariaDB (source of truth) and Redis (fast read cache).
"""

import json
import stripe
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis
import logging

from app.repositories.cart_repository import CartRepository
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository
from app.repositories.user_repository import UserRepository
from app.services.order_service import OrderService
from app.core.config import settings
from app.db.redis import _redis_pool

logger = logging.getLogger(__name__)

class CartService:
    def __init__(self, cart_repository: CartRepository):
        self.cart_repository = cart_repository
        self.playlist_repository = PlaylistRepository()
        self.track_repository = TrackRepository()

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        if _redis_pool:
            return aioredis.Redis(connection_pool=_redis_pool)
        return None

    def _get_cart_key(self, user_id: int) -> str:
        return f"user_cart:{user_id}"

    async def _serialize_cart(self, db: AsyncSession, cart) -> Dict[str, Any]:
        """Serialize a SQLAlchemy Cart object to dictionary matching frontend contract."""
        items = []
        subtotal = 0
        
        for item in cart.items:
            track = item.track
            # Combine artist names from relationship
            artists_list = [tc.contributor.full_name for tc in track.recording_contributors if tc.contributor]
            artist_name = ", ".join(artists_list) if artists_list else "Unknown Artist"

            items.append({
                "id": item.id,
                "track_id": track.uuid,
                "track_id_internal": item.track_id,
                "source_playlist_id": item.source_playlist_id,
                "title": track.title,
                "artist": artist_name,
                "format_name": "AIFF",
                "price_cents": item.price_cents
            })
            subtotal += item.price_cents

        discount = 0
        if cart.promo_code:
            if cart.promo_code.discount_type == "percentage":
                discount = int(subtotal * (cart.promo_code.discount_value / 100))
            else:
                discount = cart.promo_code.discount_value

        total = max(0, subtotal - discount)

        return {
            "items": items,
            "subtotal_cents": subtotal,
            "discount_cents": discount,
            "total_cents": total,
            "promo_code": cart.promo_code.code if cart.promo_code else None,
            "item_count": len(items)
        }

    async def hydrate_cart(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """Get cart from Redis, fallback to MariaDB."""
        redis_client = await self._get_redis()
        cart_key = self._get_cart_key(user_id)

        # Try Redis
        if redis_client:
            cached = await redis_client.get(cart_key)
            if cached:
                try:
                    return json.loads(cached)
                except json.JSONDecodeError:
                    pass

        # Fallback to DB
        cart = await self.cart_repository.async_get_active_cart(db, user_id)
        if not cart:
            cart = await self.cart_repository.async_create_cart(db, user_id)
            # Need to fetch again with relations
            cart = await self.cart_repository.async_get_active_cart(db, user_id)

        cart_data = await self._serialize_cart(db, cart)

        # Update Redis
        if redis_client:
            await redis_client.setex(cart_key, 3600 * 24, json.dumps(cart_data)) # 24 hour TTL
            await redis_client.close()

        return cart_data

    async def add_items(
        self, db: AsyncSession, user_id: int, items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Add items to cart (Write-Through)."""
        cart = await self.cart_repository.async_get_active_cart(db, user_id)
        if not cart:
            cart = await self.cart_repository.async_create_cart(db, user_id)

        for item in items:
            track_id_uuid = item.get("track_id")
            source_playlist_id_uuid = item.get("source_playlist_id")
            
            track_id_internal = await self.track_repository.async_get_id_by_uuid(db, track_id_uuid)
            if not track_id_internal:
                continue
            
            playlist_id_internal = None
            if source_playlist_id_uuid:
                playlist_id_internal = await self.playlist_repository.async_get_id_by_uuid(db, source_playlist_id_uuid)

            # Add directly to cart using track_id
            await self.cart_repository.async_add_item(
                db, 
                cart.id, 
                track_id_internal, 
                playlist_id_internal,
                commit=True
            )
            
        # Hydrate will re-fetch and update cache
        return await self.hydrate_cart(db, user_id)

    async def remove_item(self, db: AsyncSession, user_id: int, track_id: int) -> Dict[str, Any]:
        """Remove item from cart."""
        cart = await self.cart_repository.async_get_active_cart(db, user_id)
        if cart:
            await self.cart_repository.async_remove_item(db, cart.id, track_id, commit=True)
            
        return await self.hydrate_cart(db, user_id)

    async def clear_cart(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """Clear all items from cart."""
        cart = await self.cart_repository.async_get_active_cart(db, user_id)
        if cart:
            await self.cart_repository.async_clear_cart(db, cart.id, commit=False)
            await self.cart_repository.async_apply_promo_code(db, cart.id, None, commit=True)
            
        return await self.hydrate_cart(db, user_id)

    async def apply_promo(self, db: AsyncSession, user_id: int, code: str) -> Dict[str, Any]:
        """Apply a promo code."""
        cart = await self.cart_repository.async_get_active_cart(db, user_id)
        if not cart:
            return {"error": "Cart not found"}
            
        promo = await self.cart_repository.async_get_promo_code(db, code)
        if not promo:
            return {"error": "Invalid or expired promo code"}
            
        await self.cart_repository.async_apply_promo_code(db, cart.id, promo.id, commit=True)
        
        return await self.hydrate_cart(db, user_id)

    async def add_playlist(self, db: AsyncSession, user_id: int, playlist_uuid: str) -> Dict[str, Any]:
        """Add an entire playlist to the cart."""
        internal_playlist_id = await self.playlist_repository.async_get_id_by_uuid(db, playlist_uuid)
        if not internal_playlist_id:
            return await self.hydrate_cart(db, user_id)
        
        # 2. Get tracks in playlist
        tracks = await self.playlist_repository.async_get_tracks_by_playlist_id(db, internal_playlist_id)
        
        # 3. Add each track (AIFF format) to cart
        items_to_add = []
        for pt in tracks:
            track_uuid = await self.track_repository.async_get_uuid_by_id(db, pt.track_id)
            if track_uuid:
                items_to_add.append({
                    "track_id": track_uuid,
                    "source_playlist_id": playlist_uuid
                })
        
        return await self.add_items(db, user_id, items_to_add)

    async def remove_playlist(self, db: AsyncSession, user_id: int, playlist_uuid: str) -> Dict[str, Any]:
        """Remove all items belonging to a source playlist from the cart."""
        cart = await self.cart_repository.async_get_active_cart(db, user_id)
        if not cart:
            return await self.hydrate_cart(db, user_id)

        internal_playlist_id = await self.playlist_repository.async_get_id_by_uuid(db, playlist_uuid)
        if not internal_playlist_id:
            return await self.hydrate_cart(db, user_id)

        await self.cart_repository.async_remove_items_by_source_playlist_id(
            db, cart.id, internal_playlist_id, commit=True
        )
            
        return await self.hydrate_cart(db, user_id)

    async def initiate_checkout(self, db: AsyncSession, user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Securely transition user to Stripe hosted checkout.
        Manages all database transaction boundaries internally.
        """
        # Ensure Stripe API key is set
        stripe.api_key = settings.stripe_secret_key
        
        try:
            # 1. Get User and active cart
            user_repo = UserRepository()
            user = await user_repo.async_get_by_id(db, user_id)
            if not user:
                raise ValueError("User not found")

            # Map cart_id from payload if provided, else get active cart
            cart_id = payload.get("cart_id")
            if cart_id:
                # Security: Ensure this cart belongs to the user
                cart = await self.cart_repository.async_get_active_cart(db, user_id)
                if not cart or cart.id != cart_id:
                    raise PermissionError("Invalid cart access")
            else:
                cart = await self.cart_repository.async_get_active_cart(db, user_id)

            if not cart or not cart.items:
                raise ValueError("Cart is empty")

            # 2. Calculate Totals Securely (Do not trust frontend prices)
            subtotal_cents = 0
            line_items = []
            
            for item in cart.items:
                # Each item.track is already loaded via selectinload in repository
                price = item.price_cents
                subtotal_cents += price
                
                line_items.append({
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": f"{item.track.title} (AIFF)",
                            "description": f"Artist: {item.track.display_artist or 'Various'}",
                            "metadata": {
                                "track_uuid": item.track.uuid,
                                "track_id": item.track.id
                            }
                        },
                        "unit_amount": price,
                    },
                    "quantity": 1,
                })

            # Handle Promo Codes
            total_cents = subtotal_cents
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
            order_service = OrderService()
            order = await order_service.create_pending_order(
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
                except Exception as e:
                    logger.error(f"Stripe Customer creation failed: {e}")

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
                allow_promotion_codes=True
            )

            # Update order with session ID (for tracking)
            order.stripe_session_id = checkout_session.id
            await db.commit()

            return {
                "stripe_url": checkout_session.url,
                "session_id": checkout_session.id,
                "order_id": order.id
            }
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Checkout initialization failed: {str(e)}")
            raise e
