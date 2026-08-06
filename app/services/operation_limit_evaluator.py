"""
Operation Limit Evaluator
=========================

Utility service to check per-user operation limits (e.g. playlist creation)
before executing operations in demo mode or other constrained environments.

Version: 3.0.1
Init Date: November 09, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import OperationType, UserOperationLimit
from app.models.user import User
from app.repositories.operation_limit_repository import OperationLimitRepository
from app.core.entitlement_keys import FeatureKey
from app.services.entitlement_service import EntitlementService
from app.services.entitlement_gate import EntitlementGate
from app.utils.quota_response import QUOTA_EXCEEDED

# Bridge the legacy OperationType.code space to the new entitlement feature keys.
# Both are per-subject MONTHLY entitlement counters (peek in check(), record in
# record_success()). ``playlist_create`` = catalog/search playlists; ``upload_create`` =
# a track upload (one upload = analysis + similarity, counted once).
OPERATION_TO_FEATURE = {
    "playlist_create": FeatureKey.SEARCH_PLAYLISTS_PER_MONTH,
    "upload_create": FeatureKey.UPLOADS_PER_MONTH,
}

# Per-operation soft-deny copy (``{lim}`` is filled with the numeric cap when known).
#
# The search wording is DAILY. It used to say "this month's" and that became wrong the moment
# `search_playlists_per_month` was re-windowed (A2, key deliberately unchanged) — a user who had
# spent three searches was told to wait a month for an allowance that returns at midnight.
#
# No timezone in the prose: `resets_at` travels in the payload as an absolute timestamp and the
# client renders it in local time. "midnight UTC" would be wrong for almost everyone reading it.
_LIMIT_DENY_MSG = {
    "playlist_create": "You've used today's sonic searches{lim}. Upgrade your plan for unlimited (fair use) searching.",
    "upload_create": "You've used all your uploads this month{lim}. Upgrade your plan to upload more.",
}


@dataclass
class OperationLimitResult:
    allowed: bool
    status_code: int
    message: Optional[str] = None
    reason: Optional[str] = None  # login_required | upgrade_required (soft nudge, when denied)
    # Populated only on an ENTITLEMENT denial (a spent allowance), so the controller can answer with
    # the 402 contract. Absent on the legacy operation-limit denials ("not yet allowed", "disabled
    # for your account"), which are genuine permission refusals and stay 403 — waiting will not
    # help, and offering an upgrade for them would sell something that does not fix the problem.
    code: Optional[str] = None
    metric: Optional[str] = None
    used: Optional[int] = None
    limit: Optional[int] = None
    resets_at: Optional[datetime] = None


class OperationLimitEvaluator:
    """Evaluate whether a user can perform an operation within their configured limits."""

    def __init__(self) -> None:
        self._op_repo = OperationLimitRepository()
        self._entitlements = EntitlementService()
        self._gate = EntitlementGate()

    async def resolve_effective_limit(
        self, db: AsyncSession, user: Optional[User], operation_code: str
    ) -> Optional[int]:
        """Seam (Phase 2): resolve the effective numeric limit for an operation from the new
        entitlement layer (override → plan → default). Returns None if the operation has no
        mapped feature. Does NOT change ``check()`` — Phase 5 wires enforcement to use this.
        """
        feature_key = OPERATION_TO_FEATURE.get(operation_code)
        if feature_key is None:
            return None
        return await self._entitlements.get_int(db, feature_key, user=user)

    async def check(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        operation_code: str,
    ) -> OperationLimitResult:
        """
        Check whether the user is allowed to perform the operation.

        Returns OperationLimitResult indicating whether the request should proceed.
        """
        if not user_id:
            return OperationLimitResult(allowed=True, status_code=200)

        # --- entitlement MONTHLY limits (playlist_create / upload_create) via the gate (T1) ----
        # Logged-in frontend users are governed by their plan's monthly Redis counter (per-subject
        # window), the same mechanism guests use — replacing the legacy lifetime-total limit. (B2B
        # partners never reach here: no user_id, short-circuited above.)
        if operation_code in OPERATION_TO_FEATURE:
            return await self._check_monthly(db, user_id, operation_code)

        # --- legacy per-user operation limits (e.g. spotify_transfer) — unchanged -------------
        operation = await db.execute(
            select(OperationType).where(OperationType.code == operation_code)
        )
        operation_obj = operation.scalar_one_or_none()
        if not operation_obj:
            return OperationLimitResult(allowed=True, status_code=200)

        limit_row = await db.execute(
            select(UserOperationLimit).where(
                UserOperationLimit.user_id == user_id,
                UserOperationLimit.operation_id == operation_obj.id,
            )
        )
        limit = limit_row.scalar_one_or_none()

        if not limit:
            return OperationLimitResult(
                allowed=False,
                status_code=403,
                message="You are not yet allowed to perform this action. Please contact support.",
            )

        if limit.limit_value == 0:
            return OperationLimitResult(
                allowed=False,
                status_code=403,
                message="This action is disabled for your account.",
            )

        if operation_code == "spotify_transfer":
            # Enforce using the per-user usage counter stored on the limit row
            current_usage = getattr(limit, "usage", 0) or 0
            if current_usage >= limit.limit_value:
                return OperationLimitResult(
                    allowed=False,
                    status_code=403,
                    message=f"Spotify transfer limit reached ({limit.limit_value}). Please upgrade your plan or contact support.",
                )

        return OperationLimitResult(allowed=True, status_code=200)

    # ------------------------------------------------------------------ #
    # playlist_create → entitlement monthly gate (peek before, record on success)
    # ------------------------------------------------------------------ #

    async def _load_user(self, db: AsyncSession, user_id: int) -> Optional[User]:
        return (
            await db.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()

    async def _check_monthly(
        self, db: AsyncSession, user_id: int, operation_code: str
    ) -> OperationLimitResult:
        """Peek the caller's monthly allowance for a mapped operation (does not consume). Soft-denies
        with an upgrade nudge when at limit. Fails open (allowed) if Redis is unavailable."""
        user = await self._load_user(db, user_id)
        feature_key = OPERATION_TO_FEATURE[operation_code]
        gate = await self._gate.peek_allowed(db, feature_key, user=user)
        if gate.allowed:
            return OperationLimitResult(allowed=True, status_code=200)
        limit_txt = f" ({gate.limit})" if gate.limit else ""
        template = _LIMIT_DENY_MSG.get(operation_code, "You've reached your limit{lim}.")
        return OperationLimitResult(
            allowed=False,
            # 402, not 403: the request is well-formed and the caller is authenticated — they have
            # simply spent an allowance that comes back. 403 would say "you may never do this".
            status_code=402,
            message=template.format(lim=limit_txt),
            reason=gate.reason,
            code=QUOTA_EXCEEDED,
            metric=gate.metric or feature_key,
            used=gate.count,
            limit=gate.limit,
            resets_at=gate.resets_at,
        )

    async def record_success(
        self, db: AsyncSession, *, user_id: Optional[int], operation_code: str
    ) -> None:
        """Record one successful operation. For ``playlist_create`` this increments the monthly
        entitlement counter (paired with the ``check`` peek); for other operations it falls back
        to the legacy per-user usage counter. Best-effort — never raises into the caller."""
        if not user_id:
            return
        try:
            feature_key = OPERATION_TO_FEATURE.get(operation_code)
            if feature_key is not None:
                user = await self._load_user(db, user_id)
                if user is not None:
                    await self._gate.record_use(db, feature_key, user=user)
                return
            await self._op_repo.async_increment_usage(
                db, user_id=user_id, operation_code=operation_code
            )
        except Exception:
            # Metering must not fail the underlying operation.
            pass

    async def _fetch_limit(self, db: AsyncSession, user_id: int, operation_id: int) -> UserOperationLimit | None:
        stmt = select(UserOperationLimit).where(
            UserOperationLimit.user_id == user_id,
            UserOperationLimit.operation_id == operation_id,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

