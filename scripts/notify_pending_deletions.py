"""
Nudge admins about ageing deletion requests
===========================================

WHY

The pending-deletions queue on the admin Users page is **pull**: it tells you what is waiting, but
only if somebody opens it. Nothing about a deletion request is pushed anywhere, and nothing scrubs
on a timer — so a request that nobody happens to look at simply sits, silently, while the one-month
clock in Art. 12(3) runs out.

"Failed to respond in time / no proper process" is the category regulators actually fine, far more
often than the substance of what was retained. This is the cheapest possible insurance against it.

WHEN IT SENDS

Only when something is **approaching** (two-thirds of the SLA) or **overdue**. A daily "nothing to
do" email is a daily email people learn to ignore, and the one day it says something different is
the day it gets deleted unread. Silence means nothing is waiting.

WHO IT GOES TO

Every active user with the ``admin`` role. Read from ``user_roles`` rather than a configured
address list, so a new admin is covered the day they are made one and a departed one stops
receiving it.

USAGE

    PYTHONPATH="$PWD" .venv/bin/python scripts/notify_pending_deletions.py --dry-run
    PYTHONPATH="$PWD" .venv/bin/python scripts/notify_pending_deletions.py

Read-only apart from sending. Safe to run repeatedly — it is a daily summary, not a claim-once
notification, so re-running simply re-sends the same picture.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy import text

logger = logging.getLogger("notify_pending_deletions")


async def collect(db, sla_days: int) -> Dict[str, Any]:
    """The same question the admin queue asks, in one place.

    `deletion_requested_at IS NOT NULL AND anonymized_at IS NULL` is exactly "asked to leave, not
    yet actioned" — an already-scrubbed account still carries the request timestamp, so leaving
    the second condition off would report finished work as outstanding forever.
    """
    rows = (
        await db.execute(
            text(
                "SELECT uuid, email, name, username, deletion_requested_at "
                "FROM users "
                "WHERE deletion_requested_at IS NOT NULL AND anonymized_at IS NULL "
                "ORDER BY deletion_requested_at ASC"
            )
        )
    ).mappings().all()

    now = datetime.utcnow()
    items: List[Dict[str, Any]] = []
    for r in rows:
        waiting = (now - r["deletion_requested_at"]).days if r["deletion_requested_at"] else 0
        items.append(
            {
                "uuid": r["uuid"],
                "email": r["email"],
                "requested_on": r["deletion_requested_at"].strftime("%-d %b %Y")
                if r["deletion_requested_at"]
                else "—",
                "waiting_days": waiting,
                # Same thresholds as the queue. Duplicated arithmetic would let a digest and a
                # screen disagree about whether something is late.
                "approaching": sla_days * 2 // 3 <= waiting < sla_days,
                "overdue": waiting >= sla_days,
            }
        )

    return {
        "items": items,
        "total": len(items),
        "overdue": sum(1 for i in items if i["overdue"]),
        "approaching": sum(1 for i in items if i["approaching"]),
    }


async def _admins(db) -> List[Dict[str, Any]]:
    rows = (
        await db.execute(
            text(
                "SELECT DISTINCT u.email, u.name, u.username "
                "FROM users u "
                "JOIN user_roles ur ON ur.user_id = u.id "
                "JOIN roles r ON r.id = ur.role_id "
                "WHERE r.name = 'admin' AND u.is_active = 1 AND u.email IS NOT NULL "
                "  AND u.anonymized_at IS NULL"
            )
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def run(*, dry_run: bool = False) -> Dict[str, Any]:
    from database.connection import AsyncSessionLocal

    from app.core.config import settings
    from app.services.email_service import EmailService

    sla = settings.deletion_request_sla_days

    async with AsyncSessionLocal() as db:
        state = await collect(db, sla)

        # The whole point of the "only when it matters" rule. A queue of five requests all made
        # this week needs no email — the admin will see them when they next open the page.
        if not state["overdue"] and not state["approaching"]:
            return {**state, "sent": 0, "quiet": True}

        admins = await _admins(db)
        if not admins:
            logger.warning("Nothing to send to: no active admin has an email address.")
            return {**state, "sent": 0, "quiet": False}

        if dry_run:
            for a in admins:
                logger.info("would notify %s", a["email"])
            return {**state, "sent": len(admins), "quiet": False, "dry_run": True}

        service = EmailService()
        sent = 0
        for admin in admins:
            try:
                ok = await service.send_pending_deletions_digest(
                    email=admin["email"],
                    name=admin.get("name") or admin.get("username") or "there",
                    items=state["items"],
                    total=state["total"],
                    overdue=state["overdue"],
                    approaching=state["approaching"],
                    sla_days=sla,
                    admin_url=settings.admin_url,
                )
                sent += 1 if ok else 0
            except Exception as exc:  # noqa: BLE001 — one bad address must not stop the rest
                logger.error("could not notify %s: %s", admin["email"], exc)

        return {**state, "sent": sent, "quiet": False}


def main() -> int:
    parser = argparse.ArgumentParser(description="Email admins about ageing deletion requests.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    result = asyncio.run(run(dry_run=args.dry_run))
    if result.get("quiet"):
        print(f"Nothing needs attention ({result['total']} pending, none due). No email sent.")
        return 0

    verb = "Would notify" if args.dry_run else "Notified"
    print(
        f"{result['total']} pending — {result['overdue']} overdue, "
        f"{result['approaching']} approaching. {verb} {result['sent']} admin(s)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
