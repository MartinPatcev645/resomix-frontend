"""
Admin Entitlement Service
=========================

The admin-facing write/read layer over the entitlement backbone (``plans`` / ``features`` /
``plan_entitlements``). Powers the Phase-7 admin API: list/read plans + features, edit a plan's
per-feature entitlement value, and toggle plan-level flags.

Guarantees:
  * **Typed validation** — a value is validated + cast against ``feature.value_type`` before write.
  * **Cache-bust on write** — every entitlement edit bumps the plan's ``entitlements_version`` and
    drops its Redis cache (via ``EntitlementService.bump_plan_version``), so edits take effect at once.
  * **Audit** — ``updated_by`` is stamped on the plan and the entitlement row.
  * **Single-default invariant** — setting a plan default clears the flag on all others.

Scope: frontend consumer plans only (System Partner 1 + guests). B2B is untouched.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.plan import Feature, Plan, PlanEntitlement, EntitlementOverride
from app.models.user import User
from app.services.entitlement_service import EntitlementService, _cast_raw, _entitlement_value


class AdminEntitlementService:
    """Read + write operations for the admin plan/entitlement editor."""

    def __init__(self) -> None:
        self._entitlements = EntitlementService()

    # ------------------------------------------------------------------ #
    # Typed value validation
    # ------------------------------------------------------------------ #

    @staticmethod
    def coerce_value(value_type: str, value: Union[bool, int, str]) -> Any:
        """Validate + cast an incoming value against a feature's ``value_type``.

        Raises ``ValueError`` (→ 400) on a type mismatch, so the admin can't, e.g., store a
        string where an int is expected. ``bool`` is rejected for an int feature (it is a Python
        int subclass, so we guard against the ambiguous ``True == 1`` case)."""
        if value_type == "int":
            if isinstance(value, bool):
                raise ValueError("Expected an integer value, got a boolean.")
            try:
                return int(value)
            except (TypeError, ValueError):
                raise ValueError(f"Expected an integer value, got {value!r}.")
        if value_type == "bool":
            if isinstance(value, bool):
                return value
            s = str(value).strip().lower()
            if s in ("1", "true", "yes", "on"):
                return True
            if s in ("0", "false", "no", "off"):
                return False
            raise ValueError(f"Expected a boolean value, got {value!r}.")
        # enum | csv → stored as string
        return str(value)

    # ------------------------------------------------------------------ #
    # Reads
    # ------------------------------------------------------------------ #

    @staticmethod
    def _plan_meta(plan: Plan) -> Dict[str, Any]:
        return {
            "code": plan.code,
            "name": plan.name,
            "price_cents": plan.price_cents,
            "currency": plan.currency,
            "billing_interval": plan.billing_interval,
            "is_active": plan.is_active,
            "is_default": plan.is_default,
            "is_assignable": plan.is_assignable,
            "sort_order": plan.sort_order,
            "entitlements_version": plan.entitlements_version,
        }

    @staticmethod
    def _feature_meta(feat: Feature) -> Dict[str, Any]:
        return {
            "key": feat.key,
            "name": feat.name,
            "value_type": feat.value_type,
            "window": feat.window,
            "default_value": _cast_raw(feat.value_type, feat.default_value),
            "description": feat.description,
        }

    async def list_features(self, db: AsyncSession) -> List[Dict[str, Any]]:
        feats = (await db.execute(select(Feature).order_by(Feature.key))).scalars().all()
        return [self._feature_meta(f) for f in feats]

    async def _entitlements_for_plan(self, db: AsyncSession, plan: Plan) -> Dict[str, Any]:
        """Resolved {feature_key: typed_value} straight from the DB (no cache — admin needs truth)."""
        rows = (await db.execute(
            select(PlanEntitlement, Feature)
            .join(Feature, PlanEntitlement.feature_id == Feature.id)
            .where(PlanEntitlement.plan_id == plan.id)
        )).all()
        result: Dict[str, Any] = {feat.key: _entitlement_value(ent, feat) for ent, feat in rows}
        for feat in (await db.execute(select(Feature))).scalars().all():
            result.setdefault(feat.key, _cast_raw(feat.value_type, feat.default_value))
        return result

    async def list_plans(self, db: AsyncSession) -> List[Dict[str, Any]]:
        plans = (await db.execute(select(Plan).order_by(Plan.sort_order, Plan.id))).scalars().all()
        out: List[Dict[str, Any]] = []
        for plan in plans:
            meta = self._plan_meta(plan)
            meta["entitlements"] = await self._entitlements_for_plan(db, plan)
            out.append(meta)
        return out

    async def get_plan(self, db: AsyncSession, code: str) -> Optional[Dict[str, Any]]:
        plan = (await db.execute(select(Plan).where(Plan.code == code))).scalar_one_or_none()
        if plan is None:
            return None
        meta = self._plan_meta(plan)
        meta["entitlements"] = await self._entitlements_for_plan(db, plan)
        return meta

    async def get_user_effective(self, db: AsyncSession, user: User) -> Dict[str, Any]:
        """Support view: a user's resolved plan + full entitlement map + any active overrides."""
        plan = await self._entitlements.get_effective_plan(db, user)
        entitlements = await self._entitlements.get_entitlements_map(db, plan)
        override_rows = (await db.execute(
            select(EntitlementOverride, Feature)
            .join(Feature, EntitlementOverride.feature_id == Feature.id)
            .where(
                EntitlementOverride.subject_type == "user",
                EntitlementOverride.subject_id == str(user.id),
            )
        )).all()
        overrides = [
            {
                "feature": feat.key,
                "value": _entitlement_value(ov, feat),
                "reason": ov.reason,
                "expires_at": ov.expires_at.isoformat() if ov.expires_at else None,
            }
            for ov, feat in override_rows
        ]
        return {
            "user_uuid": user.uuid,
            "plan": self._plan_meta(plan),
            "entitlements": entitlements,
            "overrides": overrides,
        }

    # ------------------------------------------------------------------ #
    # Writes
    # ------------------------------------------------------------------ #

    async def set_plan_entitlement(
        self,
        db: AsyncSession,
        *,
        code: str,
        feature_key: str,
        value: Union[bool, int, str],
        updated_by: Optional[int],
    ) -> Dict[str, Any]:
        """Upsert one plan × feature entitlement value. Validates against the feature type, bumps
        the plan's cache version, and stamps audit. Raises ``KeyError`` (→ 404) for an unknown plan
        or feature, ``ValueError`` (→ 400) for a type mismatch."""
        plan = (await db.execute(select(Plan).where(Plan.code == code))).scalar_one_or_none()
        if plan is None:
            raise KeyError(f"Unknown plan: {code}")
        feat = (await db.execute(select(Feature).where(Feature.key == feature_key))).scalar_one_or_none()
        if feat is None:
            raise KeyError(f"Unknown feature: {feature_key}")

        coerced = self.coerce_value(feat.value_type, value)

        row = (await db.execute(
            select(PlanEntitlement).where(
                PlanEntitlement.plan_id == plan.id,
                PlanEntitlement.feature_id == feat.id,
            )
        )).scalar_one_or_none()
        if row is None:
            row = PlanEntitlement(plan_id=plan.id, feature_id=feat.id)
            db.add(row)

        # Set only the typed column that matches the feature; clear the others.
        row.int_value = coerced if feat.value_type == "int" else None
        row.bool_value = coerced if feat.value_type == "bool" else None
        row.string_value = coerced if feat.value_type in ("enum", "csv") else None
        row.updated_by = updated_by

        plan.updated_by = updated_by
        # Bump version + drop the Redis cache so enforcement reads the new value immediately.
        await self._entitlements.bump_plan_version(db, plan.id)
        await db.commit()

        return {
            "plan": plan.code,
            "feature": feat.key,
            "value_type": feat.value_type,
            "value": coerced,
            "entitlements_version": plan.entitlements_version,
        }

    async def update_plan(
        self,
        db: AsyncSession,
        *,
        code: str,
        name: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_default: Optional[bool] = None,
        updated_by: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Update plan-level flags. Setting ``is_default=True`` clears the flag on all other plans
        (single-default invariant). Raises ``KeyError`` (→ 404) for an unknown plan."""
        plan = (await db.execute(select(Plan).where(Plan.code == code))).scalar_one_or_none()
        if plan is None:
            raise KeyError(f"Unknown plan: {code}")

        if name is not None:
            plan.name = name
        if is_active is not None:
            plan.is_active = is_active
        if is_default is True:
            # Clear the default flag everywhere else, then set it here.
            others = (await db.execute(select(Plan).where(Plan.id != plan.id, Plan.is_default.is_(True)))).scalars().all()
            for other in others:
                other.is_default = False
            plan.is_default = True
        elif is_default is False:
            plan.is_default = False

        plan.updated_by = updated_by
        await db.commit()
        return self._plan_meta(plan)
