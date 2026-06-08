"""
Cleanup Test Partners
=====================

One-shot script to purge every partner from the database that is NOT the
production frontend tenant (partner_id = 1).

Run modes
---------
  # Preview what will be deleted (safe, no writes):
  python scripts/cleanup_test_partners.py --dry-run

  # Actually delete:
  python scripts/cleanup_test_partners.py

The script disables foreign-key checks for the duration of the DELETE so that
RESTRICT-FK child rows (api_keys, usage_logs, tracks, sftp_users, etc.) do not
block the operation, then immediately re-enables them.  Partner 1 is hard-coded
as protected and will never be removed.

Usage notes
-----------
* Stop the Alwyzon server before running to avoid mid-flight requests hitting
  partners that are being deleted.  (The server will pick up the clean state on
  the next restart.)
* The script only touches the ``partners`` table (and cascade / FK-linked rows).
  No files on disk are removed.  Hetzner-side data for partner ≥ 2 can be
  cleaned separately with:
      rm -rf data/partners/<id>         (on the Hetzner server)

Version: 1.0.0
Date: June 8, 2026
"""

import asyncio
import argparse
import sys
import os

# Allow running from the project root without installing the package.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from database.connection import AsyncSessionLocal

# Partner IDs that are NEVER deleted.
PROTECTED_IDS: frozenset[int] = frozenset({1})


async def main(dry_run: bool) -> None:
    print("=" * 60)
    print("Resomix — Test Partner Cleanup")
    print("=" * 60)

    # ── 1. Discover which partners exist ────────────────────────────────────
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("SELECT id, display_name, contact_email, tier FROM partners ORDER BY id")
        )
        all_partners = result.fetchall()

    if not all_partners:
        print("No partners found in the database.")
        return

    to_keep = [(r[0], r[1], r[2], r[3]) for r in all_partners if r[0] in PROTECTED_IDS]
    to_delete = [(r[0], r[1], r[2], r[3]) for r in all_partners if r[0] not in PROTECTED_IDS]

    print(f"\nTotal partners in DB  : {len(all_partners)}")
    print(f"Protected (kept)      : {len(to_keep)}")
    print(f"To be deleted         : {len(to_delete)}")

    print("\n--- Partners to KEEP ---")
    for pid, name, email, tier in to_keep:
        print(f"  id={pid:6}  {name:<35}  {tier}")

    print("\n--- Partners to DELETE ---")
    for pid, name, email, tier in to_delete[:50]:
        print(f"  id={pid:6}  {name:<35}  {tier}")
    if len(to_delete) > 50:
        print(f"  ... and {len(to_delete) - 50} more")

    if not to_delete:
        print("\nNothing to delete.")
        return

    if dry_run:
        print("\n[DRY RUN] No changes written.  Re-run without --dry-run to apply.")
        return

    # ── 2. Confirm ─────────────────────────────────────────────────────────
    answer = input(
        f"\nAbout to DELETE {len(to_delete)} partner(s) from the DB.\n"
        "Type 'yes' to confirm: "
    ).strip().lower()
    if answer != "yes":
        print("Aborted.")
        return

    # ── 3. Delete ───────────────────────────────────────────────────────────
    delete_ids = [pid for pid, *_ in to_delete]

    # Chunk into batches of 500 to avoid hitting max_allowed_packet limits on
    # large IN clauses.
    CHUNK = 500
    deleted_total = 0

    async with AsyncSessionLocal() as db:
        await db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))

        for i in range(0, len(delete_ids), CHUNK):
            chunk = delete_ids[i : i + CHUNK]
            # SQLAlchemy renders tuples correctly for IN clauses.
            result = await db.execute(
                text("DELETE FROM partners WHERE id IN :ids AND id NOT IN :protected"),
                {"ids": tuple(chunk), "protected": tuple(PROTECTED_IDS)},
            )
            deleted_total += result.rowcount
            print(f"  Deleted chunk {i // CHUNK + 1}: {result.rowcount} rows")

        await db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        await db.commit()

    print(f"\nDone.  Deleted {deleted_total} partner row(s).")
    print("Note: Hetzner-side partner directories (data/partners/<id>/) are NOT removed by this script.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Delete all test partners (keep partner 1 only).")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be deleted without making any changes.",
    )
    args = parser.parse_args()
    asyncio.run(main(dry_run=args.dry_run))
