"""
Usage Counter Service
=====================

Daily usage counters for frontend callers — both **guests** (keyed by ``visitor_id``) and
**logged-in users** (keyed by user id). Backed by Redis with a per-day, UTC-stamped key that
self-clears via TTL, so nothing accumulates.

Key: ``usage:{subject_type}:{subject_id}:{feature}:{YYYY-MM-DD-UTC}``

The reset boundary is **UTC calendar day** (one fixed timezone everywhere, no DST drift). The
core operation is an atomic reserve (``try_consume``) so concurrency can't exceed the limit;
a failed downstream op can ``refund``.

Version: 1.0.0
Init Date: July 4, 2026
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from app.services import redis_counter


def _utc_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _seconds_to_utc_midnight() -> int:
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int((tomorrow - now).total_seconds()) + 60  # +60s buffer past the boundary


class UsageCounterService:
    """Per-subject, per-feature daily counters (UTC reset)."""

    @staticmethod
    def _key(subject_type: str, subject_id: str, feature_key: str) -> str:
        return f"usage:{subject_type}:{subject_id}:{feature_key}:{_utc_date()}"

    async def try_consume(
        self, subject_type: str, subject_id: str, feature_key: str, limit: int
    ) -> Optional[Tuple[bool, int]]:
        """Atomically reserve one unit if today's usage is below ``limit``.

        Returns (allowed, count_after), or **None** if Redis is unavailable (caller decides —
        enforcement fails open). ``limit <= 0`` denies without touching Redis.
        """
        if limit <= 0:
            return (False, 0)
        return await redis_counter.check_and_incr(
            self._key(subject_type, subject_id, feature_key), limit, _seconds_to_utc_midnight()
        )

    async def peek(self, subject_type: str, subject_id: str, feature_key: str) -> Optional[int]:
        """Today's usage count (0 if none, None if Redis down)."""
        return await redis_counter.get_int(self._key(subject_type, subject_id, feature_key))

    async def refund(self, subject_type: str, subject_id: str, feature_key: str) -> Optional[int]:
        """Give back one reserved unit (e.g. the operation failed after reserving)."""
        return await redis_counter.decr(self._key(subject_type, subject_id, feature_key))
