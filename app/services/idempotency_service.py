"""
Idempotency Service
===================

This service manages request idempotency using Redis as a short-term cache.
It allows the API to recognize duplicate requests (via Idempotency-Key) 
and return the previously calculated response without re-executing business logic.

Key Features:
- Redis-backed storage for request/response mapping.
- Partner-scoped keys to prevent cross-tenant collisions.
- JSON serialization for response data and headers.
- Configurable TTL (default 24 hours).

Version: 1.0.0
Date: May 2026
"""

import json
import logging
from typing import Optional, Dict, Any, Tuple
import redis.asyncio as aioredis
from app.db import redis as redis_module

logger = logging.getLogger(__name__)

class IdempotencyService:
    """
    Service to handle idempotency key storage and retrieval in Redis.
    """
    
    def __init__(self, ttl: int = 86400):
        """
        Initialize with a specific TTL (seconds). Default is 24 hours.
        """
        self.ttl = ttl
        self.key_prefix = "idempotency"

    def _generate_key(self, partner_id: int, idempotency_key: str) -> str:
        """Generate a scoped Redis key."""
        return f"{self.key_prefix}:{partner_id}:{idempotency_key}"

    async def get_stored_response(
        self, partner_id: int, idempotency_key: str
    ) -> Optional[Tuple[int, Dict[str, Any], Dict[str, str]]]:
        """
        Check if an idempotency key exists and return the cached response.
        
        Returns:
            Tuple of (status_code, body_dict, headers_dict) or None if not found.
        """
        pool = redis_module._redis_pool
        if not pool:
            return None

        redis_key = self._generate_key(partner_id, idempotency_key)
        
        try:
            async with aioredis.Redis(connection_pool=pool) as client:
                data = await client.get(redis_key)
                if not data:
                    return None
                
                cached = json.loads(data)
                return (
                    cached.get("status_code", 200),
                    cached.get("body", {}),
                    cached.get("headers", {})
                )
        except Exception as e:
            logger.error(f"Failed to retrieve idempotency key {idempotency_key}: {e}")
            return None

    async def save_response(
        self, 
        partner_id: int, 
        idempotency_key: str, 
        status_code: int, 
        body: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Store a response in Redis for a given idempotency key.
        """
        pool = redis_module._redis_pool
        if not pool:
            return False

        redis_key = self._generate_key(partner_id, idempotency_key)
        
        payload = {
            "status_code": status_code,
            "body": body,
            "headers": headers or {}
        }
        
        try:
            async with aioredis.Redis(connection_pool=pool) as client:
                await client.set(
                    redis_key, 
                    json.dumps(payload), 
                    ex=self.ttl
                )
                return True
        except Exception as e:
            logger.error(f"Failed to save idempotency key {idempotency_key}: {e}")
            return False

    async def delete_key(self, partner_id: int, idempotency_key: str) -> bool:
        """Manual cleanup of a key if needed."""
        pool = redis_module._redis_pool
        if not pool:
            return False

        redis_key = self._generate_key(partner_id, idempotency_key)
        try:
            async with aioredis.Redis(connection_pool=pool) as client:
                await client.delete(redis_key)
                return True
        except Exception as e:
            logger.error(f"Failed to delete idempotency key {idempotency_key}: {e}")
            return False
