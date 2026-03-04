import redis.asyncio as redis
from typing import AsyncGenerator
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# Connection pool for Redis
_redis_pool = None


async def init_redis_pool() -> None:
    """Initialize the Redis connection pool."""
    global _redis_pool
    if _redis_pool is None:
        try:
            redis_url = getattr(settings, "redis_url", "redis://localhost:6379/0")
            _redis_pool = redis.ConnectionPool.from_url(
                redis_url, decode_responses=True, max_connections=10
            )
            # Test connection
            client = redis.Redis(connection_pool=_redis_pool)
            await client.ping()
            await client.close()
            logger.info("Successfully connected to Redis.")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            _redis_pool = None


async def close_redis_pool() -> None:
    """Close the Redis connection pool."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.disconnect()
        _redis_pool = None
        logger.info("Redis connection pool closed.")


async def get_redis_client() -> AsyncGenerator[redis.Redis, None]:
    """Dependency to get a Redis client from the pool."""
    if _redis_pool is None:
        await init_redis_pool()

    client = redis.Redis(connection_pool=_redis_pool)
    try:
        yield client
    finally:
        await client.close()
