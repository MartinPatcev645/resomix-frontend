"""
Entitlement Gate
===============

The single enforcement primitive the endpoints (Phase 5) call. It fuses the *limit* (from
``EntitlementService``) with the *usage* (from ``UsageCounterService``) and the feature's
shape, and returns a **soft** result — never a hard security block. Guests are nudged to log
in; logged-in users are nudged to upgrade.

Feature shapes:
  * **counted** (daily) — ``try_consume`` atomically reserves a slot vs the entitlement.
  * **boolean**         — ``check_boolean`` reads the flag.
  * **cap**             — ``get_cap`` returns the numeric cap; the caller clamps.

Fail-open policy: if Redis is unavailable a counted check is allowed (a soft limit must not
block users on an infra outage). Reserved slots can be ``refund``-ed if the operation fails.

Version: 1.0.0
Init Date: July 4, 2026
"""

from dataclasses import dataclass
from typing import Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.entitlement_keys import FeatureKey
from app.models.user import User
from app.services.billing_period_service import BillingPeriodService
from app.services.entitlement_service import EntitlementService
from app.services.usage_counter_service import UsageCounterService
from app.services.usage_history_service import UsageHistoryService
from app.services import entitlement_metrics

REASON_LOGIN = "login_required"      # guest → sign up for more
REASON_UPGRADE = "upgrade_required"  # user  → upgrade plan


@dataclass
class GateResult:
    allowed: bool
    reason: Optional[str] = None       # login_required | upgrade_required (when denied)
    cta: Optional[str] = None
    limit: Optional[int] = None
    count: Optional[int] = None


def _deny(user: Optional[User], limit: Optional[int] = None, count: Optional[int] = None) -> GateResult:
    if user is None:
        entitlement_metrics.incr(f"gate.deny.{REASON_LOGIN}")
        return GateResult(False, REASON_LOGIN, "Log in to do more.", limit, count)
    entitlement_metrics.incr(f"gate.deny.{REASON_UPGRADE}")
    return GateResult(False, REASON_UPGRADE, "Upgrade your plan for more.", limit, count)


class EntitlementGate:
    def __init__(self) -> None:
        self._entitlements = EntitlementService()
        self._usage = UsageCounterService()
        self._periods = BillingPeriodService()
        self._history = UsageHistoryService()

    @staticmethod
    def _subject(user: Optional[User], visitor_id: Optional[str]) -> Optional[Tuple[str, str]]:
        if user is not None:
            return ("user", str(user.id))
        if visitor_id:
            return ("guest", visitor_id)
        return None

    async def _period(self, db, user: Optional[User], visitor_id: Optional[str]) -> Tuple[str, int]:
        """Current monthly window (period_key, ttl_seconds) for the subject."""
        if user is not None:
            return await self._periods.resolve_for_user(db, user)
        return self._periods.resolve_for_guest()

    async def _window(self, db, user: Optional[User], visitor_id: Optional[str]):
        """Full current window (start, end, period_key, ttl) for the subject."""
        if user is not None:
            return await self._periods.resolve_window_for_user(db, user)
        return self._periods.resolve_window_for_guest()

    async def check_boolean(
        self, db: AsyncSession, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> GateResult:
        allowed = await self._entitlements.get_bool(db, feature_key, user=user, visitor_id=visitor_id)
        return GateResult(True) if allowed else _deny(user)

    async def get_cap(
        self, db: AsyncSession, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> int:
        return await self._entitlements.get_int(db, feature_key, user=user, visitor_id=visitor_id)

    async def check_export(
        self, db: AsyncSession, target: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> GateResult:
        """Allow if the caller can export AND ``target`` is in their allowed export targets."""
        if not await self._entitlements.get_bool(db, FeatureKey.CAN_EXPORT, user=user, visitor_id=visitor_id):
            return _deny(user)
        targets_csv = await self._entitlements.get_str(db, FeatureKey.EXPORT_TARGETS, user=user, visitor_id=visitor_id)
        allowed_targets = {t.strip().lower() for t in targets_csv.split(",") if t.strip()}
        if target.strip().lower() not in allowed_targets:
            return _deny(user)
        return GateResult(True)

    async def try_consume(
        self, db: AsyncSession, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> GateResult:
        """Atomically reserve one unit of a daily-counted feature vs the caller's limit."""
        limit = await self._entitlements.get_int(db, feature_key, user=user, visitor_id=visitor_id)
        if limit <= 0:
            return _deny(user, limit=limit, count=0)

        subject = self._subject(user, visitor_id)
        if subject is None:
            # No identity to count against → fail open (don't block).
            return GateResult(True, limit=limit)

        period_key, ttl = await self._period(db, user, visitor_id)
        result = await self._usage.try_consume(subject[0], subject[1], feature_key, limit, period_key, ttl)
        if result is None:
            # Redis unavailable → fail open (soft limit must not block on infra failure).
            entitlement_metrics.incr("gate.fail_open")
            return GateResult(True, limit=limit)

        allowed, count = result
        if allowed:
            return GateResult(True, limit=limit, count=count)
        return _deny(user, limit=limit, count=count)

    async def refund(
        self, db, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> None:
        """Return a previously reserved unit (operation failed after reserving)."""
        subject = self._subject(user, visitor_id)
        if subject is not None:
            period_key, _ttl = await self._period(db, user, visitor_id)
            await self._usage.refund(subject[0], subject[1], feature_key, period_key)

    async def peek_allowed(
        self, db: AsyncSession, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> GateResult:
        """Check (without consuming) whether a counted feature is under limit today.

        Paired with ``record_use`` after the operation succeeds (record-on-success) — avoids
        refund complexity on the many early-return failure paths. Fails open if Redis is down.
        """
        limit = await self._entitlements.get_int(db, feature_key, user=user, visitor_id=visitor_id)
        if limit <= 0:
            return _deny(user, limit=limit, count=0)
        subject = self._subject(user, visitor_id)
        if subject is None:
            return GateResult(True, limit=limit)
        period_key, _ttl = await self._period(db, user, visitor_id)
        count = await self._usage.peek(subject[0], subject[1], feature_key, period_key)
        if count is None:
            entitlement_metrics.incr("gate.fail_open")
            return GateResult(True, limit=limit)  # Redis down → fail open
        if count >= limit:
            return _deny(user, limit=limit, count=count)
        return GateResult(True, limit=limit, count=count)

    async def record_use(
        self, db, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> None:
        """Record one successful use of a counted feature (after the operation succeeded)."""
        subject = self._subject(user, visitor_id)
        if subject is None:
            return
        start, end, period_key, ttl = await self._window(db, user, visitor_id)
        await self._usage.increment(subject[0], subject[1], feature_key, period_key, ttl)
        # Durable write-through so this period's usage survives the Redis TTL (best-effort; a
        # failure here must never break the upload / playlist creation that just succeeded).
        try:
            limit = await self._entitlements.get_int(db, feature_key, user=user, visitor_id=visitor_id)
            plan = await self._entitlements.get_effective_plan(db, user)
            await self._history.record(
                subject[0], subject[1], plan.id if plan else None, feature_key, start, end, limit
            )
        except Exception:
            pass

    async def grant_playlist_signup_bonus(self, db, user: User) -> int:
        """One-time signup bonus: grant ``signup_bonus_playlists`` EXTRA playlist creations for the
        user's current monthly period (seeds the counter negative). Returns the granted amount (0 if
        none / Redis down). Idempotency is the caller's responsibility — call exactly once, on the
        FIRST email verification. Best-effort (fails soft)."""
        if user is None:
            return 0
        amount = await self._entitlements.get_int(db, FeatureKey.SIGNUP_BONUS_PLAYLISTS, user=user)
        if amount <= 0:
            return 0
        period_key, ttl = await self._period(db, user, None)
        await self._usage.grant_bonus("user", str(user.id), FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, amount, period_key, ttl)
        return amount
