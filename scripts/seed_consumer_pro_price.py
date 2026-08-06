"""
Seed the consumer Pro plan's **list** Stripe price into plan_prices (and activate the pro plan).

Idempotent. Pulls the authoritative amount/currency/product from Stripe given the bootstrap price ID
in STRIPE_PRICE_PRO_MONTHLY_EUR, so plan_prices mirrors Stripe exactly. Safe to re-run.

    python scripts/seed_consumer_pro_price.py

⚠️ THIS SCRIPT ONLY EVER TOUCHES THE `list` PRICE.

Since pricing v2.1 a plan can hold a `founding` AND a `list` price for the same interval and
currency (see PriceKind). This script is the original bootstrap and predates that, so it is pinned
to `list` explicitly — without the pin its lookup would match whichever row came first and could
overwrite the founding price with the list one.

**Founding prices are not seeded here.** Attach them through the admin API, which takes the kind:

    POST /admin/entitlements/plans/pro/prices
    { "stripe_price_id": "price_...", "interval": "month", "price_kind": "founding" }
"""
import asyncio

import stripe
from sqlalchemy import select

from app.core.config import settings
from app.core.entitlement_keys import PriceKind
from database.connection import AsyncSessionLocal
from app.models.plan import Plan, PlanPrice


async def main() -> None:
    price_id = (settings.stripe_price_pro_monthly_eur or "").strip()
    if not price_id:
        print("STRIPE_PRICE_PRO_MONTHLY_EUR not set — nothing to seed.")
        return

    stripe.api_key = settings.stripe_secret_key
    price = stripe.Price.retrieve(price_id)
    currency = (getattr(price, "currency", None) or "eur").upper()
    amount = int(getattr(price, "unit_amount", 0) or 0)
    product = getattr(price, "product", None)
    recurring = getattr(price, "recurring", None)
    interval = (getattr(recurring, "interval", None) or "month") if recurring else "month"

    async with AsyncSessionLocal() as db:
        plan = (await db.execute(select(Plan).where(Plan.code == "pro"))).scalar_one_or_none()
        if not plan:
            print("pro plan not found — is entitlement_seed run?")
            return

        if not plan.is_active:
            plan.is_active = True
            print("Activated 'pro' plan.")

        existing = (
            await db.execute(
                select(PlanPrice).where(
                    PlanPrice.plan_id == plan.id,
                    PlanPrice.interval == interval,
                    PlanPrice.currency == currency,
                    PlanPrice.price_kind == PriceKind.LIST,
                )
            )
        ).scalar_one_or_none()

        if existing:
            existing.stripe_price_id = price_id
            existing.stripe_product_id = product
            existing.unit_amount_cents = amount
            existing.is_active = True
            action = "updated"
        else:
            db.add(
                PlanPrice(
                    plan_id=plan.id,
                    interval=interval,
                    currency=currency,
                    price_kind=PriceKind.LIST,
                    unit_amount_cents=amount,
                    stripe_price_id=price_id,
                    stripe_product_id=product,
                    is_active=True,
                )
            )
            action = "created"

        await db.commit()
        print(
            f"plan_price {action}: pro list price (active={plan.is_active}) → {price_id} "
            f"{currency} {amount} /{interval} product={product}"
        )


if __name__ == "__main__":
    asyncio.run(main())
