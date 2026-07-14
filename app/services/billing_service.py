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
from typing import Any, Dict, List, Optional

import stripe
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.entitlement_keys import ACTIVE_SUBSCRIPTION_STATUSES, PlanCode
from app.models.plan import Plan, PlanPrice
from app.models.purchase import UserSubscription
from app.models.user import User

logger = logging.getLogger(__name__)

# Countries billed in USD (everything else → EUR). Extend as needed; USD prices must exist in
# plan_prices for these to actually resolve to USD (otherwise we fall back to EUR).
USD_COUNTRIES = {"US"}


class BillingService:
    """Consumer subscription checkout + portal + plan display."""

    def __init__(self) -> None:
        stripe.api_key = settings.stripe_secret_key

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
            "success_url": f"{settings.frontend_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{settings.frontend_url}/pricing",
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
            "return_url": f"{settings.frontend_url}/profile",
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
        purchasable/coming-soon flags. Inactive non-free plans (basic/max) → coming_soon."""
        currency = self.resolve_currency(country_code)
        plans = (
            await db.execute(
                select(Plan).where(Plan.is_assignable.is_(True)).order_by(Plan.sort_order)
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
                }
            )
        return {"currency": currency, "current_plan_code": current_plan_code, "plans": out}
