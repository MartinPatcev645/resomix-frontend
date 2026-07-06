"""
Redis Counter Primitives
========================

Atomic building blocks for usage counters. The key call is ``check_and_incr`` — a single
Lua script that reads the counter, and only if it is below the limit does it increment (and
set the TTL on first use). Because it's one atomic server-side operation, concurrent requests
can never overshoot the limit (the classic check-then-increment race).

All functions return ``None`` when Redis is unavailable so callers can decide their policy
(usage enforcement fails **open** — a soft limit must not block users on an infra outage).

Version: 1.0.0
Init Date: July 4, 2026
"""

import logging
from typing import Optional, Tuple

from app.db.redis import get_redis_or_none

logger = logging.getLogger(__name__)

# Atomic "reserve a slot if under limit". Returns {allowed(0/1), count}.
_CHECK_AND_INCR = """
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if cur >= limit then return {0, cur} end
local v = redis.call('INCR', KEYS[1])
if v == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2])) end
return {1, v}
"""

# Plain increment, setting the TTL only on first use (record-on-success pattern).
_INCR_TTL = """
local v = redis.call('INCR', KEYS[1])
if v == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end
return v
"""

# Decrement but never below zero (refund on a failed operation).
_DECR_FLOOR = """
local v = redis.call('DECR', KEYS[1])
if v < 0 then redis.call('SET', KEYS[1], '0'); return 0 end
return v
"""

# Apply a signed delta (may go negative) and (re)set the TTL — used to grant a one-time bonus by
# seeding the counter negative so the effective allowance = limit + |delta| for this period.
_INCR_BY = """
local v = redis.call('INCRBY', KEYS[1], tonumber(ARGV[1]))
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
return v
"""


async def incr_with_ttl(key: str, ttl_seconds: int) -> Optional[int]:
    """Increment a counter (unconditionally), setting the TTL on first use. None if Redis down."""
    client = await get_redis_or_none()
    if client is None:
        return None
    try:
        return int(await client.eval(_INCR_TTL, 1, key, int(ttl_seconds)))
    except Exception as exc:
        logger.warning("redis incr_with_ttl failed for %s: %s", key, exc)
        return None
    finally:
        await client.close()


async def incr_by(key: str, delta: int, ttl_seconds: int) -> Optional[int]:
    """Apply a signed ``delta`` to a counter (may go negative) and (re)set its TTL. None if Redis down."""
    client = await get_redis_or_none()
    if client is None:
        return None
    try:
        return int(await client.eval(_INCR_BY, 1, key, int(delta), int(ttl_seconds)))
    except Exception as exc:
        logger.warning("redis incr_by failed for %s: %s", key, exc)
        return None
    finally:
        await client.close()


async def check_and_incr(key: str, limit: int, ttl_seconds: int) -> Optional[Tuple[bool, int]]:
    """Atomically reserve a slot if under ``limit``. Returns (allowed, count), or None if Redis down."""
    client = await get_redis_or_none()
    if client is None:
        return None
    try:
        res = await client.eval(_CHECK_AND_INCR, 1, key, int(limit), int(ttl_seconds))
        return bool(int(res[0])), int(res[1])
    except Exception as exc:
        logger.warning("redis check_and_incr failed for %s: %s", key, exc)
        return None
    finally:
        await client.close()


async def get_int(key: str) -> Optional[int]:
    client = await get_redis_or_none()
    if client is None:
        return None
    try:
        val = await client.get(key)
        return int(val) if val is not None else 0
    except Exception as exc:
        logger.warning("redis get_int failed for %s: %s", key, exc)
        return None
    finally:
        await client.close()


async def decr(key: str) -> Optional[int]:
    """Refund: decrement without going below zero. Returns new count or None if Redis down."""
    client = await get_redis_or_none()
    if client is None:
        return None
    try:
        return int(await client.eval(_DECR_FLOOR, 1, key))
    except Exception as exc:
        logger.warning("redis decr failed for %s: %s", key, exc)
        return None
    finally:
        await client.close()
