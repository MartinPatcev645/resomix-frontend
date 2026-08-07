"""
Repair founding locks broken by the `iterations` regression
===========================================================

Until 2026-08-07, ``apply_founding_lock`` built phase 1 with ``iterations``. Stripe removed that
parameter, so on API version 2026-04-22.dahlia the ``modify`` call failed with
*"Received unknown parameter: phases[iterations]"*. The method deliberately never raises, so the
failure was logged and swallowed: the subscription kept the single phase that
``SubscriptionSchedule.create(from_subscription=…)`` produces, and the founding price ran with
**nothing to roll onto**.

Every subscription sold at a founding price before that fix is in this state. They are not broken
for the customer — they keep paying the founding rate — but the agreed rollover does not exist and
`is_founding` never clears.

    # look, change nothing (default)
    PYTHONPATH="$PWD" .venv/bin/python scripts/repair_founding_locks.py

    # actually repair
    PYTHONPATH="$PWD" .venv/bin/python scripts/repair_founding_locks.py --apply

Safe to re-run: a schedule that already has two phases is left alone.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import stripe
from sqlalchemy import select

from app.core.config import settings
from app.core.entitlement_keys import PriceKind
from app.models.plan import PlanPrice
from app.models.purchase import UserSubscription
from app.models.user import User
from app.services.billing_service import BillingService
from database.connection import AsyncSessionLocal

stripe.api_key = settings.stripe_secret_key


async def main(apply: bool) -> int:
    service = BillingService()
    broken = []

    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(UserSubscription).where(UserSubscription.stripe_subscription_id.isnot(None))
            )
        ).scalars().all()

        for row in rows:
            price = (
                await db.execute(
                    select(PlanPrice).where(PlanPrice.stripe_price_id == row.stripe_price_id)
                )
            ).scalar_one_or_none()
            if price is None or price.price_kind != PriceKind.FOUNDING:
                continue  # not sold at a founding rate — nothing was ever meant to be locked

            user = (await db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()
            label = f"{user.email if user else '?'} ({row.stripe_subscription_id})"

            try:
                sub = stripe.Subscription.retrieve(row.stripe_subscription_id)
            except Exception as exc:  # noqa: BLE001
                print(f"  ?  {label}: cannot read from Stripe — {exc}")
                continue
            if sub.status not in ("active", "trialing", "past_due"):
                print(f"  –  {label}: status={sub.status}, skipping")
                continue

            schedule_id = getattr(sub, "schedule", None)
            phases = 0
            if schedule_id:
                try:
                    phases = len(stripe.SubscriptionSchedule.retrieve(schedule_id).phases or [])
                except Exception as exc:  # noqa: BLE001
                    print(f"  ?  {label}: cannot read schedule {schedule_id} — {exc}")
                    continue

            if phases >= 2:
                print(f"  ✓  {label}: schedule {schedule_id} already has {phases} phases")
                continue

            broken.append((row, price, label, schedule_id))
            print(f"  ✗  {label}: {'no schedule' if not schedule_id else f'schedule {schedule_id} has {phases} phase(s)'}"
                  f" — {price.unit_amount_cents / 100:.2f} {price.currency}/{price.interval} with no rollover")

        if not broken:
            print("\nNothing to repair.")
            return 0

        if not apply:
            print(f"\n{len(broken)} subscription(s) need repair. Re-run with --apply to fix them.")
            return 0

        print(f"\nRepairing {len(broken)}…")
        for row, price, label, schedule_id in broken:
            # Release the stump first. A one-phase schedule cannot simply be extended: its single
            # phase has already started and Stripe will not retro-fit a duration onto it, so the
            # clean move is to detach it and rebuild from the live subscription — which is exactly
            # what `apply_founding_lock` does from scratch.
            if schedule_id:
                try:
                    stripe.SubscriptionSchedule.release(schedule_id)
                    print(f"  released stump {schedule_id}")
                except Exception as exc:  # noqa: BLE001
                    print(f"  !  {label}: could not release {schedule_id} — {exc}; skipping")
                    continue

            await service.apply_founding_lock(
                db,
                {
                    "subscription": row.stripe_subscription_id,
                    "metadata": {
                        "user_id": str(row.user_id),
                        "plan_id": str(row.plan_id),
                        "plan_code": "pro",
                        "price_kind": PriceKind.FOUNDING,
                        "stripe_price_id": price.stripe_price_id,
                    },
                },
            )
            sub = stripe.Subscription.retrieve(row.stripe_subscription_id)
            new_schedule = getattr(sub, "schedule", None)
            phases = len(stripe.SubscriptionSchedule.retrieve(new_schedule).phases) if new_schedule else 0
            print(f"  {'✓' if phases >= 2 else '✗'}  {label}: now {phases} phase(s) on {new_schedule}")

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Repair founding locks that were never built.")
    parser.add_argument("--apply", action="store_true", help="Actually repair (default is a dry run).")
    args = parser.parse_args()
    print(f"Stripe key: {(settings.stripe_secret_key or '')[:12]}…\n")
    raise SystemExit(asyncio.run(main(args.apply)))
