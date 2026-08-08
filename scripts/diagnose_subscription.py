"""
Diagnose one consumer subscription
==================================

Answers a single question: **why does this subscription's state on our screens differ from
Stripe's?** — using recorded fact rather than reasoning about what "should" have happened.

Three sources, side by side:

1. **What Stripe told us.** Every Stripe event we accept is written to ``system_logs`` with its
   complete payload under ``log_metadata.raw_payload`` (see ``WebhookService.handle_stripe_webhook``).
   Nothing extra needs to be logged for this; the history is already on disk.
2. **What we wrote.** The current ``user_subscriptions`` row.
3. **What Stripe holds now.** The live objects, re-read through the API.

The three disagreeing tells you where the break is:

* no events at all → the endpoint is not receiving them (event not selected, or a signature /
  URL problem). Not a code bug.
* events arrived but the row is stale → a sync bug in ``BillingSyncService``.
* events and row agree, screens disagree → a frontend or stale-build problem.

    PYTHONPATH="$PWD" .venv/bin/python scripts/diagnose_subscription.py --email someone@example.com
    PYTHONPATH="$PWD" .venv/bin/python scripts/diagnose_subscription.py --subscription sub_123
    PYTHONPATH="$PWD" .venv/bin/python scripts/diagnose_subscription.py --email a@b.c --json

**Read-only.** It opens a session, runs SELECTs, and never writes — safe against production.
``--limit`` bounds how many webhook rows are scanned (default 300).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, text

from app.core.config import settings
from app.models.purchase import UserSubscription
from app.models.user import User
from database.connection import AsyncSessionLocal

# Event families worth showing. Anything else (cart, dispute on a one-time order) is noise here.
RELEVANT_PREFIXES = ("customer.subscription.", "subscription_schedule.", "invoice.", "charge.")


def ts(value: Any) -> str:
    """Unix epoch → readable UTC. Stripe timestamps are always epoch seconds."""
    if not value:
        return "—"
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError, OSError):
        return str(value)


def dt(value: Optional[datetime]) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S") if value else "—"


def _obj(payload: Dict[str, Any]) -> Dict[str, Any]:
    """The Stripe object an event carries: ``event.data.object``."""
    data = payload.get("data") or {}
    obj = data.get("object") if isinstance(data, dict) else None
    return obj if isinstance(obj, dict) else {}


def _period_end(sub: Dict[str, Any]) -> Any:
    """Basil (2025-03-31) moved current_period_end onto each SubscriptionItem.

    Read the item first, fall back to the subscription level for older API versions — the same
    order ``BillingSyncService.sync_subscription`` uses, so this reports what the sync would see.
    """
    items = ((sub.get("items") or {}).get("data")) or []
    item0 = items[0] if items else {}
    return item0.get("current_period_end") or sub.get("current_period_end")


def summarise(event_type: str, obj: Dict[str, Any]) -> Dict[str, Any]:
    """The handful of fields that decide the outcome, per event family."""
    if event_type.startswith("customer.subscription."):
        details = obj.get("cancellation_details") or {}
        return {
            "status": obj.get("status"),
            "cancel_at_period_end": obj.get("cancel_at_period_end"),
            "cancel_at": ts(obj.get("cancel_at")),
            "canceled_at": ts(obj.get("canceled_at")),
            "ended_at": ts(obj.get("ended_at")),
            "reason": details.get("reason") if isinstance(details, dict) else None,
            "period_end": ts(_period_end(obj)),
            "schedule": obj.get("schedule"),
        }
    if event_type.startswith("subscription_schedule."):
        phases = obj.get("phases") or []
        return {
            "status": obj.get("status"),
            "end_behavior": obj.get("end_behavior"),
            "phases": len(phases),
            "subscription": obj.get("subscription") or obj.get("released_subscription"),
            "phase1_end": ts(phases[0].get("end_date")) if phases else "—",
        }
    if event_type.startswith("invoice."):
        return {
            "status": obj.get("status"),
            "amount_paid": obj.get("amount_paid"),
            "currency": (obj.get("currency") or "").upper(),
        }
    if event_type.startswith("charge."):
        return {
            "amount": obj.get("amount"),
            "amount_refunded": obj.get("amount_refunded"),
            "refunded": obj.get("refunded"),
            "disputed": obj.get("disputed"),
        }
    return {}


async def load_events(db, needles: List[str], limit: int) -> List[Dict[str, Any]]:
    """Webhook audit rows mentioning any of these Stripe ids, newest first.

    ``log_metadata`` is a JSON column; casting to CHAR lets one LIKE find an id wherever it sits in
    the payload, which beats guessing a JSON path per event shape. Bounded by ``limit`` so this
    stays cheap on a busy instance.
    """
    if not needles:
        return []
    clauses, params = [], {"limit": limit}
    for i, needle in enumerate(needles):
        clauses.append(f"CAST(log_metadata AS CHAR) LIKE :n{i}")
        params[f"n{i}"] = f"%{needle}%"

    rows = (
        await db.execute(
            text(
                "SELECT id, created_at, log_metadata FROM system_logs "
                "WHERE category = 'WEBHOOK' AND (" + " OR ".join(clauses) + ") "
                "ORDER BY id DESC LIMIT :limit"
            ),
            params,
        )
    ).fetchall()

    events = []
    for row in rows:
        meta = row[2]
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except ValueError:
                continue
        if not isinstance(meta, dict):
            continue
        payload = meta.get("raw_payload") or {}
        event_type = meta.get("event_type") or payload.get("type") or "?"
        if not event_type.startswith(RELEVANT_PREFIXES):
            continue
        events.append({
            "log_id": row[0],
            "received_at": row[1],
            "event_id": meta.get("stripe_event_id"),
            "type": event_type,
            "fields": summarise(event_type, _obj(payload)),
        })
    return events


def read_stripe(subscription_id: Optional[str]) -> Dict[str, Any]:
    """Live Stripe state. Never raises — a diagnostic that dies on a network blip is useless."""
    out: Dict[str, Any] = {}
    if not subscription_id:
        return out
    try:
        import stripe

        stripe.api_key = settings.stripe_secret_key
        sub = stripe.Subscription.retrieve(subscription_id)
        # Attribute access, not .get(): a live StripeObject's __getattr__ shadows dict.get.
        details = getattr(sub, "cancellation_details", None)
        items = getattr(getattr(sub, "items", None), "data", None) or []
        out["subscription"] = {
            "status": sub.status,
            "cancel_at_period_end": getattr(sub, "cancel_at_period_end", None),
            "cancel_at": ts(getattr(sub, "cancel_at", None)),
            "canceled_at": ts(getattr(sub, "canceled_at", None)),
            "ended_at": ts(getattr(sub, "ended_at", None)),
            "reason": getattr(details, "reason", None) if details else None,
            "period_end": ts(getattr(items[0], "current_period_end", None) if items else None),
            "schedule": getattr(sub, "schedule", None),
        }
        schedule_id = getattr(sub, "schedule", None)
        if schedule_id:
            sched = stripe.SubscriptionSchedule.retrieve(schedule_id)
            phases = sched.phases or []
            out["schedule"] = {
                "id": sched.id,
                "status": sched.status,
                "end_behavior": sched.end_behavior,
                "phases": len(phases),
                "phase1_end": ts(phases[0].end_date) if phases else "—",
            }
    except Exception as exc:  # noqa: BLE001 — see the docstring
        out["error"] = str(exc)
    return out


def verdict(events: List[Dict[str, Any]], row: Optional[UserSubscription], live: Dict[str, Any]) -> List[str]:
    """Which of the known failure modes this subscription is in.

    Deliberately conservative: it reports what the evidence supports and says so when the evidence
    is absent, rather than picking the most likely story.
    """
    out: List[str] = []
    sub_events = [e for e in events if e["type"].startswith("customer.subscription.")]

    if not events:
        out.append(
            "NO WEBHOOK EVENTS RECORDED for this subscription. Either the endpoint is not receiving "
            "them (event type not selected in the Stripe dashboard, wrong URL, or failing signature "
            "verification), or they predate this log table. Check the endpoint's delivery attempts "
            "in Stripe before looking at any code."
        )
        return out

    if not sub_events:
        out.append("Events exist, but none are `customer.subscription.*` — the subscription itself was never synced.")
        return out

    latest = sub_events[0]["fields"]
    live_sub = live.get("subscription") or {}

    # Is Stripe reporting a cancellation at all, by any of the three mechanisms?
    stripe_says_cancelling = bool(
        latest.get("cancel_at_period_end")
        or (latest.get("cancel_at") not in (None, "—"))
        or (latest.get("canceled_at") not in (None, "—"))
    )
    live_says_cancelling = bool(
        live_sub.get("cancel_at_period_end")
        or (live_sub.get("cancel_at") not in (None, "—"))
        or (live_sub.get("canceled_at") not in (None, "—"))
    )

    if not stripe_says_cancelling and not live_says_cancelling:
        out.append("Stripe does not report this subscription as cancelling, by any mechanism. If the "
                   "customer believes they cancelled, the cancellation did not complete on Stripe's side.")
        return out

    if latest.get("cancel_at_period_end"):
        out.append("Stripe set `cancel_at_period_end = true` (the plain mechanism).")
        if row is not None and not row.cancel_at_period_end:
            out.append("  ✗ but our row has cancel_at_period_end = 0 — the sync did not apply. Sync bug.")
        else:
            out.append("  ✓ our row matches. If a screen still says 'Renews on', the bug is in the "
                       "frontend branch (it must not depend on this one boolean) or the deployed build is stale.")
    else:
        out.append("Stripe did NOT set `cancel_at_period_end`.")
        if latest.get("canceled_at") not in (None, "—") or latest.get("cancel_at") not in (None, "—"):
            out.append("  → but `canceled_at` / `cancel_at` IS set. This is the case the old frontend "
                       "could not see: it branched on the boolean alone and fell through to 'Renews on'.")

    sched = live.get("schedule") or {}
    if sched.get("end_behavior") == "cancel":
        out.append("The attached subscription schedule has end_behavior = 'cancel' — the cancellation "
                   "was recorded on the SCHEDULE, not the subscription. This is the founding-lock path.")
    elif sched:
        out.append(f"A schedule is attached (status={sched.get('status')}, "
                   f"end_behavior={sched.get('end_behavior')}, phases={sched.get('phases')}).")

    if row is None:
        out.append("No local user_subscriptions row exists at all — nothing was ever synced.")
    return out


async def main(email: Optional[str], subscription_id: Optional[str], limit: int, as_json: bool) -> int:
    async with AsyncSessionLocal() as db:
        user: Optional[User] = None
        row: Optional[UserSubscription] = None

        if email:
            user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
            if user is None:
                print(f"No user with email {email!r}.")
                return 1
            row = (
                await db.execute(select(UserSubscription).where(UserSubscription.user_id == user.id))
            ).scalar_one_or_none()
            subscription_id = subscription_id or (row.stripe_subscription_id if row else None)
        else:
            row = (
                await db.execute(
                    select(UserSubscription).where(
                        UserSubscription.stripe_subscription_id == subscription_id
                    )
                )
            ).scalar_one_or_none()
            if row is not None:
                user = (await db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()

        needles = [n for n in (subscription_id, row.stripe_customer_id if row else None,
                               user.stripe_customer_id if user else None) if n]
        events = await load_events(db, list(dict.fromkeys(needles)), limit)

    live = read_stripe(subscription_id)
    lines = verdict(events, row, live)

    if as_json:
        print(json.dumps({
            "user": {"id": user.id, "email": user.email} if user else None,
            "subscription_id": subscription_id,
            "local_row": {
                "status": row.status,
                "plan_id": row.plan_id,
                "current_period_end": dt(row.current_period_end),
                "cancel_at_period_end": bool(row.cancel_at_period_end),
                "canceled_at": dt(row.canceled_at),
                "is_founding": bool(row.is_founding),
                "stripe_schedule_id": row.stripe_schedule_id,
            } if row else None,
            "events": [{**e, "received_at": dt(e["received_at"])} for e in events],
            "live": live,
            "verdict": lines,
        }, indent=2, default=str))
        return 0

    print("=" * 78)
    print(f"  {user.email if user else '(unknown user)'}   {subscription_id or '(no subscription)'}")
    print("=" * 78)

    print("\n── 1. what Stripe told us (system_logs, newest first) ─────────────────────")
    if not events:
        print("  (no webhook events recorded for this subscription)")
    for e in events:
        print(f"\n  {dt(e['received_at'])}  {e['type']}   [{e['event_id']}]")
        for k, v in e["fields"].items():
            if v not in (None, "—"):
                print(f"      {k:<22} {v}")

    print("\n── 2. what we wrote (user_subscriptions) ──────────────────────────────────")
    if row is None:
        print("  (no row — this user resolves to the free plan)")
    else:
        print(f"  status                 {row.status}")
        print(f"  plan_id                {row.plan_id}")
        print(f"  current_period_start   {dt(row.current_period_start)}")
        print(f"  current_period_end     {dt(row.current_period_end)}")
        print(f"  cancel_at_period_end   {bool(row.cancel_at_period_end)}")
        print(f"  canceled_at            {dt(row.canceled_at)}")
        print(f"  trial_end              {dt(row.trial_end)}")
        print(f"  is_founding            {bool(row.is_founding)}")
        print(f"  founding_lock_ends_at  {dt(row.founding_lock_ends_at)}")
        print(f"  stripe_schedule_id     {row.stripe_schedule_id or '—'}")
        # Present only after the Phase 1 migration; shown when available so the script stays
        # useful on a database that has not been migrated yet.
        for extra in ("cancel_at", "ended_at", "cancellation_reason"):
            if hasattr(row, extra):
                value = getattr(row, extra)
                print(f"  {extra:<22} {dt(value) if isinstance(value, datetime) else (value or '—')}")

    print("\n── 3. what Stripe holds now ───────────────────────────────────────────────")
    if not live:
        print("  (not read — no subscription id)")
    elif "error" in live:
        print(f"  could not read: {live['error']}")
    else:
        for section, data in live.items():
            print(f"  [{section}]")
            for k, v in data.items():
                print(f"      {k:<22} {v}")

    print("\n── verdict ────────────────────────────────────────────────────────────────")
    for line in lines:
        print(f"  {line}")
    print()
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Read-only diagnosis of one consumer subscription.")
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--email", help="User's email address.")
    group.add_argument("--subscription", help="Stripe subscription id (sub_…).")
    ap.add_argument("--limit", type=int, default=300, help="Max webhook rows to scan.")
    ap.add_argument("--json", action="store_true", dest="as_json", help="Machine-readable output.")
    a = ap.parse_args()
    raise SystemExit(asyncio.run(main(a.email, a.subscription, a.limit, a.as_json)))
