"""
Prune old `system_logs` rows
============================

WHY

``system_logs`` had no retention at all — every row ever written was still there. Two problems, one
of which is a compliance issue rather than a housekeeping one:

* **Storage limitation.** Personal data kept on legitimate-interest grounds (security, abuse
  prevention) has to be time-bounded under Art. 5(1)(e). "Forever" is not a defensible period.
* **The table is unreachable by any account scrub.** It has no ``user_id`` column, so nothing keyed
  on a user can find its rows. Time is the only handle we have on it.

Together with ``app/utils/pii.py`` — which stopped the raw email going in — this is the containment
half of the pair. See ``docs/ACCOUNT_DELETION_GDPR_OPTIONS.md`` §5.

WHAT THIS ALSO DELETES, DELIBERATELY

Stripe webhook payloads are archived in ``log_metadata.raw_payload``, and
``scripts/diagnose_subscription.py`` reads them to reconstruct a billing timeline. Pruning removes
that history beyond the window.

That is intended. Billing discrepancies surface within days, 90 days is a wide margin for
diagnosing one, and those payloads carry the customer's name and email from Stripe — so they are
exactly the kind of thing that should not accumulate indefinitely.

USAGE

    # See what would go. Writes nothing.
    PYTHONPATH="$PWD" .venv/bin/python scripts/prune_system_logs.py --dry-run

    # Delete, using the configured window (SYSTEM_LOG_RETENTION_DAYS, default 90).
    PYTHONPATH="$PWD" .venv/bin/python scripts/prune_system_logs.py

    # Override the window for one run.
    PYTHONPATH="$PWD" .venv/bin/python scripts/prune_system_logs.py --days 30

Deletes in batches, committing each one, so a large first run cannot hold a long transaction or
blow up the undo log. Safe to interrupt: what is committed stays deleted and the next run picks up
where it left off. Safe to run repeatedly — once the backlog is gone a run deletes nothing.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timedelta

from sqlalchemy import text

logger = logging.getLogger("prune_system_logs")

# Bounded so one statement never locks the table for long on the first run, which has to clear
# however many months accumulated before this existed.
BATCH_SIZE = 1000

# A backstop, not a policy: without it an unexpected condition could loop forever. At the default
# batch size this is 5M rows, far beyond any real backlog.
MAX_BATCHES = 5000


async def prune(days: int, *, dry_run: bool = False, batch_size: int = BATCH_SIZE) -> dict:
    """Delete `system_logs` rows older than `days`.

    Returns a summary dict rather than printing, so the tests can assert on it and the CLI can
    format it.
    """
    from database.connection import AsyncSessionLocal

    if days <= 0:
        # 0 is the documented "disabled" value. Treating it as "delete everything" would be a
        # catastrophic reading of a config default, so it is refused explicitly.
        return {"skipped": True, "reason": "retention disabled (days <= 0)", "deleted": 0}

    cutoff = datetime.utcnow() - timedelta(days=days)
    summary = {"skipped": False, "cutoff": cutoff.isoformat(), "deleted": 0, "batches": 0}

    async with AsyncSessionLocal() as db:
        due = (
            await db.execute(
                text("SELECT COUNT(*) FROM system_logs WHERE created_at < :cutoff"),
                {"cutoff": cutoff},
            )
        ).scalar() or 0
        summary["due"] = int(due)

        if dry_run or due == 0:
            summary["dry_run"] = dry_run
            return summary

        for _ in range(MAX_BATCHES):
            result = await db.execute(
                text("DELETE FROM system_logs WHERE created_at < :cutoff LIMIT :n"),
                {"cutoff": cutoff, "n": batch_size},
            )
            # Commit per batch: an interrupted run leaves the work done so far durably deleted
            # rather than rolling back hours of progress.
            await db.commit()

            if not result.rowcount:
                break
            summary["deleted"] += result.rowcount
            summary["batches"] += 1
            logger.info("pruned %s rows (%s total)", result.rowcount, summary["deleted"])
        else:
            # Fell out of the loop without breaking — report it rather than pretending the table
            # is now clean.
            summary["hit_batch_limit"] = True

    return summary


def main() -> int:
    from app.core.config import settings

    parser = argparse.ArgumentParser(description="Delete system_logs rows past the retention window.")
    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help="Retention window. Defaults to SYSTEM_LOG_RETENTION_DAYS (currently "
             f"{settings.system_log_retention_days}).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report what would go. Writes nothing.")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--quiet", action="store_true", help="Only print the final line.")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    days = args.days if args.days is not None else settings.system_log_retention_days
    result = asyncio.run(prune(days, dry_run=args.dry_run, batch_size=args.batch_size))

    if result.get("skipped"):
        print(f"Skipped: {result['reason']}")
        return 0

    if args.dry_run:
        print(f"Would delete {result['due']} row(s) older than {days} days (before {result['cutoff']}).")
        return 0

    print(f"Deleted {result['deleted']} row(s) older than {days} days.")
    if result.get("hit_batch_limit"):
        print("Stopped at the batch limit — run again to continue.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
