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

    @staticmethod
    def _bonus_key(subject_type: str, subject_id: str, feature_key: str, period_key: str) -> str:
        """Sibling key recording how big this period's one-time bonus was.

        The bonus itself is applied by seeding the counter NEGATIVE, which enforcement handles
        correctly but reporting cannot: a raw count of ``-1`` is indistinguishable from "granted 2,
        used 1" and "granted 5, used 4", so the chip rendered a literal **-1/3**. This key keeps the
        grant size so `usage_snapshot` can report a stable `1/5` instead.

        Purely cosmetic — nothing reads it to decide whether an operation may proceed, so losing it
        to an eviction degrades the display, never the enforcement.
        """
        return f"usage:{subject_type}:{subject_id}:{feature_key}:bonus:{period_key}"

    async def try_consume(
        self, subject_type: str, subject_id: str, feature_key: str,
        limit: int, period_key: str, ttl_seconds: int,
    ) -> Optional[Tuple[bool, int]]:
        """Atomically reserve one unit if this period's usage is below ``limit``.

        Returns (allowed, count_after), or **None** if Redis is unavailable (caller decides —
        enforcement fails open). ``limit == 0`` denies without touching Redis; ``limit < 0``
        is unlimited and is short-circuited by the gate before reaching here.
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

    async def exists(
        self, subject_type: str, subject_id: str, feature_key: str, period_key: str
    ) -> Optional[bool]:
        """Whether this period's counter is present. None if Redis is down."""
        return await redis_counter.exists(
            self._key(subject_type, subject_id, feature_key, period_key)
        )

    async def seed_if_absent(
        self, subject_type: str, subject_id: str, feature_key: str,
        value: int, period_key: str, ttl_seconds: int,
    ) -> Optional[bool]:
        """Rehydrate this period's counter from the durable store, only if Redis lost it."""
        return await redis_counter.seed_if_absent(
            self._key(subject_type, subject_id, feature_key, period_key), value, ttl_seconds
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

    async def grant_bonus(
        self, subject_type: str, subject_id: str, feature_key: str,
        amount: int, period_key: str, ttl_seconds: int,
    ) -> Optional[int]:
        """Seed the counter negative by ``amount`` — a one-time bonus, so this period's effective
        allowance becomes ``limit + amount``. The limit itself stays plan-resolved (not snapshotted),
        so a mid-period up/downgrade adjusts automatically. None if Redis down or ``amount <= 0``."""
        if amount <= 0:
            return None
        result = await redis_counter.incr_by(
            self._key(subject_type, subject_id, feature_key, period_key), -int(amount), ttl_seconds
        )
        # Best-effort, and deliberately AFTER the grant: the bonus must land even if this bookkeeping
        # fails. A missing bonus key costs an odd-looking denominator; a missing grant costs the user
        # allowance they were promised.
        try:
            await redis_counter.incr_by(
                self._bonus_key(subject_type, subject_id, feature_key, period_key),
                int(amount), ttl_seconds,
            )
        except Exception:  # noqa: BLE001 — see above
            pass
        return result

    async def peek_bonus(
        self, subject_type: str, subject_id: str, feature_key: str, period_key: str
    ) -> Optional[int]:
        """How much one-time bonus was granted for this period (0 if none, None if Redis down)."""
        return await redis_counter.get_int(
            self._bonus_key(subject_type, subject_id, feature_key, period_key)
        )
