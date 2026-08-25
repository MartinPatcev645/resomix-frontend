#!/usr/bin/env python3
"""How far the catalogue is ingested, read from the DATABASE, by parsing paths.

READ-ONLY. Writes nothing, ever.

WHY THIS EXISTS

Before topping the catalogue up you need the last day whose music is already in, so the
next scan can start from the folders after it. The electrobuzz box answers this from its
own run logs (`monthly_pipeline/last_ingested_date.py`), but those logs are a record of
what a run *believed* it sent, written up to a year ago. This asks the database instead:
whatever is actually there now, regardless of what any run claimed.

WHY THE PATH AND NOT `created_at`

`created_at` is when *we* inserted the row, which drifts from the music's own date by
however long a backfill, a retry or a migration took. The catalogue's date lives in the
path, because the Vegerra tree is filed by year and month and day. So the date is parsed
out of `audio_files.stored_path` and `created_at` is never consulted.

The tree carries the date two ways, and both appear within the same month::

    .../Essential_House/2025/10-2025/11/<release>/<track>.mp3     -> 2025-10-11
    .../Dj_Chart/2025/10-2025/... [2025-10-16]/<track>.flac       -> 2025-10-16

Some releases carry no day at all, only `<YYYY>/<MM-YYYY>/`. Those are counted and
reported separately rather than guessed at: inventing a day would move the resume point
and risk skipping real music.

The parsing is deliberately identical to the electrobuzz-side script so the two answers
are directly comparable. They live in different repos with no shared package, so the
patterns are duplicated on purpose; if one changes, change both.

Usage
-----
    python scripts/catalogue_high_water_mark.py
    python scripts/catalogue_high_water_mark.py --top 10 --show-roots
    python scripts/catalogue_high_water_mark.py --partner-id 1
    python scripts/catalogue_high_water_mark.py --like '%veggera%'
    python scripts/catalogue_high_water_mark.py --active-only
"""

import argparse
import asyncio
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from typing import Dict, Optional, Tuple

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from app.core.context import set_admin_context, set_current_partner_id  # noqa: E402
from database.connection import AsyncSessionLocal  # noqa: E402


# Kept byte-identical to monthly_pipeline/last_ingested_date.py on the electrobuzz box.
_DAY_FOLDER = re.compile(r"/(?P<year>20\d{2})/(?P<month>\d{2})-(?P=year)/(?P<day>\d{1,2})(?:/|$)")
_BRACKET_DATE = re.compile(r"\[(?P<year>20\d{2})-(?P<month>\d{2})-(?P<day>\d{2})\]")
_MONTH_ONLY = re.compile(r"/(?P<year>20\d{2})/(?P<month>\d{2})-(?P=year)(?:/|$)")


def extract_date(path: str) -> Tuple[Optional[date], str]:
    """Return (date, how_it_was_found) for one catalogue path.

    The bracketed date wins when both are present: it names the release date explicitly,
    whereas the day folder is only where the file happened to be filed.
    """
    m = _BRACKET_DATE.search(path)
    if m:
        try:
            return date(int(m["year"]), int(m["month"]), int(m["day"])), "bracket"
        except ValueError:
            pass  # e.g. [2025-13-40]; fall through to the folder form

    m = _DAY_FOLDER.search(path)
    if m:
        try:
            return date(int(m["year"]), int(m["month"]), int(m["day"])), "day-folder"
        except ValueError:
            pass

    m = _MONTH_ONLY.search(path)
    if m:
        return None, f"month-only:{m['month']}-{m['year']}"

    return None, "unparsed"


async def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--top", type=int, default=5, help="How many recent dates to show (default 5).")
    ap.add_argument("--type", default="electrobuzz",
                    help="tracks.type to read. Default 'electrobuzz'. Pass '' for every type.")
    ap.add_argument("--partner-id", type=int, help="Restrict to one partner.")
    ap.add_argument("--like", help="Only paths matching this SQL LIKE, e.g. '%%veggera%%'.")
    ap.add_argument("--active-only", action="store_true",
                    help="Ignore deactivated tracks. Off by default: a deactivated track was "
                         "still ingested, and this question is 'how far did we get'.")
    ap.add_argument("--show-roots", action="store_true",
                    help="Break each reported date down by catalogue root.")
    ap.add_argument("--chunk", type=int, default=50_000, help="Rows per fetch (default 50,000).")
    args = ap.parse_args()

    # Admin context: this reads across the whole catalogue, so the per-partner failsafe
    # in database/connection.py must not inject a tenant filter.
    set_current_partner_id(None)
    set_admin_context(True)

    where = ["af.asset_class = 'Master'", "af.stored_path IS NOT NULL", "af.stored_path <> ''"]
    params: Dict[str, object] = {}
    if args.type:
        where.append("t.type = :ttype")
        params["ttype"] = args.type
    if args.partner_id is not None:
        where.append("t.partner_id = :pid")
        params["pid"] = args.partner_id
    if args.like:
        where.append("af.stored_path LIKE :like")
        params["like"] = args.like
    if args.active_only:
        where.append("t.is_active IS NOT FALSE")

    sql = f"""
        SELECT af.id, af.stored_path
          FROM audio_files af
          JOIN tracks t ON t.id = af.track_id
         WHERE {' AND '.join(where)}
           AND af.id > :cursor
         ORDER BY af.id
         LIMIT :chunk
    """

    per_date: Counter = Counter()
    roots_for_date: Dict[date, Counter] = defaultdict(Counter)
    how: Counter = Counter()
    undated: Counter = Counter()
    total = 0
    cursor = 0

    print("Reading paths from the database (this consults stored_path only, never created_at)...")
    async with AsyncSessionLocal() as db:
        while True:
            rows = (await db.execute(
                text(sql), {**params, "cursor": cursor, "chunk": args.chunk}
            )).all()
            if not rows:
                break
            for af_id, path in rows:
                cursor = af_id
                total += 1
                d, source = extract_date(path or "")
                how[source.split(":")[0]] += 1
                if d is None:
                    undated[source] += 1
                    continue
                per_date[d] += 1
                m = _MONTH_ONLY.search(path) or _DAY_FOLDER.search(path)
                if m:
                    roots_for_date[d][path[: m.start()].rsplit("/", 1)[-1] or "?"] += 1
            print(f"  ... {total:,} path(s) read", flush=True)

    scope = args.type or "all types"
    if args.partner_id is not None:
        scope += f", partner {args.partner_id}"
    print(f"\nRead {total:,} Master path(s) from the database ({scope}).\n")

    if total == 0:
        print("Nothing matched. Widen the filters, or check that tracks.type is what you expect.")
        return 1
    if not per_date:
        print("No dated paths found. Sample of what was read, to check the layout:")
        return 1

    newest = max(per_date)
    print(f"HIGH-WATER MARK: {newest.isoformat()}  ({per_date[newest]:,} track(s) that day)")
    print(f"Start the next scan from the day AFTER this.\n")

    print(f"{args.top} most recent date(s) present in the database:")
    for d in sorted(per_date, reverse=True)[: args.top]:
        print(f"  {d.isoformat()}   {per_date[d]:>7,} track(s)")
        if args.show_roots:
            for root, n in roots_for_date[d].most_common():
                print(f"      {n:>7,}  {root}")

    print("\nHow the dates were read:")
    for source, n in how.most_common():
        print(f"  {source:<12} {n:>9,}")

    if undated:
        print(f"\n{sum(undated.values()):,} path(s) carried no day, only a month. NOT guessed at, "
              f"since inventing a day would move the resume point:")
        for source, n in undated.most_common(5):
            print(f"  {source:<22} {n:>9,}")
        months = sorted(s.split(':', 1)[1] for s in undated if s.startswith("month-only:"))
        if months:
            # Sort by year then month so 01-2026 beats 10-2025.
            months.sort(key=lambda mm: (mm.split('-')[1], mm.split('-')[0]))
            print(f"  latest month seen this way: {months[-1]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
