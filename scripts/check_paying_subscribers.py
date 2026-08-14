"""
Pre-flight: does anyone who PAID resolve to free?
=================================================

READ-ONLY. Writes nothing, ever.

WHY THIS EXISTS

`reconcile_library_visibility.py` decides what to hide from a user's Library by resolving their
**effective** plan. That is the right source of truth — but it is only as good as the subscription
data underneath it, and that data has been through a sandbox → live migration in which the Pro
plans broke and every account was forced back to free by hand.

If a real, paying subscriber's `user_subscriptions` row did not survive that intact, they resolve
to free today. Reconciling would then **hide playlists from someone who is paying for them**. That
is the one outcome worth stopping for, and no amount of care inside the reconcile script can catch
it, because from its point of view that user simply is free.

WHAT COUNTS AS "PAID"

`billing_invoices.amount_paid_cents > 0`. Money actually moved. Deliberately not the subscription
row — the subscription row is the thing whose trustworthiness is in question, so using it to
validate itself proves nothing. An invoice is written when Stripe confirms a payment, and a
sandbox invoice cannot have moved real money.

WHAT IT REPORTS

Every user with at least one paid invoice, alongside the plan the app resolves for them right now.
Anyone in the ⚠️ list is someone reconciliation would restrict despite their having paid.

Usage
-----
    python scripts/check_paying_subscribers.py
    python scripts/check_paying_subscribers.py --since 2026-07-01   # only invoices from this date
"""

import argparse
import asyncio
import os
import sys
from typing import List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, text  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.context import set_admin_context, set_current_partner_id  # noqa: E402
from app.core.entitlement_keys import FeatureKey  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.entitlement_gate import EntitlementGate  # noqa: E402
from database.connection import AsyncSessionLocal  # noqa: E402


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--since", help="only count invoices paid on or after this date (YYYY-MM-DD)")
    args = ap.parse_args()

    set_current_partner_id(settings.system_partner_id)
    set_admin_context(False)
    gate = EntitlementGate()

    where = "i.amount_paid_cents > 0"
    params = {}
    if args.since:
        where += " AND i.paid_at >= :since"
        params["since"] = args.since

    async with AsyncSessionLocal() as db:
        payers = (await db.execute(text(
            f"""
            SELECT i.user_id,
                   COUNT(*)                    AS invoices,
                   SUM(i.amount_paid_cents)    AS total_cents,
                   MAX(i.currency)             AS currency,
                   MAX(i.paid_at)              AS last_paid
            FROM billing_invoices i
            WHERE {where} AND i.user_id IS NOT NULL
            GROUP BY i.user_id
            ORDER BY MAX(i.paid_at) DESC
            """
        ), params)).mappings().all()

        print(f"Users with at least one PAID invoice: {len(payers)}\n")
        if not payers:
            print("Nobody has paid. Reconciliation cannot restrict a paying subscriber.")
            return 0

        at_risk: List[str] = []
        print(f"  {'user':>7}  {'paid':>10}  {'invoices':>8}  {'last payment':<20} resolves to")
        for row in payers:
            user = (await db.execute(
                select(User).where(User.id == row["user_id"]))).scalar_one_or_none()
            if user is None:
                at_risk.append(f"user {row['user_id']}: PAID but the account no longer exists")
                continue

            plan, _ = await gate._entitlements.get_effective_map(db, user=user)
            cap = await gate.get_cap(db, FeatureKey.LIBRARY_PLAYLISTS_MAX, user=user)
            unlimited = cap is None or cap < 0

            sub = (await db.execute(text(
                "SELECT status, plan_id, current_period_end FROM user_subscriptions "
                "WHERE user_id = :u"), {"u": user.id})).mappings().first()
            sub_note = (f"sub={sub['status']}/plan {sub['plan_id']}" if sub else "NO SUBSCRIPTION ROW")

            amount = f"{row['total_cents'] / 100:.2f} {row['currency'] or ''}".strip()
            flag = "  " if unlimited else "⚠️"
            print(f"{flag}{row['user_id']:>7}  {amount:>10}  {row['invoices']:>8}  "
                  f"{str(row['last_paid'])[:19]:<20} {plan.code} "
                  f"(cap {'unlimited' if unlimited else cap})  [{sub_note}]")

            if not unlimited:
                at_risk.append(
                    f"user {user.id} ({user.email}) paid {amount} but resolves to "
                    f"'{plan.code}' with cap {cap} — {sub_note}")

        print()
        if at_risk:
            print("⚠️  DO NOT RUN THE RECONCILE YET. These accounts paid and would be restricted:")
            for line in at_risk:
                print(f"     {line}")
            print("\n   Fix their subscription rows first, then re-run this check.")
            return 1

        print("✅ Every paying subscriber resolves to an unlimited plan. "
              "Reconciliation cannot restrict any of them.")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
