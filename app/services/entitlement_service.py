"""
Entitlement Service
===================

Resolves what a caller (guest or logged-in user) is allowed to do, from the data-driven
plan/entitlement tables. This is the **single source of truth** consulted by enforcement.

Resolution precedence (per feature): **override → plan entitlement → feature default.**
Effective plan: **active subscription's plan → user.plan_id → default (free) plan**; a guest
resolves to the guest plan; a non-active/trialing subscription is treated as free.

The per-plan entitlement map is cached in Redis under a **version-stamped key**
(``entl:plan:{id}:v{entitlements_version}``), so bumping ``plans.entitlements_version`` on an
admin edit instantly invalidates the cache. Redis is best-effort: if it's unavailable the
service computes straight from the DB (no hard dependency, fully testable).

Read-only in Phase 2 (nothing is enforced yet); enforcement wires this in Phase 5.

Version: 1.0.0
Init Date: July 4, 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.entitlement_keys import ACTIVE_SUBSCRIPTION_STATUSES, PlanCode
from app.models.plan import EntitlementOverride, Feature, Plan, PlanEntitlement
from app.models.purchase import UserSubscription
from app.models.user import User

logger = logging.getLogger(__name__)


def _cast_raw(value_type: str, raw: Optional[str]) -> Any:
    """Cast a stored string (feature default) to its typed Python value."""
    if raw is None:
        raw = ""
    if value_type == "int":
        try:
            return int(raw)
        except (TypeError, ValueError):
            return 0
    if value_type == "bool":
        return str(raw).strip().lower() in ("1", "true", "yes", "on")
    return raw  # enum | csv


def _entitlement_value(ent: PlanEntitlement, feature: Feature) -> Any:
    """Pick the correct typed column for an entitlement row, falling back to the feature default."""
    vt = feature.value_type
    if vt == "int":
        return ent.int_value if ent.int_value is not None else _cast_raw(vt, feature.default_value)
    if vt == "bool":
        return ent.bool_value if ent.bool_value is not None else _cast_raw(vt, feature.default_value)
    return ent.string_value if ent.string_value is not None else _cast_raw(vt, feature.default_value)


class EntitlementService:
    """Resolve a caller's effective plan and per-feature entitlement values."""

    def _cache_ttl(self) -> int:
        return int(getattr(settings, "entitlement_cache_ttl_seconds", 300))

    # ------------------------------------------------------------------ #
    # Plan resolution
    # ------------------------------------------------------------------ #

    async def _plan_by_code(self, db: AsyncSession, code: str) -> Optional[Plan]:
        return (await db.execute(select(Plan).where(Plan.code == code))).scalar_one_or_none()

    async def _plan_by_id(self, db: AsyncSession, plan_id: int) -> Optional[Plan]:
        return (await db.execute(select(Plan).where(Plan.id == plan_id))).scalar_one_or_none()

    async def _default_plan(self, db: AsyncSession) -> Optional[Plan]:
        plan = (await db.execute(select(Plan).where(Plan.is_default.is_(True)))).scalar_one_or_none()
        return plan or await self._plan_by_code(db, PlanCode.FREE)

    async def get_effective_plan(self, db: AsyncSession, user: Optional[User] = None) -> Plan:
        """Guest (user=None) → guest plan; user → active subscription → user.plan_id → default."""
        if user is None:
            guest = await self._plan_by_code(db, PlanCode.GUEST)
            if guest:
                return guest
            return await self._default_plan(db)

        sub = (await db.execute(
            select(UserSubscription).where(
                UserSubscription.user_id == user.id,
                UserSubscription.status.in_(ACTIVE_SUBSCRIPTION_STATUSES),
                UserSubscription.plan_id.isnot(None),
            )
        )).scalar_one_or_none()
        if sub and sub.plan_id:
            plan = await self._plan_by_id(db, sub.plan_id)
            if plan:
                return plan

        if user.plan_id:
            plan = await self._plan_by_id(db, user.plan_id)
            if plan:
                return plan

        return await self._default_plan(db)

    # ------------------------------------------------------------------ #
    # Entitlement map (cached per plan)
    # ------------------------------------------------------------------ #

    async def _load_map_from_db(self, db: AsyncSession, plan: Plan) -> Dict[str, Any]:
        rows = (await db.execute(
            select(PlanEntitlement, Feature)
            .join(Feature, PlanEntitlement.feature_id == Feature.id)
            .where(PlanEntitlement.plan_id == plan.id)
        )).all()
        result: Dict[str, Any] = {feat.key: _entitlement_value(ent, feat) for ent, feat in rows}
        # Ensure every feature is present (default for any without a plan_entitlement row).
        all_features = (await db.execute(select(Feature))).scalars().all()
        for feat in all_features:
            result.setdefault(feat.key, _cast_raw(feat.value_type, feat.default_value))
        return result

    async def get_entitlements_map(self, db: AsyncSession, plan: Plan) -> Dict[str, Any]:
        """Return {feature_key: typed_value} for a plan, Redis-cached by (plan_id, version)."""
        cache_key = f"entl:plan:{plan.id}:v{plan.entitlements_version}"
        client = await self._redis()
        if client is not None:
            try:
                cached = await client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as exc:  # cache read failure → fall through to DB
                logger.debug("Entitlement cache read failed: %s", exc)

        data = await self._load_map_from_db(db, plan)

        if client is not None:
            try:
                await client.set(cache_key, json.dumps(data), ex=self._cache_ttl())
            except Exception as exc:
                logger.debug("Entitlement cache write failed: %s", exc)
        return data

    async def bump_plan_version(self, db: AsyncSession, plan_id: int) -> None:
        """Invalidate a plan's cached entitlements by advancing its version (admin edit path)."""
        plan = await self._plan_by_id(db, plan_id)
        if plan is None:
            return
        old_key = f"entl:plan:{plan.id}:v{plan.entitlements_version}"
        plan.entitlements_version = (plan.entitlements_version or 1) + 1
        await db.flush()
        client = await self._redis()
        if client is not None:
            try:
                await client.delete(old_key)
            except Exception:
                pass

    # ------------------------------------------------------------------ #
    # Public resolution API
    # ------------------------------------------------------------------ #

    async def get_entitlement(
        self, db: AsyncSession, feature_key: str, *,
        user: Optional[User] = None, visitor_id: Optional[str] = None,
    ) -> Any:
        """Resolve a feature's value for a caller: override → plan entitlement → feature default."""
        # 1. Override (highest precedence).
        subject = ("user", str(user.id)) if user is not None else (("visitor", visitor_id) if visitor_id else None)
        if subject is not None:
            ov = await self._override_value(db, feature_key, subject[0], subject[1])
            if ov is not _MISSING:
                return ov

        # 2. Plan entitlement (with default baked into the map).
        plan = await self.get_effective_plan(db, user)
        mapping = await self.get_entitlements_map(db, plan)
        if feature_key in mapping:
            return mapping[feature_key]

        # 3. Absolute fallback: feature default (feature unknown to the plan map).
        feat = (await db.execute(select(Feature).where(Feature.key == feature_key))).scalar_one_or_none()
        if feat is None:
            raise KeyError(f"Unknown entitlement feature key: {feature_key}")
        return _cast_raw(feat.value_type, feat.default_value)

    async def get_int(self, db, feature_key, *, user=None, visitor_id=None) -> int:
        return int(await self.get_entitlement(db, feature_key, user=user, visitor_id=visitor_id) or 0)

    async def get_bool(self, db, feature_key, *, user=None, visitor_id=None) -> bool:
        return bool(await self.get_entitlement(db, feature_key, user=user, visitor_id=visitor_id))

    async def get_str(self, db, feature_key, *, user=None, visitor_id=None) -> str:
        val = await self.get_entitlement(db, feature_key, user=user, visitor_id=visitor_id)
        return "" if val is None else str(val)

    async def get_effective_map(
        self, db: AsyncSession, *, user: Optional[User] = None, visitor_id: Optional[str] = None
    ) -> Tuple[Plan, Dict[str, Any]]:
        """Resolve the caller's effective plan + full ``{feature_key: value}`` map — plan values
        with any active per-subject overrides overlaid. Powers the consumer 'my entitlements'
        endpoint so the frontend can drive its UI from a single call."""
        plan = await self.get_effective_plan(db, user)
        result: Dict[str, Any] = dict(await self.get_entitlements_map(db, plan))
        subject = ("user", str(user.id)) if user is not None else (("visitor", visitor_id) if visitor_id else None)
        if subject is not None:
            rows = (await db.execute(
                select(EntitlementOverride, Feature)
                .join(Feature, EntitlementOverride.feature_id == Feature.id)
                .where(
                    EntitlementOverride.subject_type == subject[0],
                    EntitlementOverride.subject_id == subject[1],
                )
            )).all()
            now = datetime.utcnow()
            for ov, feat in rows:
                if ov.expires_at is not None and ov.expires_at < now:
                    continue
                result[feat.key] = _entitlement_value(ov, feat)
        return plan, result

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #

    async def _override_value(self, db: AsyncSession, feature_key: str, subject_type: str, subject_id: str) -> Any:
        row = (await db.execute(
            select(EntitlementOverride, Feature)
            .join(Feature, EntitlementOverride.feature_id == Feature.id)
            .where(
                EntitlementOverride.subject_type == subject_type,
                EntitlementOverride.subject_id == subject_id,
                Feature.key == feature_key,
            )
        )).first()
        if row is None:
            return _MISSING
        ov, feat = row
        if ov.expires_at is not None and ov.expires_at < datetime.utcnow():
            return _MISSING
        vt = feat.value_type
        if vt == "int":
            return ov.int_value if ov.int_value is not None else _MISSING
        if vt == "bool":
            return ov.bool_value if ov.bool_value is not None else _MISSING
        return ov.string_value if ov.string_value is not None else _MISSING

    async def _redis(self):
        """Best-effort Redis client; None if unavailable (service then reads straight from DB)."""
        try:
            import redis.asyncio as redis
            from app.db import redis as redis_module
            if redis_module._redis_pool is None:
                await redis_module.init_redis_pool()
            if redis_module._redis_pool is None:
                return None
            return redis.Redis(connection_pool=redis_module._redis_pool)
        except Exception:
            return None


class _Missing:
    pass


_MISSING = _Missing()
