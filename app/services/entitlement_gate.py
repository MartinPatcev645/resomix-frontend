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

from app.models.user import User
from app.services.entitlement_service import EntitlementService
from app.services.usage_counter_service import UsageCounterService

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
        return GateResult(False, REASON_LOGIN, "Log in to do more.", limit, count)
    return GateResult(False, REASON_UPGRADE, "Upgrade your plan for more.", limit, count)


class EntitlementGate:
    def __init__(self) -> None:
        self._entitlements = EntitlementService()
        self._usage = UsageCounterService()

    @staticmethod
    def _subject(user: Optional[User], visitor_id: Optional[str]) -> Optional[Tuple[str, str]]:
        if user is not None:
            return ("user", str(user.id))
        if visitor_id:
            return ("guest", visitor_id)
        return None

    async def check_boolean(
        self, db: AsyncSession, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> GateResult:
        allowed = await self._entitlements.get_bool(db, feature_key, user=user, visitor_id=visitor_id)
        return GateResult(True) if allowed else _deny(user)

    async def get_cap(
        self, db: AsyncSession, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> int:
        return await self._entitlements.get_int(db, feature_key, user=user, visitor_id=visitor_id)

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

        result = await self._usage.try_consume(subject[0], subject[1], feature_key, limit)
        if result is None:
            # Redis unavailable → fail open (soft limit must not block on infra failure).
            return GateResult(True, limit=limit)

        allowed, count = result
        if allowed:
            return GateResult(True, limit=limit, count=count)
        return _deny(user, limit=limit, count=count)

    async def refund(
        self, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> None:
        """Return a previously reserved unit (operation failed after reserving)."""
        subject = self._subject(user, visitor_id)
        if subject is not None:
            await self._usage.refund(subject[0], subject[1], feature_key)
