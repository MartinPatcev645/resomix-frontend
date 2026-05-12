"""
Rate Limit Service
==================

This service implements a dual-layer rate limiting strategy for B2B Partners:
1. Layer 1 (Burst): Token-Bucket algorithm for requests-per-second protection.
2. Layer 2 (Quota): Atomic counter for monthly request caps.

Uses Redis Lua scripts for atomicity and performance.

Version: 1.0.1
Date: May 12, 2026
"""

import time
import logging
from typing import Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis
from app.db import redis as redis_module

logger = logging.getLogger(__name__)

# Lua script for atomic Token Bucket rate limiting (Burst/Layer 1)
# KEYS[1]: Redis key for the bucket (e.g., ratelimit:burst:123)
# ARGV[1]: Current timestamp (float)
# ARGV[2]: Rate (tokens per second)
# ARGV[3]: Capacity (max tokens)
# ARGV[4]: Requested tokens (usually 1)
# ARGV[5]: TTL (seconds to keep the bucket key)
TOKEN_BUCKET_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

-- Calculate refill based on time passed
local delta = math.max(0, now - last_refill)
tokens = math.min(capacity, tokens + (delta * rate))

local allowed = false
if tokens >= requested then
    tokens = tokens - requested
    allowed = true
end

local wait_time = 0
if not allowed then
    wait_time = (requested - tokens) / rate
end

-- Store updated state
redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('EXPIRE', key, ttl)

return {allowed and 1 or 0, tokens, wait_time}
"""

# Lua script for Monthly Quota (Layer 2)
# KEYS[1]: Redis key for monthly counter (e.g., ratelimit:quota:123:2026-05)
# ARGV[1]: Quota limit
# ARGV[2]: Requested tokens (usually 1)
# ARGV[3]: TTL (35 days in seconds)
MONTHLY_QUOTA_LUA = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local requested = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local current = tonumber(redis.call('GET', key) or "0")

if current + requested > limit then
    return {0, current}
end

local new_val = redis.call('INCRBY', key, requested)
if new_val == requested then
    redis.call('EXPIRE', key, ttl)
end

return {1, new_val}
"""

class RateLimitService:
    """
    Dual-layer rate limiting service for B2B Partners.
    Evaluates both short-term burst limits and long-term monthly quotas.
    """

    async def check_rate_limits(
        self, 
        db: AsyncSession,
        api_key_id: int, 
        partner_id: int,
        rps_limit: int, 
        monthly_limit: int
    ) -> Tuple[bool, str, Optional[float]]:
        """
        Evaluate both burst and monthly rate limits for an API key.
        
        Args:
            api_key_id: Internal database ID of the API key
            rps_limit: Configured requests-per-second for this key
            monthly_limit: Configured monthly request cap for this key
            
        Returns:
            Tuple containing:
            - is_allowed (bool): True if both limits are passed
            - error_code (str): "RATE_LIMIT_EXCEEDED" or "QUOTA_EXCEEDED" if blocked
            - retry_after (float): Recommended wait time in seconds (for burst)
        """
        pool = redis_module._redis_pool
        if not pool:
            return True, "", None
        
        try:
            async with aioredis.Redis(connection_pool=pool) as client:
                # 1. Evaluate Layer 1 (Burst - Token Bucket)
                # capacity is RPS * 2 (provides a 2-second burst window)
                burst_key = f"ratelimit:burst:{api_key_id}"
                now = time.time()
                
                # 1. Burst Limit (Token Bucket)
                capacity = rps_limit * 2  # 2-second burst window
                burst_res = await client.eval(
                    TOKEN_BUCKET_LUA,
                    1,
                    burst_key,
                    now,
                    rps_limit,
                    capacity,
                    1,
                    60
                )
                
                burst_allowed = burst_res[0] == 1
                wait_time = float(burst_res[2]) if len(burst_res) > 2 else 1.0
                
                if not burst_allowed:
                    return False, "RATE_LIMIT_EXCEEDED", wait_time

                # 2. Evaluate Layer 2 (Monthly Quota)
                # Use current year-month for the Redis key
                month_str = time.strftime("%Y-%m")
                quota_key = f"ratelimit:quota:{partner_id}:{api_key_id}:{month_str}"
                
                # OPTION B: Cache Warming
                # If the key is missing in Redis (e.g. after a flush), 
                # warm it up from the database first.
                if not await client.exists(quota_key):
                    db_usage = await self._get_db_usage(db, api_key_id, month_str)
                    # Set the value in Redis only if it still doesn't exist (NX)
                    # Use 35-day TTL to ensure it survives the month
                    await client.set(quota_key, db_usage, ex=35*86400, nx=True)

                # Execute Lua script for atomic quota increment
                # Returns [allowed_int, current_usage]
                res_quota = await client.eval(
                    MONTHLY_QUOTA_LUA,
                    1, # num keys
                    quota_key,
                    monthly_limit, 1, 35 * 86400 # 35 days TTL
                )
                
                allowed_quota_int = res_quota[0]
                
                if not bool(allowed_quota_int):
                    return False, "QUOTA_EXCEEDED", None

                return True, "", None
        except Exception as e:
            logger.error(f"Rate limit service error: {e}", exc_info=True)
            # Fail open to ensure availability if Redis is flapping
            return True, "", None

    async def _get_db_usage(self, db: AsyncSession, api_key_id: int, year_month: str) -> int:
        """Helper to get current month usage from MariaDB."""
        from sqlalchemy import text
        from datetime import date
        
        try:
            year, month = map(int, year_month.split("-"))
            period_start = date(year, month, 1)
            
            from app.models.partner import PartnerQuota
            from sqlalchemy import select
            
            stmt = select(PartnerQuota.requests_made).where(
                PartnerQuota.api_key_id == api_key_id,
                PartnerQuota.period_start == period_start
            )
            result = await db.execute(stmt)
            return result.scalar() or 0
        except Exception as e:
            logger.error(f"Failed to warm quota cache from DB: {e}")
            return 0
