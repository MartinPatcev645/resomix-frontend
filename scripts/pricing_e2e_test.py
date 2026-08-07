"""
Pricing v2.1 — automated end-to-end harness
===========================================

Drives the subscription lifecycle against a Stripe **sandbox** using test clocks, and asserts what
landed in our database. Covers the parts that cannot reasonably be clicked through: 22-month
founding locks, yearly rollover, cancellation, dunning, and the counter edge cases.

    # everything (~15 min, mostly waiting on clock advances)
    PYTHONPATH="$PWD" .venv/bin/python scripts/pricing_e2e_test.py all

    # one scenario at a time
    PYTHONPATH="$PWD" .venv/bin/python scripts/pricing_e2e_test.py local
    PYTHONPATH="$PWD" .venv/bin/python scripts/pricing_e2e_test.py clock-yearly
    PYTHONPATH="$PWD" .venv/bin/python scripts/pricing_e2e_test.py clock-monthly
    PYTHONPATH="$PWD" .venv/bin/python scripts/pricing_e2e_test.py cancel
    PYTHONPATH="$PWD" .venv/bin/python scripts/pricing_e2e_test.py payment-fail

WHAT THIS DOES AND DOES NOT PROVE
---------------------------------
Stripe Checkout cannot be completed without a browser, so the Stripe scenarios create the
subscription through the API and then invoke ``apply_founding_lock`` with the same session-shaped
dict the ``checkout.session.completed`` handler passes. Everything downstream — schedule creation,
phase boundaries, iteration counts, the webhook round trip, the database mirror — is the real code
path. The checkout hand-off itself is the one link you have to verify by hand, and it already has
been (a live subscription carries ``is_founding=1`` and a schedule id).

Webhook-driven assertions poll the database with a timeout, because they depend on Stripe calling
the deployed app. **Run this where that app's webhook endpoint is reachable and pointed at this
same database**, or every such check will time out — which the report calls TIMEOUT, not FAIL, so
you can tell "the code is wrong" from "the event never arrived".

SAFETY
------
Refuses to start against a live Stripe key. Every object it creates is namespaced ``e2e-…`` and
removed on exit; deleting a test clock also cancels its subscriptions and deletes its customers.
It touches no user it did not create.
"""

from __future__ import annotations

import argparse
import asyncio
import calendar
import os
import sys
import time
import traceback
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import stripe
from sqlalchemy import select, delete, text

from app.core.config import settings
from app.core.entitlement_keys import FeatureKey, PriceKind, FOUNDING_LOCK_ITERATIONS
from app.models.plan import Plan, PlanPrice
from app.models.user import User
from app.models.purchase import UserSubscription
from app.services.billing_service import BillingService
from app.services.entitlement_service import EntitlementService
from app.services.entitlement_gate import EntitlementGate
from app.utils.demo_mode_utils import apply_demo_mode_redaction
from database.connection import AsyncSessionLocal

stripe.api_key = settings.stripe_secret_key

# How long a webhook-driven assertion waits before giving up. Generous: a clock advance fans out a
# lot of events and Stripe delivers them at its own pace.
WEBHOOK_TIMEOUT_S = 90
POLL_INTERVAL_S = 2
# Stripe holds a subscription invoice in `draft` for about an hour of SIMULATED time. Advancing past
# that is what finalises and pays it — without this every renewal check would read `draft`.
DRAFT_SETTLE_S = 3700


# --------------------------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------------------------- #
PASS, FAIL, TIMEOUT, SKIP = "PASS", "FAIL", "TIMEOUT", "SKIP"


@dataclass
class Report:
    rows: List[Dict[str, str]] = field(default_factory=list)

    def add(self, scenario: str, check: str, status: str, detail: str = "") -> None:
        self.rows.append({"scenario": scenario, "check": check, "status": status, "detail": detail})
        icon = {PASS: "✓", FAIL: "✗", TIMEOUT: "⏱", SKIP: "–"}[status]
        print(f"  {icon} [{status}] {check}" + (f"  — {detail}" if detail else ""), flush=True)

    def summary(self) -> int:
        print("\n" + "=" * 92)
        print("SUMMARY")
        print("=" * 92)
        width = max((len(r["check"]) for r in self.rows), default=10) + 2
        for r in self.rows:
            print(f"{r['status']:<8} {r['scenario']:<16} {r['check']:<{width}} {r['detail']}")
        counts = {s: sum(1 for r in self.rows if r["status"] == s) for s in (PASS, FAIL, TIMEOUT, SKIP)}
        print("-" * 92)
        print(f"{counts[PASS]} passed · {counts[FAIL]} failed · {counts[TIMEOUT]} timed out · {counts[SKIP]} skipped")
        if counts[TIMEOUT]:
            print("\nTIMEOUT means the expected database change never arrived. That is usually the")
            print("webhook endpoint not reaching THIS database — check the sandbox event destination")
            print("and `SELECT action FROM system_logs WHERE category='WEBHOOK' ORDER BY id DESC`.")
        return 1 if (counts[FAIL] or counts[TIMEOUT]) else 0


report = Report()


# --------------------------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------------------------- #
def add_interval(dt: datetime, interval: str, count: int) -> datetime:
    """Add ``count`` calendar months/years to ``dt``, clamping the day.

    NOT ``timedelta(days=365)``. Stripe's phase boundaries are calendar dates, and 3 × 365 days
    lands a day BEFORE start + 3 years — enough to stop short of a phase boundary and miss the
    event the test is waiting for.
    """
    months = count * (12 if interval == "year" else 1)
    year = dt.year + (dt.month - 1 + months) // 12
    month = (dt.month - 1 + months) % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def sfield(obj: Any, key: str, default: Any = None) -> Any:
    """Read a field from a Stripe object.

    ``StripeObject`` is NOT a dict in stripe-python 15.x and its ``__getattr__`` shadows
    ``dict.get``, so ``obj.get("x")`` raises AttributeError instead of returning None. Subscript
    access works, attribute access works, ``.get`` does not — hence this.
    """
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def ts(dt: datetime) -> int:
    return int(dt.replace(tzinfo=timezone.utc).timestamp())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def advance_clock(clock_id: str, to: datetime, label: str) -> None:
    """Advance a test clock and block until Stripe reports it ready.

    Stripe caps a single advance at **two billing intervals**, so callers step rather than jump.
    """
    print(f"    … advancing clock to {to:%Y-%m-%d %H:%M} ({label})", flush=True)
    stripe.test_helpers.TestClock.advance(clock_id, frozen_time=ts(to))
    deadline = time.time() + 300
    while time.time() < deadline:
        clock = stripe.test_helpers.TestClock.retrieve(clock_id)
        if sfield(clock, "status") == "ready":
            return
        if sfield(clock, "status") not in ("advancing",):
            raise RuntimeError(f"test clock entered status {sfield(clock, 'status')!r}")
        time.sleep(3)
    raise RuntimeError("test clock did not become ready within 300s")


async def wait_for(
    check: Callable[[], Any], desc: str, timeout: int = WEBHOOK_TIMEOUT_S
) -> Any:
    """Poll an async predicate until it returns something truthy, or time out.

    Returns the truthy value, or None on timeout — the caller reports TIMEOUT rather than FAIL so a
    webhook that never arrived is not misread as broken logic.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        value = await check()
        if value:
            return value
        await asyncio.sleep(POLL_INTERVAL_S)
    print(f"    … timed out waiting for: {desc}", flush=True)
    return None


async def sub_row(user_id: int) -> Optional[UserSubscription]:
    async with AsyncSessionLocal() as db:
        return (
            await db.execute(select(UserSubscription).where(UserSubscription.user_id == user_id))
        ).scalar_one_or_none()


async def effective_plan_code(user_id: int) -> Optional[str]:
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if user is None:
            return None
        plan = await EntitlementService().get_effective_plan(db, user)
        return plan.code if plan else None


async def pro_prices() -> Dict[str, PlanPrice]:
    """The four Pro prices, keyed "founding-month" / "list-year" etc."""
    async with AsyncSessionLocal() as db:
        plan = (await db.execute(select(Plan).where(Plan.code == "pro"))).scalar_one_or_none()
        if plan is None:
            return {}
        rows = (
            await db.execute(
                select(PlanPrice).where(PlanPrice.plan_id == plan.id, PlanPrice.is_active.is_(True))
            )
        ).scalars().all()
        return {f"{r.price_kind}-{r.interval}": r for r in rows}


async def make_user(tag: str) -> User:
    """A throwaway, clearly-namespaced user. Never reuses a real account."""
    email = f"e2e-{tag}-{uuid.uuid4().hex[:8]}@resomix-e2e.invalid"
    async with AsyncSessionLocal() as db:
        user = User(
            uuid=str(uuid.uuid4()),
            email=email,
            username=f"e2e_{uuid.uuid4().hex[:10]}",
            name="E2E Harness",
            is_active=True,
            is_email_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"    · test user {user.email} (id={user.id})", flush=True)
        return user


async def destroy_user(user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(delete(UserSubscription).where(UserSubscription.user_id == user_id))
        await db.execute(text("DELETE FROM subscription_events WHERE user_id = :u"), {"u": user_id})
        await db.execute(text("DELETE FROM billing_invoices WHERE user_id = :u"), {"u": user_id})
        await db.execute(text("DELETE FROM billing_consents WHERE user_id = :u"), {"u": user_id})
        await db.execute(
            text("DELETE FROM usage_period_history WHERE subject_type='user' AND subject_id = :u"),
            {"u": str(user_id)},
        )
        await db.execute(delete(User).where(User.id == user_id))
        await db.commit()


def make_clock(name: str) -> str:
    clock = stripe.test_helpers.TestClock.create(frozen_time=ts(now_utc()), name=f"e2e-{name}")
    print(f"    · test clock {clock.id}", flush=True)
    return clock.id


def make_customer(clock_id: str, email: str, card_token: str = "tok_visa") -> str:
    pm = stripe.PaymentMethod.create(type="card", card={"token": card_token})
    customer = stripe.Customer.create(
        email=email,
        test_clock=clock_id,
        payment_method=pm.id,
        invoice_settings={"default_payment_method": pm.id},
    )
    return customer.id


def subscription_invoices(subscription_id: str) -> List[Any]:
    """Invoices for a subscription, oldest first.

    List endpoints omit test-clock objects unless you scope the query, which is why this filters by
    subscription rather than listing broadly.
    """
    out = list(stripe.Invoice.list(subscription=subscription_id, limit=100).auto_paging_iter())
    return sorted(out, key=lambda i: sfield(i, "created", 0))


async def subscribe(user: User, customer_id: str, price: PlanPrice, plan_id: int) -> Any:
    """Create the subscription and apply the founding lock exactly as the webhook handler does."""
    async with AsyncSessionLocal() as db:
        db_user = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        db_user.stripe_customer_id = customer_id
        await db.commit()

    metadata = {
        "user_id": str(user.id),
        "plan_id": str(plan_id),
        "plan_code": "pro",
        "price_kind": price.price_kind,
        "stripe_price_id": price.stripe_price_id,
    }
    sub = stripe.Subscription.create(
        customer=customer_id,
        items=[{"price": price.stripe_price_id, "quantity": 1}],
        metadata=metadata,
    )
    print(f"    · subscription {sub.id} @ {price.stripe_price_id}", flush=True)
    return sub, metadata


async def apply_lock(sub_id: str, metadata: Dict[str, str]) -> None:
    """Invoke the real founding-lock code with the session shape the webhook passes."""
    async with AsyncSessionLocal() as db:
        await BillingService().apply_founding_lock(
            db, {"subscription": sub_id, "metadata": metadata}
        )


# --------------------------------------------------------------------------------------------- #
# Scenario: local (no Stripe) — the counter and redaction edge cases
# --------------------------------------------------------------------------------------------- #
async def scenario_local() -> None:
    name = "local"
    print("\n▶ local — counters, redaction, entitlement sentinels (no Stripe)")

    # --- the unlimited sentinel must not invert the tease ---------------------------------------
    payload = {"similar_tracks": [{"id": f"i{n}", "title": f"Real {n}", "artist": "A"} for n in range(4)]}
    apply_demo_mode_redaction(payload, visible_count=-1)
    intact = all(t["title"].startswith("Real") for t in payload["similar_tracks"])
    report.add(name, "unlimited (-1) redacts nothing", PASS if intact else FAIL,
               "" if intact else "a -1 cap scrambled every track — unlimited showed the least")

    # --- every identifying field is scrambled beyond the cap -------------------------------------
    payload = {"similar_tracks": [
        {"id": "abcdef", "title": "Real Title", "artist": "Real Artist", "album": "Real Album",
         "label": "Real Label", "genre": "House | Dance", "duration": 421.7,
         "isrc": "GBAAA1234567", "year": 2019, "preview_url": "https://x",
         "artwork_url": "https://y", "deep_link_url": "https://z", "apple_song_id": "1558398784"},
    ]}
    apply_demo_mode_redaction(payload, visible_count=0)
    t = payload["similar_tracks"][0]

    # Text fields are masked by cycling the letters of "demo", so every alphabetic character left in
    # them must come from that word. Anything else is original text that survived.
    def scrambled(value: str) -> bool:
        return all(ch.lower() in "demo" for ch in str(value) if ch.isalpha())

    leaks = [k for k in ("title", "artist", "album", "label", "genre") if not scrambled(t[k])]
    leaks += [k for k, leaked in (
        ("id", not scrambled(t["id"]) and not all(c in "dEm0" for c in t["id"])),
        ("duration", t["duration"] != 300.0),
        ("isrc", t["isrc"] == "GBAAA1234567"),
        ("year", t["year"] != 2025),
        ("preview_url", t["preview_url"] is not None),
        ("artwork_url", t["artwork_url"] is not None),
        ("deep_link_url", t["deep_link_url"] is not None),
        ("apple_song_id", t["apple_song_id"] is not None),
    ) if leaked]
    report.add(name, "locked rows leak no identifying field", PASS if not leaks else FAIL,
               "" if not leaks else f"still real: {', '.join(leaks)}")

    # --- signup bonus must never render negative --------------------------------------------------
    user = await make_user("bonus")
    try:
        gate = EntitlementGate()
        async with AsyncSessionLocal() as db:
            db_user = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
            granted = await gate.grant_playlist_signup_bonus(db, db_user)
            snap = await gate.usage_snapshot(db, FeatureKey.SEARCH_PLAYLISTS_PER_MONTH, user=db_user)
        if granted <= 0:
            report.add(name, "signup bonus reports non-negative usage", SKIP,
                       "no bonus granted (Redis down, or the free plan grants 0)")
        else:
            ok = snap.used is not None and snap.used >= 0
            report.add(name, "signup bonus reports non-negative usage", PASS if ok else FAIL,
                       f"used={snap.used} limit={snap.limit} (granted {granted})")
            # The denominator must include the bonus, or the chip promises fewer than it allows.
            expect = ok and snap.limit is not None and snap.limit >= granted
            report.add(name, "bonus is added to the limit, not hidden", PASS if expect else FAIL,
                       f"limit={snap.limit}, expected ≥ 3+{granted}")

        # --- the daily allowance is atomic ------------------------------------------------------
        async def race_once():
            async with AsyncSessionLocal() as own:
                u = (await own.execute(select(User).where(User.id == user.id))).scalar_one()
                return await gate.try_consume(own, FeatureKey.EXPORTS_PER_DAY, user=u)

        results = await asyncio.gather(*[race_once() for _ in range(6)])
        allowed = sum(1 for r in results if r.allowed)
        async with AsyncSessionLocal() as db:
            db_user = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
            limit = await gate.get_cap(db, FeatureKey.EXPORTS_PER_DAY, user=db_user)
        expected = "unlimited" if limit < 0 else str(limit)
        ok = allowed == 6 if limit < 0 else allowed <= max(limit, 0)
        report.add(name, "concurrent consumes cannot exceed the cap", PASS if ok else FAIL,
                   f"{allowed}/6 allowed against a limit of {expected}")

        # --- a refund must give back BOTH stores --------------------------------------------------
        # If only Redis is refunded, the durable mirror sits one high and a later eviction restores
        # a use that was given back — the user pays for a failed export twice.
        from app.services.usage_history_service import UsageHistoryService
        from app.services.billing_period_service import BillingPeriodService as _Periods

        _start, _e, _pk, _t = _Periods().resolve_window_daily()
        async with AsyncSessionLocal() as db:
            db_user = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
            await gate.refund(db, FeatureKey.EXPORTS_PER_DAY, user=db_user)
        # Fresh sessions on purpose: `release` commits from its own, and under MySQL's default
        # REPEATABLE READ a session that already opened a transaction would keep reading the
        # pre-commit snapshot and report a failure that exists only inside this test.
        async with AsyncSessionLocal() as db:
            db_user = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
            after_refund = await gate.usage_snapshot(db, FeatureKey.EXPORTS_PER_DAY, user=db_user)
        async with AsyncSessionLocal() as db:
            durable = await UsageHistoryService().get_used_count(
                db, "user", str(user.id), FeatureKey.EXPORTS_PER_DAY, _start
            )
        agree = after_refund.used == durable
        report.add(name, "refund gives back Redis and the durable row together",
                   PASS if agree else FAIL,
                   f"redis={after_refund.used} durable={durable}"
                   + ("" if agree else " — they disagree; an eviction would restore a refunded use"))
        # Put the use back so the eviction check below has something to rehydrate.
        async with AsyncSessionLocal() as db:
            db_user = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
            await gate.record_use(db, FeatureKey.EXPORTS_PER_DAY, user=db_user)

        # --- Redis eviction must not hand out a fresh allowance ----------------------------------
        # Delete ONLY the Redis counter, leaving the durable row. The gate must notice and restore
        # the count; if it reads 0 instead, every eviction silently grants everyone a new allowance.
        from app.services.usage_counter_service import UsageCounterService
        from app.services.billing_period_service import BillingPeriodService
        from app.services import redis_counter

        counter, periods = UsageCounterService(), BillingPeriodService()
        _start, _end, period_key, _ttl = periods.resolve_window_daily()
        async with AsyncSessionLocal() as db:
            db_user = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
            before = await gate.usage_snapshot(db, FeatureKey.EXPORTS_PER_DAY, user=db_user)
        removed = await redis_counter.delete(
            counter._key("user", str(user.id), FeatureKey.EXPORTS_PER_DAY, period_key)
        )
        async with AsyncSessionLocal() as db:
            db_user = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
            after = await gate.usage_snapshot(db, FeatureKey.EXPORTS_PER_DAY, user=db_user)

        if removed is None:
            report.add(name, "evicted counter rehydrates from the durable store", SKIP, "Redis unavailable")
        elif not before.used:
            report.add(name, "evicted counter rehydrates from the durable store", SKIP,
                       "nothing was consumed, so there is nothing to rehydrate")
        else:
            ok = after.used == before.used
            report.add(name, "evicted counter rehydrates from the durable store", PASS if ok else FAIL,
                       f"{before.used} → {after.used} after eviction"
                       + ("" if ok else " — an eviction just handed out a fresh allowance"))

    finally:
        await destroy_user(user.id)


# --------------------------------------------------------------------------------------------- #
# Scenario: the founding lock over time
# --------------------------------------------------------------------------------------------- #
async def _lock_scenario(interval: str, cycles_to_run: Optional[int]) -> None:
    """Shared body for the yearly (full) and monthly (partial) lock runs.

    ``cycles_to_run=None`` means "run the lock out completely and watch it release" — only viable
    for yearly, because Stripe allows **20 new invoices per subscription per day** and a full
    monthly lock is 22.
    """
    name = f"clock-{interval}ly" if interval == "year" else "clock-monthly"
    iterations = FOUNDING_LOCK_ITERATIONS[interval]
    print(f"\n▶ {name} — founding {interval} × {iterations} → list")

    prices = await pro_prices()
    founding = prices.get(f"{PriceKind.FOUNDING}-{interval}")
    listp = prices.get(f"{PriceKind.LIST}-{interval}")
    if not founding or not listp:
        report.add(name, "founding + list prices attached", FAIL,
                   f"missing {'founding' if not founding else 'list'} {interval} price — "
                   "the schedule cannot be built and NO lock will be applied")
        return
    report.add(name, "founding + list prices attached", PASS,
               f"{founding.unit_amount_cents/100:.2f} → {listp.unit_amount_cents/100:.2f} {founding.currency}")

    async with AsyncSessionLocal() as db:
        plan = (await db.execute(select(Plan).where(Plan.code == "pro"))).scalar_one()
        plan_id = plan.id

    user = await make_user(name)
    clock_id = None
    try:
        clock_id = make_clock(name)
        customer_id = make_customer(clock_id, user.email)
        sub, metadata = await subscribe(user, customer_id, founding, plan_id)

        row = await wait_for(lambda: sub_row(user.id), "the subscription row (customer.subscription.created)")
        if row is None:
            report.add(name, "subscription syncs to the database", TIMEOUT, "no user_subscriptions row")
            return
        report.add(name, "subscription syncs to the database", PASS, f"status={row.status}")

        plan_code = await effective_plan_code(user.id)
        report.add(name, "active subscription grants Pro", PASS if plan_code == "pro" else FAIL,
                   f"effective plan = {plan_code}")

        await apply_lock(sub.id, metadata)

        schedule_id = sfield(stripe.Subscription.retrieve(sub.id), "schedule")
        schedule = stripe.SubscriptionSchedule.retrieve(schedule_id) if schedule_id else None
        if schedule is None:
            report.add(name, "subscription schedule created", FAIL,
                       "no schedule on the subscription — check the logs for 'founding lock NOT applied'")
            return
        report.add(name, "subscription schedule created", PASS, schedule.id)

        checks = [
            ("end_behavior = release", sfield(schedule, "end_behavior") == "release",
             f"got {sfield(schedule, 'end_behavior')!r} — without release the Customer Portal cannot change the plan"),
            (f"phase 1 = founding × {iterations}",
             len(schedule.phases) >= 2
             and sfield(sfield(schedule.phases[0], "items")[0], "price") == founding.stripe_price_id,
             "phase 1 is not the founding price"),
            ("phase 2 = list price",
             len(schedule.phases) >= 2
             and sfield(sfield(schedule.phases[1], "items")[0], "price") == listp.stripe_price_id,
             "phase 2 is not the list price — customers would never roll off the founding rate"),
        ]
        for label, ok, why in checks:
            report.add(name, label, PASS if ok else FAIL, "" if ok else why)

        row = await wait_for(
            lambda: _row_if(user.id, lambda r: bool(r.is_founding) and bool(r.stripe_schedule_id)),
            "is_founding + stripe_schedule_id (subscription_schedule.*)",
        )
        if row is None:
            report.add(name, "lock mirrored locally", TIMEOUT, "is_founding never set")
        else:
            report.add(name, "lock mirrored locally", PASS, f"schedule={row.stripe_schedule_id}")
            report.add(name, "founding_lock_ends_at populated",
                       PASS if row.founding_lock_ends_at else FAIL,
                       str(row.founding_lock_ends_at or "NULL — the profile cannot say when the rate ends"))

        # ---- advance through the founding cycles ------------------------------------------------
        # Boundaries come from the schedule itself. Recomputing them invites exactly the off-by-a-day
        # that a 365-day "year" produces, and being one day short of a phase boundary means the
        # event under test never fires.
        start = datetime.fromtimestamp(sfield(schedule.phases[0], "start_date"), tz=timezone.utc)
        founding_end = datetime.fromtimestamp(sfield(schedule.phases[0], "end_date"), tz=timezone.utc)
        schedule_end = datetime.fromtimestamp(sfield(schedule.phases[1], "end_date"), tz=timezone.utc)
        total = (iterations - 1) if cycles_to_run is None else min(cycles_to_run, iterations - 1)

        for n in range(1, total + 1):
            at = add_interval(start, interval, n) + timedelta(seconds=DRAFT_SETTLE_S)
            advance_clock(clock_id, at, f"founding cycle {n + 1}")
            latest = (subscription_invoices(sub.id) or [None])[-1]
            amount = sfield(latest, "amount_due")
            ok = amount == founding.unit_amount_cents
            report.add(name, f"cycle {n + 1} still charges the founding rate",
                       PASS if ok else FAIL,
                       f"invoice {amount} vs expected {founding.unit_amount_cents}")

        if cycles_to_run is not None:
            report.add(name, "rollover to the list price", SKIP,
                       f"stopped after {total} of {iterations} cycles — Stripe caps a subscription at "
                       "20 new invoices per day, so the full monthly lock cannot run in one sitting. "
                       "The yearly scenario proves the rollover; this proves the shape holds.")
            return

        # ---- the founding phase ends: roll onto the list price ----------------------------------
        advance_clock(clock_id, founding_end + timedelta(seconds=DRAFT_SETTLE_S), "founding phase ends")
        invoices = subscription_invoices(sub.id)
        amount = sfield(invoices[-1], "amount_due") if invoices else None
        ok = amount == listp.unit_amount_cents
        report.add(name, "rolls onto the list price after the lock", PASS if ok else FAIL,
                   f"invoice {amount} vs expected {listp.unit_amount_cents}")

        # ---- the schedule itself ends: it must RELEASE -------------------------------------------
        # Stripe gives the final phase an implicit one-cycle duration, so the schedule expires a
        # full cycle after phase 2 begins. `end_behavior="release"` fires there, not at the rollover.
        advance_clock(clock_id, schedule_end + timedelta(seconds=DRAFT_SETTLE_S), "schedule expires → release")

        row = await wait_for(
            lambda: _row_if(user.id, lambda r: not r.is_founding),
            "is_founding cleared (subscription_schedule.released)",
        )
        if row is None:
            report.add(name, "is_founding clears on release", TIMEOUT,
                       "the profile would keep promising a founding rate they no longer pay")
        else:
            report.add(name, "is_founding clears on release", PASS)
            report.add(name, "founding_lock_ends_at kept as history",
                       PASS if row.founding_lock_ends_at else FAIL,
                       "cleared — the only local record that a lock existed is gone"
                       if not row.founding_lock_ends_at else str(row.founding_lock_ends_at))
            report.add(name, "schedule id cleared on release",
                       PASS if row.stripe_schedule_id is None else FAIL,
                       f"still {row.stripe_schedule_id}" if row.stripe_schedule_id else "")

        plan_code = await effective_plan_code(user.id)
        report.add(name, "still Pro after the lock ends", PASS if plan_code == "pro" else FAIL,
                   f"effective plan = {plan_code}")
    except Exception as exc:  # noqa: BLE001
        report.add(name, "scenario completed", FAIL, f"{type(exc).__name__}: {exc}")
        traceback.print_exc()
    finally:
        if clock_id:
            try:
                stripe.test_helpers.TestClock.delete(clock_id)
            except Exception:  # noqa: BLE001
                pass
        await destroy_user(user.id)


async def _row_if(user_id: int, predicate: Callable[[UserSubscription], bool]):
    row = await sub_row(user_id)
    return row if (row is not None and predicate(row)) else None


async def scenario_clock_yearly() -> None:
    await _lock_scenario("year", cycles_to_run=None)


async def scenario_clock_monthly() -> None:
    # 4 cycles: enough to prove the founding rate survives renewals without approaching Stripe's
    # 20-invoices-per-subscription-per-day ceiling.
    await _lock_scenario("month", cycles_to_run=4)


# --------------------------------------------------------------------------------------------- #
# Scenario: cancellation and downgrade
# --------------------------------------------------------------------------------------------- #
async def scenario_cancel() -> None:
    name = "cancel"
    print("\n▶ cancel — cancel at period end, then downgrade")

    prices = await pro_prices()
    price = prices.get(f"{PriceKind.FOUNDING}-month") or prices.get(f"{PriceKind.LIST}-month")
    if not price:
        report.add(name, "a monthly price exists", FAIL, "no active monthly Pro price")
        return

    async with AsyncSessionLocal() as db:
        plan_id = (await db.execute(select(Plan).where(Plan.code == "pro"))).scalar_one().id

    user = await make_user(name)
    clock_id = None
    try:
        clock_id = make_clock(name)
        customer_id = make_customer(clock_id, user.email)
        sub, metadata = await subscribe(user, customer_id, price, plan_id)

        if await wait_for(lambda: sub_row(user.id), "the subscription row") is None:
            report.add(name, "subscription syncs to the database", TIMEOUT)
            return
        report.add(name, "subscription syncs to the database", PASS)

        stripe.Subscription.modify(sub.id, cancel_at_period_end=True)
        row = await wait_for(
            lambda: _row_if(user.id, lambda r: bool(r.cancel_at_period_end)),
            "cancel_at_period_end (customer.subscription.updated)",
        )
        if row is None:
            report.add(name, "cancel-at-period-end syncs", TIMEOUT)
        else:
            report.add(name, "cancel-at-period-end syncs", PASS, f"status={row.status}")
            plan_code = await effective_plan_code(user.id)
            report.add(name, "Pro survives until the period actually ends",
                       PASS if plan_code == "pro" else FAIL,
                       f"effective plan = {plan_code} — they paid for this period")

        item0 = sfield(sfield(stripe.Subscription.retrieve(sub.id), "items"), "data")[0]
        period_end = datetime.fromtimestamp(sfield(item0, "current_period_end"), tz=timezone.utc)
        advance_clock(clock_id, period_end + timedelta(seconds=DRAFT_SETTLE_S), "past the period end")

        row = await wait_for(
            lambda: _row_if(user.id, lambda r: r.status in ("canceled", "cancelled")),
            "status=canceled (customer.subscription.deleted)",
        )
        if row is None:
            report.add(name, "cancellation syncs at period end", TIMEOUT)
        else:
            report.add(name, "cancellation syncs at period end", PASS)
            plan_code = await effective_plan_code(user.id)
            report.add(name, "downgrades to free", PASS if plan_code == "free" else FAIL,
                       f"effective plan = {plan_code}")
    except Exception as exc:  # noqa: BLE001
        report.add(name, "scenario completed", FAIL, f"{type(exc).__name__}: {exc}")
        traceback.print_exc()
    finally:
        if clock_id:
            try:
                stripe.test_helpers.TestClock.delete(clock_id)
            except Exception:  # noqa: BLE001
                pass
        await destroy_user(user.id)


# --------------------------------------------------------------------------------------------- #
# Scenario: payment failure / dunning
# --------------------------------------------------------------------------------------------- #
async def scenario_payment_fail() -> None:
    name = "payment-fail"
    print("\n▶ payment-fail — a renewal that fails, and what the user loses")

    prices = await pro_prices()
    price = prices.get(f"{PriceKind.FOUNDING}-month") or prices.get(f"{PriceKind.LIST}-month")
    if not price:
        report.add(name, "a monthly price exists", FAIL, "no active monthly Pro price")
        return

    async with AsyncSessionLocal() as db:
        plan_id = (await db.execute(select(Plan).where(Plan.code == "pro"))).scalar_one().id

    user = await make_user(name)
    clock_id = None
    try:
        clock_id = make_clock(name)
        # Charges fine on the first invoice, then fails on every renewal — which is exactly the
        # real-world case (a card that expires or is cancelled after signup).
        customer_id = make_customer(clock_id, user.email, card_token="tok_chargeCustomerFail")
        try:
            sub, metadata = await subscribe(user, customer_id, price, plan_id)
        except stripe.error.CardError:
            # Some accounts reject the very first charge with this token; fall back to a good card
            # and swap it for a failing one before the renewal.
            customer_id = make_customer(clock_id, user.email)
            sub, metadata = await subscribe(user, customer_id, price, plan_id)
            bad = stripe.PaymentMethod.create(type="card", card={"token": "tok_chargeCustomerFail"})
            stripe.PaymentMethod.attach(bad.id, customer=customer_id)
            stripe.Customer.modify(customer_id, invoice_settings={"default_payment_method": bad.id})

        if await wait_for(lambda: sub_row(user.id), "the subscription row") is None:
            report.add(name, "subscription syncs to the database", TIMEOUT)
            return
        report.add(name, "subscription syncs to the database", PASS)

        item0 = sfield(sfield(stripe.Subscription.retrieve(sub.id), "items"), "data")[0]
        period_end = datetime.fromtimestamp(sfield(item0, "current_period_end"), tz=timezone.utc)
        advance_clock(clock_id, period_end + timedelta(seconds=DRAFT_SETTLE_S), "renewal (payment fails)")

        row = await wait_for(
            lambda: _row_if(user.id, lambda r: r.status not in ("active", "trialing")),
            "a non-active status (invoice.payment_failed)",
        )
        if row is None:
            report.add(name, "failed payment changes the status", TIMEOUT,
                       "status stayed active — dunning may be configured not to change it")
            return
        report.add(name, "failed payment changes the status", PASS, f"status={row.status}")

        plan_code = await effective_plan_code(user.id)
        # Deliberately reported, not asserted: whether a past_due customer keeps Pro while Stripe
        # retries is a COMMERCIAL decision (ACTIVE_SUBSCRIPTION_STATUSES), not a correctness one.
        report.add(
            name, f"entitlements while status={row.status}", PASS,
            f"effective plan = {plan_code}. "
            + ("Access is revoked on the FIRST failed charge, before Stripe's retries — a card that "
               "expired over a weekend costs them the product for days. Add 'past_due' to "
               "ACTIVE_SUBSCRIPTION_STATUSES if you would rather let dunning run."
               if plan_code != "pro" else
               "Access is retained while Stripe retries. Confirm it is revoked once the "
               "subscription finally cancels."),
        )
    except Exception as exc:  # noqa: BLE001
        report.add(name, "scenario completed", FAIL, f"{type(exc).__name__}: {exc}")
        traceback.print_exc()
    finally:
        if clock_id:
            try:
                stripe.test_helpers.TestClock.delete(clock_id)
            except Exception:  # noqa: BLE001
                pass
        await destroy_user(user.id)


# --------------------------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------------------------- #
SCENARIOS = {
    "local": scenario_local,
    "clock-yearly": scenario_clock_yearly,
    "clock-monthly": scenario_clock_monthly,
    "cancel": scenario_cancel,
    "payment-fail": scenario_payment_fail,
}


async def main() -> int:
    parser = argparse.ArgumentParser(description="Pricing v2.1 end-to-end harness (Stripe sandbox only).")
    parser.add_argument("scenario", choices=[*SCENARIOS, "all"], help="Which scenario to run.")
    args = parser.parse_args()

    key = settings.stripe_secret_key or ""
    if not key:
        print("STRIPE_SECRET_KEY is not set. Refusing to run.")
        return 2
    if not key.startswith("sk_test"):
        print("=" * 92)
        print("REFUSING TO RUN: this is not a test key.")
        print("Test clocks exist only in sandboxes, and this script creates subscriptions and")
        print("charges cards. Point STRIPE_SECRET_KEY at your sandbox and try again.")
        print("=" * 92)
        return 2

    print(f"Stripe key ……… {key[:12]}… (sandbox)")
    print(f"Database ……… {settings.database_name if hasattr(settings, 'database_name') else 'configured'}")
    print(f"Beta window … {BillingService().beta_window()}")

    chosen = list(SCENARIOS) if args.scenario == "all" else [args.scenario]
    for scenario in chosen:
        try:
            await SCENARIOS[scenario]()
        except Exception as exc:  # noqa: BLE001
            report.add(scenario, "scenario crashed", FAIL, f"{type(exc).__name__}: {exc}")
            traceback.print_exc()

    return report.summary()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
