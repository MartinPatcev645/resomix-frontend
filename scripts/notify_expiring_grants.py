"""
Tell people when their complimentary plan is ending
===================================================

WHY

Grant expiry is **read-time**: ``UserPlanGrant.ends_at`` is compared on every entitlement lookup,
and there is no job behind it. That is a good design — nothing can fall behind, and there is no
window where the row says one thing and enforcement does another — but it means nobody ever
*notices* an expiry happening, including the person it happens to.

So today, an admin comps someone Pro for 30 days and on day 31 that user finds their features
refusing to work, with no email, no warning and no explanation. It reads as a fault rather than a
gift running its course, and the moment they were most likely to subscribe has already passed.

WHAT IT SENDS

* **3 days before** — "ends Friday, nothing will be charged, here are the plans".
* **On expiry** — "it's ended, your account is back on free, everything you made is still here".

SENDING ONCE, WITHOUT A NEW COLUMN

Reuses ``billing_notifications`` and its UNIQUE ``dedupe_key``. Claiming the key IS the guard: two
overlapping runs both try to insert, one loses on the unique index and stays quiet. A
read-then-write check would let both through.

Keys are ``grant_expiring:<grant_id>`` and ``grant_expired:<grant_id>`` — per grant, not per user,
so someone comped twice is told twice, which is correct.

USAGE

    # What would go out. Sends nothing.
    PYTHONPATH="$PWD" .venv/bin/python scripts/notify_expiring_grants.py --dry-run

    # For real. Idempotent — a second run the same day sends nothing.
    PYTHONPATH="$PWD" .venv/bin/python scripts/notify_expiring_grants.py

Safe to run repeatedly, and safe to miss a day: the expired query looks back over a window rather
than at a single date, so a box that was down still catches up.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

from sqlalchemy import text

logger = logging.getLogger("notify_expiring_grants")

# How many days ahead the warning goes out.
WARN_DAYS = 3

# How far back the "it expired" query looks. Wider than a day on purpose: a missed run — a reboot,
# a failed timer — would otherwise skip those people permanently, and there is no second chance to
# tell someone their plan ended.
LOOKBACK_DAYS = 7


async def _recipients(db, sql: str, params: dict) -> List[Dict[str, Any]]:
    rows = (await db.execute(text(sql), params)).mappings().all()
    return [dict(r) for r in rows]


async def notify(*, dry_run: bool = False) -> Dict[str, Any]:
    """Send both notices. Returns a summary rather than printing, so tests can assert on it."""
    from database.connection import AsyncSessionLocal

    from app.services.email_service import EmailService

    now = datetime.utcnow()
    summary: Dict[str, Any] = {"expiring": 0, "expired": 0, "skipped": 0, "failed": 0}
    email_service = EmailService()

    # A live grant is one that has not been revoked and has not yet ended. Both conditions matter:
    # a revoked grant must not generate an "ending soon" note for something already gone.
    BASE = """
        SELECT g.id AS grant_id, g.ends_at, u.id AS user_id, u.email, u.name, u.username,
               p.name AS plan_name
        FROM user_plan_grants g
        JOIN users u ON u.id = g.user_id
        JOIN plans p ON p.id = g.plan_id
        WHERE g.revoked_at IS NULL
          AND u.is_active = 1
          AND u.anonymized_at IS NULL
          AND {window}
    """

    async with AsyncSessionLocal() as db:
        expiring = await _recipients(
            db,
            BASE.format(window="g.ends_at > :now AND g.ends_at <= :soon"),
            {"now": now, "soon": now + timedelta(days=WARN_DAYS)},
        )
        expired = await _recipients(
            db,
            BASE.format(window="g.ends_at <= :now AND g.ends_at > :floor"),
            {"now": now, "floor": now - timedelta(days=LOOKBACK_DAYS)},
        )

        for kind, rows in (("expiring", expiring), ("expired", expired)):
            for row in rows:
                key = f"grant_{kind}:{row['grant_id']}"
                if not row.get("email"):
                    summary["skipped"] += 1
                    continue

                if dry_run:
                    logger.info("would send %s to %s (grant %s)", kind, row["email"], row["grant_id"])
                    summary[kind] += 1
                    continue

                # Claim first. The unique index is what actually serialises two overlapping runs;
                # checking-then-sending would let both through.
                if not await _claim(db, row, key, kind):
                    summary["skipped"] += 1
                    continue

                ends_on = row["ends_at"].strftime("%-d %B %Y")
                name = row.get("name") or row.get("username") or "there"
                plan = row.get("plan_name") or "Pro"

                try:
                    if kind == "expiring":
                        days_left = max(1, (row["ends_at"] - now).days)
                        sent = await email_service.send_grant_expiring_soon(
                            email=row["email"], name=name, plan_name=plan,
                            days_left=days_left, ends_on=ends_on,
                        )
                    else:
                        sent = await email_service.send_grant_expired(
                            email=row["email"], name=name, plan_name=plan, ends_on=ends_on,
                        )
                except Exception as exc:  # noqa: BLE001 — one bad address must not stop the run
                    logger.error("could not send %s for grant %s: %s", kind, row["grant_id"], exc)
                    sent = False

                summary[kind if sent else "failed"] += 1

    return summary


async def _claim(db, row: Dict[str, Any], dedupe_key: str, template: str) -> bool:
    """Reserve the right to send this one. False means it has already gone out."""
    from sqlalchemy.exc import IntegrityError

    from app.models.billing import BillingNotification

    existing = (
        await db.execute(
            text("SELECT 1 FROM billing_notifications WHERE dedupe_key = :k LIMIT 1"),
            {"k": dedupe_key},
        )
    ).first()
    if existing:
        return False

    db.add(
        BillingNotification(
            user_id=row["user_id"],
            dedupe_key=dedupe_key,
            template=template,
            recipient_email=row["email"],
            status="sent",
        )
    )
    try:
        await db.commit()
        return True
    except IntegrityError:
        # Lost the race to a concurrent run. Staying quiet is the correct outcome, not an error.
        await db.rollback()
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Notify users about complimentary plans ending.")
    parser.add_argument("--dry-run", action="store_true", help="Report what would go. Sends nothing.")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    result = asyncio.run(notify(dry_run=args.dry_run))
    verb = "Would send" if args.dry_run else "Sent"
    print(
        f"{verb} {result['expiring']} ending-soon and {result['expired']} ended notice(s). "
        f"{result['skipped']} already sent or skipped, {result['failed']} failed."
    )
    return 1 if result["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
