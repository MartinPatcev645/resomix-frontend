"""
Cart Service
============

This service implements the write-through cache pattern for the shopping cart.
It synchronizes state between MariaDB (source of truth) and Redis (fast read cache).
"""

import json
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis
import logging
from sqlalchemy import text, delete

from app.repositories.cart_repository import CartRepository
from app.repositories.playlist_repository import PlaylistRepository
from app.db.redis import _redis_pool
from app.models.ecommerce import CartItem

logger = logging.getLogger(__name__)

class CartService:
    def __init__(self, cart_repository: CartRepository):
        self.cart_repository = cart_repository
        self.playlist_repository = PlaylistRepository()

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
            
            from app.models.track import Track
            from sqlalchemy import select
            
            # Resolve UUIDs to internal IDs using ORM (enables auto-scoping)
            track_res = await db.execute(select(Track.id).where(Track.uuid == track_id_uuid))
            track_row = track_res.first()
            if not track_row: continue
            
            playlist_id_internal = None
            if source_playlist_id_uuid:
                from app.models.playlist import Playlist
                plist_res = await db.execute(select(Playlist.id).where(Playlist.uuid == source_playlist_id_uuid))
                plist_row = plist_res.first()
                if plist_row: playlist_id_internal = plist_row.id

            # Add directly to cart using track_id
            await self.cart_repository.async_add_item(
                db, 
                cart.id, 
                track_row.id, 
                playlist_id_internal
            )
            
        await db.commit()
            
        # Hydrate will re-fetch and update cache
        return await self.hydrate_cart(db, user_id)

    async def remove_item(self, db: AsyncSession, user_id: int, track_id: int) -> Dict[str, Any]:
        """Remove item from cart."""
        cart = await self.cart_repository.async_get_active_cart(db, user_id)
        if cart:
            await self.cart_repository.async_remove_item(db, cart.id, track_id)
            await db.commit()
            
        return await self.hydrate_cart(db, user_id)

    async def clear_cart(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """Clear all items from cart."""
        cart = await self.cart_repository.async_get_active_cart(db, user_id)
        if cart:
            await self.cart_repository.async_clear_cart(db, cart.id)
            cart.promo_code_id = None # clear promo code too
            await db.commit()
            
        return await self.hydrate_cart(db, user_id)

    async def apply_promo(self, db: AsyncSession, user_id: int, code: str) -> Dict[str, Any]:
        """Apply a promo code."""
        cart = await self.cart_repository.async_get_active_cart(db, user_id)
        if not cart:
            return {"error": "Cart not found"}
            
        promo = await self.cart_repository.async_get_promo_code(db, code)
        if not promo:
            return {"error": "Invalid or expired promo code"}
            
        await self.cart_repository.async_apply_promo_code(db, cart.id, promo.id)
        await db.commit()
        
        return await self.hydrate_cart(db, user_id)

    async def add_playlist(self, db: AsyncSession, user_id: int, playlist_uuid: str) -> Dict[str, Any]:
        """Add an entire playlist to the cart."""
        from app.models.playlist import Playlist
        from sqlalchemy import select
        
        plist_res = await db.execute(select(Playlist.id).where(Playlist.uuid == playlist_uuid))
        plist_row = plist_res.first()
        if not plist_row:
            return await self.hydrate_cart(db, user_id)
        
        internal_playlist_id = plist_row.id
        
        # 2. Get tracks in playlist
        tracks = await self.playlist_repository.async_get_tracks_by_playlist_id(db, internal_playlist_id)
        
        # 3. Add each track (AIFF format) to cart
        items_to_add = []
        for pt in tracks:
            from app.models.track import Track
            t_res = await db.execute(select(Track.uuid).where(Track.id == pt.track_id))
            t_row = t_res.first()
            if t_row:
                items_to_add.append({
                    "track_id": t_row.uuid,
                    "source_playlist_id": playlist_uuid
                })
        
        return await self.add_items(db, user_id, items_to_add)

    async def remove_playlist(self, db: AsyncSession, user_id: int, playlist_uuid: str) -> Dict[str, Any]:
        """Remove all items belonging to a source playlist from the cart."""
        cart = await self.cart_repository.async_get_active_cart(db, user_id)
        if not cart:
            return await self.hydrate_cart(db, user_id)

        from app.models.playlist import Playlist
        plist_res = await db.execute(select(Playlist.id).where(Playlist.uuid == playlist_uuid))
        plist_row = plist_res.first()
        if not plist_row:
            return await self.hydrate_cart(db, user_id)

        stmt = delete(CartItem).where(
            CartItem.cart_id == cart.id,
            CartItem.source_playlist_id == plist_row.id
        )
        await db.execute(stmt)
        await db.commit()
            
        return await self.hydrate_cart(db, user_id)
