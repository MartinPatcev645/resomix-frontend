"""
Reset the monthly usage counters for the stress-test accounts
=============================================================

Load testing spends real allowances. ``uploads_per_month`` and
``search_playlists_per_month`` are Redis counters on a billing-period window, so the stress
suite's ``04_cleanup_db.py`` — which deletes the ROWS a run created — has never given them
back. Across phase 4 that quietly consumed the whole month's budget for all ten accounts, and
runs started returning 402 before they returned anything interesting (2026-08-14: an entire
scenario came back ``{402: 3}``, so nothing was measured at all).

This resets those counters, for the stress accounts and nothing else.

Usage:
  python scripts/reset_stress_quota.py                      # DRY RUN — prints what it would delete
  python scripts/reset_stress_quota.py --apply              # actually delete
  python scripts/reset_stress_quota.py --feature uploads_per_month --apply

Safety
------
* Users are selected ONLY by the ``stress_test_user_`` username prefix — the same guard the
  suite's cleanup scripts use. A subject id that did not come from that query is never touched.
* ``SCAN``, never ``KEYS``: this runs against production Redis, and ``KEYS`` blocks the server
  for the length of the scan.
* Dry run is the default. You have to ask for the delete.
"""

import argparse
import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from app.api.dependencies.database import get_database_session
from app.core.entitlement_keys import FeatureKey
from app.db.redis import get_redis_or_none
from app.models.user import User

# The ONLY accounts this script may touch. Must match `USER_PREFIX` in the stress suite's
# config.py — it is what makes a production Redis delete safe to run.
USERNAME_PREFIX = "stress_test_user_"

# Metered per-month features the suite actually spends.
DEFAULT_FEATURES = (
    FeatureKey.UPLOADS_PER_MONTH,
    FeatureKey.SEARCH_PLAYLISTS_PER_MONTH,
)


async def _stress_user_ids() -> list[tuple[int, str]]:
    """(id, username) for every stress account. Empty list if none exist."""
    async for db in get_database_session():
        rows = await db.execute(
            select(User.id, User.username).where(User.username.like(f"{USERNAME_PREFIX}%"))
        )
        return [(int(r[0]), r[1]) for r in rows.all()]
    return []


async def reset(features: tuple[str, ...], apply: bool) -> int:
    users = await _stress_user_ids()
    if not users:
        print(f"No accounts matching '{USERNAME_PREFIX}*' — nothing to do.")
        return 0

    print(f"Found {len(users)} stress account(s): {', '.join(u[1] for u in users)}")

    client = await get_redis_or_none()
    if client is None:
        print("ERROR: Redis unavailable — cannot read or reset counters.")
        return 1

    total = 0
    try:
        for user_id, username in users:
            for feature in features:
                # Both the counter and its cosmetic `:bonus:` sibling live under this prefix.
                pattern = f"usage:user:{user_id}:{feature}:*"
                keys = [k async for k in client.scan_iter(match=pattern, count=100)]
                if not keys:
                    continue
                for key in keys:
                    value = await client.get(key)
                    print(f"  {'DELETE' if apply else 'would delete'}  {key}  (= {value})")
                if apply:
                    await client.delete(*keys)
                total += len(keys)
            _ = username  # printed above; kept for the loop's readability
    finally:
        await client.close()

    if total == 0:
        print("No usage counters set — allowances are already fresh.")
    elif apply:
        print(f"\nReset {total} counter(s). The accounts have their full monthly allowance back.")
    else:
        print(f"\nDRY RUN — {total} counter(s) would be reset. Re-run with --apply to do it.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument(
        "--apply", action="store_true",
        help="actually delete the counters (default is a dry run)",
    )
    parser.add_argument(
        "--feature", action="append", dest="features", metavar="KEY",
        help=f"feature key to reset; repeatable. Default: {', '.join(DEFAULT_FEATURES)}",
    )
    args = parser.parse_args()
    features = tuple(args.features) if args.features else DEFAULT_FEATURES
    print(f"Features: {', '.join(features)}")
    sys.exit(asyncio.run(reset(features, args.apply)))


if __name__ == "__main__":
    main()
