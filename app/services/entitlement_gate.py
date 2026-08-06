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
from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.entitlement_keys import FeatureKey
from app.models.user import User
from app.services.billing_period_service import BillingPeriodService
from app.services.entitlement_service import EntitlementService
from app.services.playlist_export_service import canonical_target
from app.services.usage_counter_service import UsageCounterService
from app.services.usage_history_service import UsageHistoryService
from app.services import entitlement_metrics

# Sentinel for a counted feature with no ceiling (Pro searches, exports, library).
#
# `0` already means "denied" and is relied on across the seeded data, so it could not be reused.
# No existing row is negative, so nothing changes for the values in production today.
#
# UNLIMITED MEANS "NEVER DENIED", NOT "NEVER MEASURED. An unlimited feature is still counted: only
# the comparison against the limit is skipped. Pro consumption is reported on /entitlements/me and
# is how we find out whether the fair-use position holds — a plan whose usage we cannot see is a
# plan we cannot price. (This reverses the original Phase A shortcut, which skipped Redis entirely
# to save an INCR on Pro's hot path. One Redis op per action is the right price for that visibility.)
UNLIMITED = -1

REASON_LOGIN = "login_required"      # guest → sign up for more
REASON_UPGRADE = "upgrade_required"  # user  → upgrade plan


@dataclass
class GateResult:
    allowed: bool
    reason: Optional[str] = None       # login_required | upgrade_required (when denied)
    cta: Optional[str] = None
    limit: Optional[int] = None
    count: Optional[int] = None
    # Populated on a COUNTED denial so the controller can build the 402 body without recomputing
    # the window. `metric` is the feature key; `resets_at` is when the allowance returns.
    metric: Optional[str] = None
    resets_at: Optional[datetime] = None


@dataclass
class UsageSnapshot:
    """A counted feature's state, for reporting rather than enforcement.

    ``limit is None`` = unlimited. ``used is None`` = not counted / not readable — never "zero".
    """
    feature_key: str
    limit: Optional[int] = None
    used: Optional[int] = None
    resets_at: Optional[datetime] = None

    @property
    def remaining(self) -> Optional[int]:
        """What is left, floored at 0. ``None`` when either side is unknown.

        Floored because a limit can drop below existing usage — a Pro downgrade, or an admin
        lowering a plan — and "-3 left" is not something to put in front of a user.
        """
        if self.limit is None or self.used is None:
            return None
        return max(0, self.limit - self.used)


def _deny(
    user: Optional[User],
    limit: Optional[int] = None,
    count: Optional[int] = None,
    metric: Optional[str] = None,
    resets_at: Optional[datetime] = None,
) -> GateResult:
    if user is None:
        entitlement_metrics.incr(f"gate.deny.{REASON_LOGIN}")
        return GateResult(False, REASON_LOGIN, "Log in to do more.", limit, count, metric, resets_at)
    entitlement_metrics.incr(f"gate.deny.{REASON_UPGRADE}")
    return GateResult(False, REASON_UPGRADE, "Upgrade your plan for more.", limit, count, metric, resets_at)


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

    async def _period(
        self, db, user: Optional[User], visitor_id: Optional[str], feature_key: Optional[str] = None
    ) -> Tuple[str, int]:
        """Current window (period_key, ttl_seconds) for the subject, chosen by the FEATURE.

        `feature_key` is optional so existing callers keep their previous behaviour: without it the
        monthly window is used, which is what every counted feature used before daily existed.
        """
        if feature_key is not None and await self._entitlements.get_window(db, feature_key) == "daily":
            return self._periods.resolve_daily()
        if user is not None:
            return await self._periods.resolve_for_user(db, user)
        return self._periods.resolve_for_guest()

    async def _window(
        self, db, user: Optional[User], visitor_id: Optional[str], feature_key: Optional[str] = None
    ):
        """Full current window (start, end, period_key, ttl) for the subject."""
        if feature_key is not None and await self._entitlements.get_window(db, feature_key) == "daily":
            return self._periods.resolve_window_daily()
        if user is not None:
            return await self._periods.resolve_window_for_user(db, user)
        return self._periods.resolve_window_for_guest()

    async def _rehydrate_if_evicted(
        self, db, subject, feature_key: str, period_start, period_key: str, ttl: int
    ) -> None:
        """Restore this period's counter from the durable store when Redis has lost it.

        Redis is authoritative for enforcement, but its keys can vanish — eviction under memory
        pressure, a flush, a restart without persistence. An absent key reads as 0, which silently
        hands the subject a brand-new allowance: a free user who has used all 3 searches gets 3
        more, and nothing anywhere reports it.

        Only reached when the key is genuinely absent, so this costs one EXISTS on the hot path and
        a single DB read per window per subject. Seeded with SET NX, so two concurrent requests
        that both see it missing cannot both write.

        Never raises and never blocks: if the durable store cannot be read either, we leave the
        counter as it is and enforcement continues from 0 — failing open, which is the same
        direction the rest of this class fails in. A cache problem must not read as "limit
        reached".
        """
        try:
            present = await self._usage.exists(subject[0], subject[1], feature_key, period_key)
            if present is not False:
                # True = key is there; None = Redis is down and there is nothing to rehydrate into.
                return

            used = await self._history.get_used_count(
                db, subject[0], subject[1], feature_key, period_start
            )
            if not used:
                # 0 → nothing to restore. None → could not read; do not invent a count.
                return

            seeded = await self._usage.seed_if_absent(
                subject[0], subject[1], feature_key, used, period_key, ttl
            )
            if seeded:
                entitlement_metrics.incr("gate.counter_rehydrated")
        except Exception:
            entitlement_metrics.incr("gate.rehydrate_failed")

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
        """Allow if the caller can export AND ``target`` is in their allowed export targets.

        Both sides are canonicalised before comparison. The same target is spelled differently in
        different places — production stores ``apple`` and the frontend compares against that
        literal, while the pricing spec writes ``apple_music`` — and a token that is recognised on
        one side but not the other reads as "not on your plan" to a paying user.
        """
        if not await self._entitlements.get_bool(db, FeatureKey.CAN_EXPORT, user=user, visitor_id=visitor_id):
            return _deny(user)
        targets_csv = await self._entitlements.get_str(db, FeatureKey.EXPORT_TARGETS, user=user, visitor_id=visitor_id)
        allowed_targets = {canonical_target(t) for t in targets_csv.split(",") if t.strip()}
        if canonical_target(target) not in allowed_targets:
            return _deny(user)
        return GateResult(True)

    async def try_consume(
        self, db: AsyncSession, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> GateResult:
        """Atomically reserve one unit of a counted feature vs the caller's limit.

        Unlimited (``-1``) is never denied but IS counted — see ``_count_unlimited``.
        """
        limit = await self._entitlements.get_int(db, feature_key, user=user, visitor_id=visitor_id)
        if limit == 0:
            return _deny(user, limit=limit, count=0)

        subject = self._subject(user, visitor_id)
        if subject is None:
            # No identity to count against → fail open (don't block).
            return GateResult(True, limit=limit)

        start, end, period_key, ttl = await self._window(db, user, visitor_id, feature_key)
        await self._rehydrate_if_evicted(db, subject, feature_key, start, period_key, ttl)

        if limit < 0:
            return await self._count_unlimited(subject, feature_key, period_key, ttl)

        result = await self._usage.try_consume(subject[0], subject[1], feature_key, limit, period_key, ttl)
        if result is None:
            # Redis unavailable → fail open (soft limit must not block on infra failure).
            entitlement_metrics.incr("gate.fail_open")
            return GateResult(True, limit=limit)

        allowed, count = result
        if allowed:
            return GateResult(True, limit=limit, count=count)
        # `end` is the moment the allowance returns — the caller needs it for `resets_at` and it is
        # already computed here, so recomputing it in the controller would risk a different answer
        # across a period boundary.
        return _deny(user, limit=limit, count=count, metric=feature_key, resets_at=end)

    async def refund(
        self, db, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> None:
        """Return a previously reserved unit (operation failed after reserving)."""
        subject = self._subject(user, visitor_id)
        if subject is not None:
            period_key, _ttl = await self._period(db, user, visitor_id, feature_key)
            await self._usage.refund(subject[0], subject[1], feature_key, period_key)

    async def peek_allowed(
        self, db: AsyncSession, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> GateResult:
        """Check (without consuming) whether a counted feature is under limit today.

        Paired with ``record_use`` after the operation succeeds (record-on-success) — avoids
        refund complexity on the many early-return failure paths. Fails open if Redis is down.
        """
        limit = await self._entitlements.get_int(db, feature_key, user=user, visitor_id=visitor_id)
        if limit == 0:
            return _deny(user, limit=limit, count=0)
        subject = self._subject(user, visitor_id)
        if subject is None:
            return GateResult(True, limit=limit)
        start, end, period_key, ttl = await self._window(db, user, visitor_id, feature_key)
        await self._rehydrate_if_evicted(db, subject, feature_key, start, period_key, ttl)
        count = await self._usage.peek(subject[0], subject[1], feature_key, period_key)
        if limit < 0:
            # Unlimited: report what has been used, never deny on it.
            return GateResult(True, limit=limit, count=count)
        if count is None:
            entitlement_metrics.incr("gate.fail_open")
            return GateResult(True, limit=limit)  # Redis down → fail open
        if count >= limit:
            return _deny(user, limit=limit, count=count, metric=feature_key, resets_at=end)
        return GateResult(True, limit=limit, count=count)

    async def _count_unlimited(
        self, subject: Tuple[str, str], feature_key: str, period_key: str, ttl: int
    ) -> GateResult:
        """Record a use of an unlimited feature and allow it.

        Unlimited means "never denied", NOT "never measured". Pro usage is reported on
        ``/entitlements/me`` and is what tells us whether the fair-use position holds — a plan whose
        consumption we cannot see is a plan we cannot price. So the INCR happens for ``-1`` too;
        only the *comparison* is skipped.

        A failed INCR still allows: this feature has no ceiling, so there is nothing a counter
        failure could legitimately deny.
        """
        count = await self._usage.increment(subject[0], subject[1], feature_key, period_key, ttl)
        return GateResult(True, limit=UNLIMITED, count=count)

    async def usage_snapshot(
        self, db: AsyncSession, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> "UsageSnapshot":
        """Read a counted feature's limit / usage / reset time **without consuming or denying**.

        Separate from ``peek_allowed`` on purpose. That method answers "may this operation proceed",
        so it returns a denial once the allowance is spent — a shape a reporting endpoint would have
        to unpick. This one only reports, and the difference matters where the two disagree: a user
        at exactly their limit is a **denial** to `peek_allowed` and simply ``used == limit`` here.

        ``None`` never means zero:
          * ``limit is None``  — unlimited. JSON has no sentinel, and sending ``-1`` to the client
            invites it to render "3/-1". **Usage is still reported**: unlimited features are
            counted like every other, because a plan whose consumption we cannot see is a plan we
            cannot price.
          * ``used is None``   — genuinely not readable (no identity to count against, or Redis is
            down). Reporting ``0`` there would be a fabricated number that looks like data.
        """
        limit = await self._entitlements.get_int(db, feature_key, user=user, visitor_id=visitor_id)
        reported_limit = None if limit < 0 else limit

        subject = self._subject(user, visitor_id)
        if subject is None:
            return UsageSnapshot(feature_key, limit=reported_limit, used=None, resets_at=None)

        start, end, period_key, ttl = await self._window(db, user, visitor_id, feature_key)
        await self._rehydrate_if_evicted(db, subject, feature_key, start, period_key, ttl)
        used = await self._usage.peek(subject[0], subject[1], feature_key, period_key)

        # A one-time bonus (the signup grant) is applied by seeding the counter NEGATIVE, so the raw
        # value is `uses - bonus`. Enforcement is right either way — it only compares against the
        # limit — but reporting it verbatim put a literal **-2/3** on the usage chip.
        #
        # Add the grant back to BOTH sides: the user sees a stable `1/5` that counts up to a
        # denominator that does not move. Reconstructing it from `-used` instead would work only
        # while the bonus is unspent, and would show the denominator shrinking 5 → 4 → 3 as they
        # used it.
        if used is not None:
            bonus = await self._usage.peek_bonus(subject[0], subject[1], feature_key, period_key)
            if not bonus:
                # No record of a grant (evicted, or granted before this key existed). Fall back to
                # what the negative itself implies, which at worst restates today's information —
                # and never leaves a minus sign on screen.
                bonus = max(0, -used)
            if bonus:
                used = used + bonus
                if reported_limit is not None:
                    reported_limit = reported_limit + bonus

        # `end` is reported even when unlimited: `used` is scoped to a period, so without it the
        # number has no meaning — "12 searches" over what, exactly?
        return UsageSnapshot(feature_key, limit=reported_limit, used=used, resets_at=end)

    async def record_use(
        self, db, feature_key: str, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> None:
        """Record one successful use of a counted feature (after the operation succeeded)."""
        subject = self._subject(user, visitor_id)
        if subject is None:
            return
        start, end, period_key, ttl = await self._window(db, user, visitor_id, feature_key)
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
        period_key, ttl = await self._period(db, user, None, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH)
        await self._usage.grant_bonus("user", str(user.id), FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, amount, period_key, ttl)
        return amount
