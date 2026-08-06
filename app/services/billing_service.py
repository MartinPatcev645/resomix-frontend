"""
Consumer Billing Service
========================

Consumer subscription billing via **Stripe hosted Checkout + Customer Portal** (separate from the
B2B partner Stripe flow). Prices are data (``plan_prices``), not code. See
docs/CONSUMER_BILLING_PLAN.md.

This service owns the *initiation* side (Checkout session, Portal session, plan display + the
price→plan map). Stripe state is written back by the webhook handlers (billing_sync_service).
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import stripe
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.entitlement_keys import ACTIVE_SUBSCRIPTION_STATUSES, PlanCode, FeatureKey
from app.models.billing import BillingInvoice, UsagePeriodHistory
from app.models.plan import Plan, PlanPrice
from app.models.purchase import UserSubscription
from app.models.user import User
from app.services.entitlement_service import EntitlementService
from app.services.entitlement_gate import EntitlementGate

logger = logging.getLogger(__name__)

# Plans the public pricing page may advertise. GUEST is excluded because it is not something a
# visitor can buy or be assigned by choice — it is the logged-out state.
PUBLIC_PLAN_CODES = (PlanCode.FREE, PlanCode.BASIC, PlanCode.PRO, PlanCode.MAX)

# Counted features surfaced in the "Plan & Billing" usage meters.
_USAGE_FEATURES = (FeatureKey.UPLOADS_PER_MONTH, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH)

# Countries billed in USD (everything else → EUR). Extend as needed; USD prices must exist in
# plan_prices for these to actually resolve to USD (otherwise we fall back to EUR).
USD_COUNTRIES = {"US"}


class BillingService:
    """Consumer subscription checkout + portal + plan display."""

    def __init__(self) -> None:
        stripe.api_key = settings.stripe_secret_key
        self.entitlements = EntitlementService()
        self.gate = EntitlementGate()

    # ------------------------------------------------------------------ #
    # currency
    # ------------------------------------------------------------------ #
    def resolve_currency(self, country_code: Optional[str]) -> str:
        """Resolve the buyer's billing currency from their country (default EUR; US → USD)."""
        cc = (country_code or "").strip().upper()
        return "USD" if cc in USD_COUNTRIES else "EUR"

    # ------------------------------------------------------------------ #
    # lookups
    # ------------------------------------------------------------------ #
    async def _plan_by_code(self, db: AsyncSession, code: str) -> Optional[Plan]:
        return (await db.execute(select(Plan).where(Plan.code == code))).scalar_one_or_none()

    async def _active_price(
        self, db: AsyncSession, plan_id: int, currency: str, interval: str = "month"
    ) -> Optional[PlanPrice]:
        return (
            await db.execute(
                select(PlanPrice).where(
                    PlanPrice.plan_id == plan_id,
                    PlanPrice.interval == interval,
                    PlanPrice.currency == currency,
                    PlanPrice.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()

    async def active_subscription(self, db: AsyncSession, user: User) -> Optional[UserSubscription]:
        return (
            await db.execute(
                select(UserSubscription).where(
                    UserSubscription.user_id == user.id,
                    UserSubscription.status.in_(ACTIVE_SUBSCRIPTION_STATUSES),
                )
            )
        ).scalar_one_or_none()

    async def map_price_to_plan(self, db: AsyncSession, stripe_price_id: str) -> Optional[int]:
        """The plan a Stripe price grants (used by the subscription webhook)."""
        row = (
            await db.execute(select(PlanPrice.plan_id).where(PlanPrice.stripe_price_id == stripe_price_id))
        ).first()
        return row[0] if row else None

    # ------------------------------------------------------------------ #
    # Stripe customer
    # ------------------------------------------------------------------ #
    async def _get_or_create_customer(self, db: AsyncSession, user: User) -> str:
        if user.stripe_customer_id:
            return user.stripe_customer_id
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name or user.username,
            metadata={"user_id": str(user.id), "user_uuid": user.uuid},
        )
        user.stripe_customer_id = customer.id
        await db.commit()
        return customer.id

    # ------------------------------------------------------------------ #
    # Checkout (subscribe / upgrade)
    # ------------------------------------------------------------------ #
    async def create_checkout_session(
        self, db: AsyncSession, user: User, plan_code: str, country_code: Optional[str]
    ) -> str:
        """Create a Stripe subscription Checkout session for ``plan_code`` and return its URL."""
        plan = await self._plan_by_code(db, plan_code)
        if not plan or plan.code in (PlanCode.GUEST, PlanCode.FREE):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not a purchasable plan.")
        if not plan.is_active or not plan.is_assignable:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This plan isn't available yet.",
            )

        # Already subscribed → send them to the Customer Portal instead of a second subscription.
        if await self.active_subscription(db, user):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already have an active subscription. Use 'Manage subscription' to change it.",
            )

        currency = self.resolve_currency(country_code)
        price = await self._active_price(db, plan.id, currency)
        if not price:  # fall back to EUR if the resolved currency has no price yet
            price = await self._active_price(db, plan.id, "EUR")
        if not price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active price for this plan. Please try again later.",
            )

        customer_id = await self._get_or_create_customer(db, user)
        metadata = {"user_id": str(user.id), "plan_id": str(plan.id), "plan_code": plan.code}

        kwargs: Dict[str, Any] = {
            "mode": "subscription",
            "customer": customer_id,
            "line_items": [{"price": price.stripe_price_id, "quantity": 1}],
            "client_reference_id": user.uuid,
            "metadata": metadata,
            "subscription_data": {"metadata": metadata},
            "allow_promotion_codes": True,
            # Return to the APP (beta.resomix.com), not the marketing host — a user who subscribes
            # from the app must land back in the app (same login session), not on resomix.com where
            # a different account may be signed in. See settings.app_url.
            "success_url": f"{settings.app_url}/profile?checkout=success",
            "cancel_url": f"{settings.app_url}/profile?checkout=cancelled",
        }
        if settings.stripe_automatic_tax_enabled:
            kwargs["automatic_tax"] = {"enabled": True}
            kwargs["customer_update"] = {"address": "auto"}

        session = stripe.checkout.Session.create(**kwargs)
        return session.url

    # ------------------------------------------------------------------ #
    # Customer Portal (manage / downgrade / cancel / card / invoices)
    # ------------------------------------------------------------------ #
    async def create_portal_session(self, db: AsyncSession, user: User) -> str:
        if not user.stripe_customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No billing account yet — subscribe first.",
            )
        kwargs: Dict[str, Any] = {
            "customer": user.stripe_customer_id,
            "return_url": f"{settings.app_url}/profile",
        }
        if settings.stripe_billing_portal_config_id:
            kwargs["configuration"] = settings.stripe_billing_portal_config_id
        session = stripe.billing_portal.Session.create(**kwargs)
        return session.url

    # ------------------------------------------------------------------ #
    # Plan display (pricing page / profile)
    # ------------------------------------------------------------------ #
    async def get_plans_for_display(
        self, db: AsyncSession, country_code: Optional[str], current_plan_code: Optional[str]
    ) -> Dict[str, Any]:
        """Assignable consumer plans for the pricing page, with the resolved-currency price and
        purchasable/coming-soon flags. Inactive non-free plans (basic/max) → coming_soon.

        Restricted to the catalogue codes on purpose. `is_assignable` alone is a property of the
        row, so any plan created by hand or through the admin screens — a throwaway called "temp",
        say — was advertised on the public pricing page as a real product. The public page should
        only ever show plans the product actually sells, and that set is PlanCode.
        """
        currency = self.resolve_currency(country_code)
        plans = (
            await db.execute(
                select(Plan)
                .where(Plan.is_assignable.is_(True), Plan.code.in_(PUBLIC_PLAN_CODES))
                .order_by(Plan.sort_order)
            )
        ).scalars().all()

        out: List[Dict[str, Any]] = []
        for plan in plans:
            price = await self._active_price(db, plan.id, currency)
            if not price and currency != "EUR":
                price = await self._active_price(db, plan.id, "EUR")
            is_free = plan.code == PlanCode.FREE
            purchasable = bool(plan.is_active and price and not is_free)
            out.append(
                {
                    "code": plan.code,
                    "name": plan.name,
                    "is_free": is_free,
                    "unit_amount_cents": price.unit_amount_cents if price else (0 if is_free else None),
                    "currency": price.currency if price else currency,
                    "interval": price.interval if price else "month",
                    "purchasable": purchasable,
                    "coming_soon": bool(not plan.is_active and not is_free),
                    "is_current": plan.code == current_plan_code,
                    # The numbers the page prints. Rendered from the SAME rows that enforce them, so
                    # an admin raising a limit changes the pricing page in the same breath — the
                    # alternative is a marketing page that quietly starts lying after an edit.
                    "limits": await self._public_limits(db, plan),
                }
            )
        return {
            "currency": currency,
            "current_plan_code": current_plan_code,
            "plans": out,
            "beta": self.beta_window(),
        }

    async def _public_limits(self, db: AsyncSession, plan: Plan) -> Dict[str, Any]:
        """The plan's limits as the pricing page shows them.

        `None` = unlimited, matching `/entitlements/me`: the internal sentinel is `-1`, and a page
        that received it would print "-1 searches a day". `0` is preserved — it is a real limit
        meaning "not included", which is how the guest and free rows say what they do not have.
        """
        entitlements = await self.entitlements.get_entitlements_map(db, plan)

        def cap(key: str) -> Optional[int]:
            value = entitlements.get(key)
            if not isinstance(value, int) or isinstance(value, bool):
                return None
            return None if value < 0 else value

        return {
            "searches_per_day": cap(FeatureKey.SEARCH_PLAYLISTS_PER_MONTH),
            "uploads_per_month": cap(FeatureKey.UPLOADS_PER_MONTH),
            "top_sk_max": cap(FeatureKey.MAX_TRACKS_PER_PLAYLIST),
            "dropdown_max_tracks": cap(FeatureKey.DROPDOWN_MAX_TRACKS),
            "library_playlists_max": cap(FeatureKey.LIBRARY_PLAYLISTS_MAX),
            "exports_per_day": cap(FeatureKey.EXPORTS_PER_DAY),
            "export_track_limit": cap(FeatureKey.EXPORT_TRACK_LIMIT),
            "can_view_full_analysis": bool(entitlements.get(FeatureKey.CAN_VIEW_FULL_ANALYSIS)),
            "can_similarity_upload": bool(entitlements.get(FeatureKey.CAN_SIMILARITY_UPLOAD)),
        }

    @staticmethod
    def beta_window() -> Dict[str, Any]:
        """The founding-offer window, for the countdown and the checkout gate.

        `founding_active` is computed HERE rather than in the browser: a client clock can be wrong
        or deliberately set back, and a countdown that disagrees with what checkout will actually
        sell is worse than no countdown. The client still gets `end_date` so it can render a live
        ticker, but the server's answer is the one that decides.
        """
        end_date = settings.beta_end_date
        try:
            parsed = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            active = datetime.now(timezone.utc) < parsed
        except (ValueError, AttributeError):
            # A malformed env value must not take the pricing page down. Fail OPEN — the founding
            # window stays open, which sells at the lower price rather than silently withdrawing an
            # offer that is still being advertised.
            logger.warning("BILLING: could not parse beta_end_date %r; treating as open", end_date)
            return {"end_date": None, "founding_active": True}
        return {"end_date": end_date, "founding_active": active}

    # ------------------------------------------------------------------ #
    # Subscription summary + invoices (profile "Plan & Billing")
    # ------------------------------------------------------------------ #
    async def get_subscription_summary(self, db: AsyncSession, user: User) -> Dict[str, Any]:
        """Effective plan + the raw subscription row (status/renewal/cancel) + this period's usage."""
        plan = await self.entitlements.get_effective_plan(db, user)
        row = (
            await db.execute(select(UserSubscription).where(UserSubscription.user_id == user.id))
        ).scalar_one_or_none()

        usage: List[Dict[str, Any]] = []
        for fk in _USAGE_FEATURES:
            snapshot = await self.gate.usage_snapshot(db, fk, user=user)
            # `limit: None` = unlimited, same contract as /entitlements/me. This used to pass the
            # raw entitlement through, so a Pro row rendered its cap as **-1** on the "Plan &
            # Billing" screen. `used` now reports for unlimited plans too, since those are counted.
            usage.append({"feature": fk, "used": snapshot.used, "limit": snapshot.limit})

        subscription = None
        if row is not None:
            subscription = {
                "status": row.status,
                "currency": row.currency,
                "current_period_end": row.current_period_end.isoformat() if row.current_period_end else None,
                "cancel_at_period_end": bool(row.cancel_at_period_end),
                "canceled_at": row.canceled_at.isoformat() if row.canceled_at else None,
                "trial_end": row.trial_end.isoformat() if row.trial_end else None,
            }
        return {
            "plan": {"code": plan.code, "name": plan.name} if plan else None,
            "subscription": subscription,
            "usage": usage,
        }

    async def list_invoices(self, db: AsyncSession, user: User, limit: int = 24) -> List[Dict[str, Any]]:
        rows = (
            await db.execute(
                select(BillingInvoice)
                .where(BillingInvoice.user_id == user.id)
                .order_by(BillingInvoice.created_at.desc())
                .limit(limit)
            )
        ).scalars().all()
        return [
            {
                "stripe_invoice_id": r.stripe_invoice_id,
                "amount_paid_cents": r.amount_paid_cents,
                "currency": r.currency,
                "status": r.status,
                "period_start": r.period_start.isoformat() if r.period_start else None,
                "period_end": r.period_end.isoformat() if r.period_end else None,
                "hosted_invoice_url": r.hosted_invoice_url,
                "invoice_pdf": r.invoice_pdf,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "paid_at": r.paid_at.isoformat() if r.paid_at else None,
            }
            for r in rows
        ]

    async def get_usage_history(
        self, db: AsyncSession, user: User, limit_periods: int = 12
    ) -> List[Dict[str, Any]]:
        """Past-period usage (uploads / similarity) per billing period, newest first."""
        rows = (
            await db.execute(
                select(UsagePeriodHistory)
                .where(
                    UsagePeriodHistory.subject_type == "user",
                    UsagePeriodHistory.subject_id == str(user.id),
                )
                .order_by(UsagePeriodHistory.period_start.desc())
            )
        ).scalars().all()

        periods: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            key = r.period_start.isoformat() if r.period_start else "?"
            bucket = periods.setdefault(
                key,
                {
                    "period_start": r.period_start.isoformat() if r.period_start else None,
                    "period_end": r.period_end.isoformat() if r.period_end else None,
                    "features": [],
                },
            )
            bucket["features"].append(
                {"feature": r.feature_key, "used": r.used_count, "limit": r.limit_value}
            )

        ordered = sorted(periods.values(), key=lambda p: p["period_start"] or "", reverse=True)
        return ordered[:limit_periods]
