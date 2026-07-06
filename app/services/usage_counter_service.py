"""
Usage Counter Service
=====================

Per-**month** usage counters for frontend callers — both **guests** (keyed by ``visitor_id``) and
**logged-in users** (keyed by user id). Backed by Redis with a per-period key that self-clears via
TTL, so nothing accumulates.

Key: ``usage:{subject_type}:{subject_id}:{feature}:{period_key}``

The period boundary is **monthly**, anchored per subject (subscriber → Stripe billing cycle,
free → signup anniversary, guest → calendar month). The caller computes ``(period_key,
ttl_seconds)`` via ``BillingPeriodService`` and passes them in, so this service stays a thin,
period-agnostic counter. The core operation is an atomic reserve (``try_consume``) so concurrency
can't exceed the limit; a failed downstream op can ``refund``.

Version: 2.0.0
Init Date: July 4, 2026
"""

from typing import Optional, Tuple

from app.services import redis_counter


class UsageCounterService:
    """Per-subject, per-feature counters for a caller-supplied period window."""

    @staticmethod
    def _key(subject_type: str, subject_id: str, feature_key: str, period_key: str) -> str:
        return f"usage:{subject_type}:{subject_id}:{feature_key}:{period_key}"

    async def try_consume(
        self, subject_type: str, subject_id: str, feature_key: str,
        limit: int, period_key: str, ttl_seconds: int,
    ) -> Optional[Tuple[bool, int]]:
        """Atomically reserve one unit if this period's usage is below ``limit``.

        Returns (allowed, count_after), or **None** if Redis is unavailable (caller decides —
        enforcement fails open). ``limit <= 0`` denies without touching Redis.
        """
        if limit <= 0:
            return (False, 0)
        return await redis_counter.check_and_incr(
            self._key(subject_type, subject_id, feature_key, period_key), limit, ttl_seconds
        )

    async def peek(
        self, subject_type: str, subject_id: str, feature_key: str, period_key: str
    ) -> Optional[int]:
        """This period's usage count (0 if none, None if Redis down)."""
        return await redis_counter.get_int(
            self._key(subject_type, subject_id, feature_key, period_key)
        )

    async def refund(
        self, subject_type: str, subject_id: str, feature_key: str, period_key: str
    ) -> Optional[int]:
        """Give back one reserved unit (e.g. the operation failed after reserving)."""
        return await redis_counter.decr(
            self._key(subject_type, subject_id, feature_key, period_key)
        )

    async def increment(
        self, subject_type: str, subject_id: str, feature_key: str,
        period_key: str, ttl_seconds: int,
    ) -> Optional[int]:
        """Record one use unconditionally (record-on-success; no limit check). None if Redis down."""
        return await redis_counter.incr_with_ttl(
            self._key(subject_type, subject_id, feature_key, period_key), ttl_seconds
        )
