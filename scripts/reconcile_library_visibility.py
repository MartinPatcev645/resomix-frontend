"""
Make ``playlists.is_library_visible`` agree with each owner's actual plan
========================================================================

WHAT WENT WRONG

`is_library_visible` was written once, at creation, and never revisited. While an account was Pro
every new playlist was stamped `1`. When the Stripe sandbox → live switch broke the Pro plans and
those accounts were forced back to free, the stamps stayed — so their Libraries went on listing
every playlist they had ever made. **Downgrading the plan did not downgrade the privileges**, because
nothing was looking at the plan any more; it was looking at a flag set months earlier.

READ THIS BEFORE RUNNING IT

The application no longer reads this column at all. Visibility is derived per request from the
owner's live entitlement (`PlaylistRepository.async_visible_playlist_ids`), so once that code is
deployed a plan change takes effect on the very next page load, in both directions, with nothing to
sweep. **This script does not fix the app. It fixes the data.**

It is still worth running, for two reasons:

* **Before that deploy**, it is the fix — it puts the stored flags back in line with the plans and
  the affected Libraries stop over-listing immediately.
* **After it**, it makes the column safe to roll back to. It was deliberately left in the schema so
  the change could be reversed; a rollback onto stale flags would reinstate exactly this bug.

WHAT IT DOES

For every user who owns a playlist, it resolves the **effective** plan through the same
`EntitlementGate` the app uses — subscription → admin grant → default — and then writes the flags to
match what the app would show.

* **Unlimited plans (Pro, and anyone comped by an admin) are set to ALL VISIBLE.** They are not
  skipped and they are not restricted. A comped account is not a free account, and the point of
  resolving the real entitlement rather than filtering on "is this user free" is that nobody has to
  keep a list of who the exceptions are.
* **Capped plans** get their N most recent visible and the rest hidden — the same N, in the same
  order, that `async_visible_playlist_ids` returns. That function is called directly rather than
  reimplemented, so the script and the application cannot disagree about which five.

Usage
-----
    python scripts/reconcile_library_visibility.py                # DRY RUN — estimate only
    python scripts/reconcile_library_visibility.py --apply        # write the flags
    python scripts/reconcile_library_visibility.py --user 1234    # one account, either mode

Safety
------
* Dry run is the default, and reports the exact number of rows that would change, by plan.
* Reads the cap through the live entitlement chain — never a hard-coded 5, so basic/max/comped
  accounts get their own number rather than the free one.
* Touches only `is_library_visible`. No playlist is deleted, hidden from its owner by link, or
  altered in any other column.
"""

import argparse
import asyncio
import os
import sys
from collections import defaultdict
from typing import Dict, List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, text, update  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.context import set_admin_context, set_current_partner_id  # noqa: E402
from app.core.entitlement_keys import FeatureKey  # noqa: E402
from app.models.playlist import Playlist  # noqa: E402
from app.models.user import User  # noqa: E402
from app.repositories.playlist_repository import PlaylistRepository  # noqa: E402
from app.services.entitlement_gate import EntitlementGate  # noqa: E402
from database.connection import AsyncSessionLocal  # noqa: E402


async def _owner_ids(db, only_user: Optional[int]) -> List[int]:
    """Users who own at least one live playlist. Nobody else has anything to reconcile.

    Partner-scoped explicitly: this is raw SQL, so the tenancy failsafe that guards ORM queries does
    not see it. The Library cap is a consumer concept anyway — B2B partners have no Library — so
    confining the sweep to the system partner is both the safe answer and the correct one.
    """
    if only_user:
        return [only_user]
    rows = await db.execute(
        text("SELECT DISTINCT user_id FROM playlists WHERE user_id IS NOT NULL "
             "AND deleted_at IS NULL AND partner_id = :pid ORDER BY user_id"),
        {"pid": settings.system_partner_id})
    return [r[0] for r in rows.fetchall()]


async def reconcile(db, user_id: int, gate: EntitlementGate, repo: PlaylistRepository) -> Dict:
    """What this user's flags SHOULD be, and how far the stored ones are from it."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        return {"skipped": "no such user"}

    plan, _ = await gate._entitlements.get_effective_map(db, user=user)
    cap = await gate.get_cap(db, FeatureKey.LIBRARY_PLAYLISTS_MAX, user=user)

    # The application's own answer, not a copy of its logic. `None` means unlimited.
    visible_ids = await repo.async_visible_playlist_ids(db, user_id, cap)

    rows = (await db.execute(
        select(Playlist.id, Playlist.is_library_visible)
        .where(Playlist.user_id == user_id, Playlist.deleted_at.is_(None))
    )).all()

    to_show, to_hide = [], []
    for pid, stored in rows:
        should_be = True if visible_ids is None else pid in visible_ids
        if bool(stored) == should_be:
            continue
        (to_show if should_be else to_hide).append(pid)

    return {
        "plan": plan.code,
        "cap": "unlimited" if cap is None or cap < 0 else cap,
        "owned": len(rows),
        "to_show": to_show,
        "to_hide": to_hide,
    }


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="write the flags (default is a dry run)")
    ap.add_argument("--user", type=int, help="reconcile a single user id")
    args = ap.parse_args()

    # The consumer surface, and only it. Without this the ORM queries below trip the multi-tenancy
    # failsafe — correctly: a script that walks every playlist in the database is exactly what that
    # guard exists to stop happening by accident.
    set_current_partner_id(settings.system_partner_id)
    set_admin_context(False)

    gate, repo = EntitlementGate(), PlaylistRepository()
    by_plan: Dict[str, Dict[str, int]] = defaultdict(lambda: {"users": 0, "hide": 0, "show": 0})
    total_hide = total_show = touched = 0

    async with AsyncSessionLocal() as db:
        owners = await _owner_ids(db, args.user)
        print(f"Playlist owners to check: {len(owners)}\n")

        for uid in owners:
            r = await reconcile(db, uid, gate, repo)
            if r.get("skipped"):
                continue
            hide, show = len(r["to_hide"]), len(r["to_show"])
            bucket = by_plan[f"{r['plan']} (cap {r['cap']})"]
            bucket["users"] += 1
            bucket["hide"] += hide
            bucket["show"] += show
            if not (hide or show):
                continue
            touched += 1
            total_hide += hide
            total_show += show

            if args.apply:
                if r["to_hide"]:
                    await db.execute(update(Playlist)
                                     .where(Playlist.id.in_(r["to_hide"]))
                                     .values(is_library_visible=False))
                if r["to_show"]:
                    await db.execute(update(Playlist)
                                     .where(Playlist.id.in_(r["to_show"]))
                                     .values(is_library_visible=True))
                await db.commit()

        width = max((len(k) for k in by_plan), default=10)
        print("By effective plan:")
        print(f"  {'plan'.ljust(width)}  users   to hide   to show")
        for label in sorted(by_plan):
            b = by_plan[label]
            print(f"  {label.ljust(width)}  {b['users']:5}   {b['hide']:7}   {b['show']:7}")

        print(f"\nAccounts needing a change : {touched}")
        print(f"Playlists to HIDE         : {total_hide}   (were listed while over the cap)")
        print(f"Playlists to SHOW         : {total_show}   (were hidden while the plan allows them)")

        if not args.apply:
            print("\nDRY RUN — nothing written. Re-run with --apply to write these flags.")
        else:
            print("\nApplied.")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
