"""
Remove the stress-test accounts and everything they own
=======================================================

WHY THIS IS NOT "DELETE FROM users"

Three findings from the schema make the naive version wrong, and they are the whole reason this
script exists:

1. **20 of the 39 user foreign keys are ``ON DELETE SET NULL``** — including ``playlists.user_id``
   and ``tracks.user_id``. Deleting a stress user does not remove their playlists or their uploads;
   it hands them to nobody. You are left with ownerless rows in the live catalogue, which is worse
   than what you started with because now nothing identifies them as test data.

2. **3 are ``ON DELETE RESTRICT``** (``admin_operation_logs.admin_user_id``, ``orders.user_id``,
   ``user_messages.admin_user_id``). The delete simply fails until they are dealt with.

3. **17 are ``ON DELETE CASCADE``** and need no help at all. Deleting those rows by hand first is
   wasted work and extra risk.

THE RULE THIS SCRIPT WILL NOT BREAK

**It never sets ``FOREIGN_KEY_CHECKS = 0``.** That is precisely how the ~13,000 orphans in the dev
database were created — ``tests/conftest.py`` disables checks so it can delete in any order, and
the children stay behind pointing at parents that are gone. A cleanup that leaves orphans is not a
cleanup. If a delete here is refused, that refusal is information: something references the row and
this script has not accounted for it. It stops and says so rather than forcing it through.

The FK graph is read from ``information_schema`` at run time rather than hard-coded, so a table
added next month is covered without anyone remembering to edit this file.

Usage
-----
    python scripts/purge_stress_accounts.py                  # DRY RUN — inventory only
    python scripts/purge_stress_accounts.py --apply          # actually delete
    python scripts/purge_stress_accounts.py --verify         # orphan check only, deletes nothing

Safety
------
* Dry run is the default. You have to ask for the delete.
* Accounts are selected ONLY by the ``stress_test_user_`` username prefix — the same guard
  ``reset_stress_quota.py`` uses. Nothing outside that query is ever touched, and the script
  refuses to run if the pattern would match an implausible number of accounts.
* Every phase re-verifies. The final step is an orphan sweep over the tables it touched; a
  non-zero result fails the run loudly instead of reporting success.
* **Catalogue tracks are never deleted.** Only rows with ``type = 'upload'`` — what the stress run
  itself pushed through the upload endpoint. A catalogue row carrying a stress account's
  ``user_id`` (which happens) is reported and left alone.

WHAT IT DOES NOT DO

Media-server assets. Deleting the ``tracks`` row leaves the audio, peaks, segments and embeddings
on the box; the app's own delete path dispatches ``purge_uploaded_track_assets`` for that, and raw
SQL cannot. The uuids are written to ``scripts/purged_stress_upload_uuids.txt`` before the delete
so that can be done separately — after the row is gone, the uuid needed to find the file is gone
too.
"""

import argparse
import asyncio
import os
import sys
from typing import Any, Dict, List, Sequence

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from database.connection import AsyncSessionLocal  # noqa: E402

# The ONLY accounts this script may touch. Must match `USER_PREFIX` in the stress suite's
# config.py and `USERNAME_PREFIX` in reset_stress_quota.py.
USERNAME_PREFIX = "stress_test_user_"

# A blunt tripwire. The suite runs ten accounts; matching far more than that means the pattern has
# been reused for something else, and this script must not be the thing that finds out the hard way.
MAX_EXPECTED_ACCOUNTS = 50

# Content the user OWNS but which survives their deletion, because the FK is SET NULL. These are
# deleted explicitly, parents last, and each one's own children go by CASCADE.
#
# Order matters: playlists reference tracks as `seed_track_id` (SET NULL), so removing playlists
# first keeps that column from being nulled on a track that is about to be deleted anyway.
# The `extra` clause on tracks is a HARD SAFETY GUARD, not a refinement.
#
# `user_id` alone does not mean "this account uploaded it". Catalogue rows are inserted by
# `ingestion_persist`, which never sets `user_id` — but the dev database still contains one
# `electrobuzz` row that has one, so the invariant does NOT hold in practice. Without
# `type = 'upload'` this script would delete a catalogue track the moment any such row pointed at a
# stress account, and a catalogue track is not something a stress run created.
#
# Deleting only what the stress run itself produced is the whole requirement. Anything ambiguous
# stays.
OWNED_CONTENT: Sequence[tuple] = (
    ("playlists", "user_id", "", "playlists (cascades playlist_tracks, ratings, engagements)"),
    ("tracks", "user_id", "AND type = 'upload'",
     "tracks THEY UPLOADED (cascades audio_files, ratings, artifact status, analysis)"),
)

# Rows that BLOCK the delete (RESTRICT). Audit trails, so they are removed rather than reassigned —
# a stress account's admin log is not evidence of anything.
BLOCKING: Sequence[tuple] = (
    ("admin_operation_logs", "admin_user_id", "admin operation log entries"),
    ("orders", "user_id", "orders"),
    ("user_messages", "admin_user_id", "messages sent AS this user"),
    ("user_messages", "user_id", "messages sent TO this user"),
)

# Polymorphic references — `subject_type` + `subject_id`, no foreign key, so nothing cascades and
# nothing complains. They would be left behind silently by any FK-driven cleanup.
POLYMORPHIC: Sequence[tuple] = (
    ("entitlement_overrides", "subject_type", "subject_id", "entitlement overrides"),
    ("usage_period_history", "subject_type", "subject_id", "usage period history"),
)


async def _user_ids(db) -> List[int]:
    rows = await db.execute(
        text("SELECT id FROM users WHERE username LIKE :pat ORDER BY id"),
        {"pat": f"{USERNAME_PREFIX}%"},
    )
    return [r[0] for r in rows.fetchall()]


async def _count(db, sql: str, params: Dict[str, Any]) -> int:
    return int(await db.scalar(text(sql), params) or 0)


async def _schema_facts(db) -> Dict[str, List[str]]:
    """``{delete_rule: [table.column, ...]}`` for every FK pointing at ``users``.

    Read live rather than trusted from this file's comments: the numbers in the docstring were true
    when it was written, and the point of deriving them is that they stay true.
    """
    rows = await db.execute(text(
        """
        SELECT r.DELETE_RULE, k.TABLE_NAME, k.COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE k
        JOIN information_schema.REFERENTIAL_CONSTRAINTS r
          ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
        WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME = 'users'
        """
    ))
    out: Dict[str, List[str]] = {}
    for rule, table, column in rows.fetchall():
        out.setdefault(rule, []).append(f"{table}.{column}")
    return out


async def inventory(db, ids: List[int]) -> Dict[str, int]:
    """What these accounts own, before anything is removed."""
    p = {"ids": tuple(ids)}
    found: Dict[str, int] = {}

    for table, column, extra, label in OWNED_CONTENT:
        found[label] = await _count(
            db, f"SELECT COUNT(*) FROM {table} WHERE {column} IN :ids {extra}", p)

    # Second-level rows, counted so the report shows the real blast radius rather than just the
    # two parent numbers. They are removed by CASCADE, not by this script.
    # Membership rows — "track X is in playlist Y". Removing one does NOT remove the track; the
    # cascade runs from playlists to playlist_tracks and stops there.
    found["  ↳ playlist_tracks (membership rows, NOT tracks)"] = await _count(
        db, "SELECT COUNT(*) FROM playlist_tracks pt JOIN playlists pl ON pl.id = pt.playlist_id "
            "WHERE pl.user_id IN :ids", p)
    found["  ↳ audio_files"] = await _count(
        db, "SELECT COUNT(*) FROM audio_files a JOIN tracks t ON t.id = a.track_id "
            "WHERE t.user_id IN :ids AND t.type = 'upload'", p)
    found["  ↳ track_analysis_results"] = await _count(
        db, "SELECT COUNT(*) FROM track_analysis_results r JOIN tracks t ON t.id = r.track_id "
            "WHERE t.user_id IN :ids AND t.type = 'upload'", p)

    for table, column, label in BLOCKING:
        found[label] = await _count(db, f"SELECT COUNT(*) FROM {table} WHERE {column} IN :ids", p)

    for table, type_col, id_col, label in POLYMORPHIC:
        found[label] = await _count(
            db,
            f"SELECT COUNT(*) FROM {table} WHERE {type_col} = 'user' AND {id_col} IN :ids", p)

    found["the accounts themselves"] = len(ids)
    return found


async def catalogue_check(db, ids: List[int]) -> List[str]:
    """Anything pointing at these accounts that is NOT theirs to delete.

    Catalogue tracks are the product. If one carries a stress account's `user_id` — which happens;
    see OWNED_CONTENT — it is reported here and deliberately left alone. The report exists so that
    is a visible decision rather than a silent one.
    """
    p = {"ids": tuple(ids)}
    rows = await db.execute(text(
        "SELECT type, COUNT(*) FROM tracks WHERE user_id IN :ids AND type <> 'upload' "
        "GROUP BY type"), p)
    return [f"{n} '{ttype}' catalogue track(s) reference a stress account — NOT deleted, left as-is"
            for ttype, n in rows.fetchall()]


async def upload_uuids(db, ids: List[int]) -> List[str]:
    """The uuids of the uploads about to be deleted, captured BEFORE the delete.

    Deleting the `tracks` row does not remove the audio from the media server. The app's own delete
    path dispatches `purge_uploaded_track_assets` for that; this script writes raw SQL, so it does
    not — and once the row is gone the uuid needed to find the file is gone with it.

    Written to a file so the assets can be cleaned separately, at a time of your choosing. Firing
    a few hundred Celery tasks from a cleanup script is not something that should happen as a side
    effect of a database tidy-up.
    """
    rows = await db.execute(text(
        "SELECT uuid FROM tracks WHERE user_id IN :ids AND type = 'upload' ORDER BY id"),
        {"ids": tuple(ids)})
    return [r[0] for r in rows.fetchall()]


async def purge(db, ids: List[int]) -> Dict[str, int]:
    """Delete, children first, with foreign key checks ON throughout.

    Each statement is committed as it succeeds. A failure part-way therefore leaves a smaller mess
    than it found rather than rolling back to the full one, and re-running finishes the job — every
    delete here is idempotent because it is scoped to ids that will no longer match.
    """
    p = {"ids": tuple(ids)}
    removed: Dict[str, int] = {}

    async def _delete(sql: str, label: str) -> None:
        result = await db.execute(text(sql), p)
        await db.commit()
        removed[label] = result.rowcount or 0

    # 1. Rows that would otherwise REFUSE the user delete.
    for table, column, label in BLOCKING:
        await _delete(f"DELETE FROM {table} WHERE {column} IN :ids", label)

    # 2. Rows with no foreign key at all, which nothing would ever complain about.
    for table, type_col, id_col, label in POLYMORPHIC:
        await _delete(
            f"DELETE FROM {table} WHERE {type_col} = 'user' AND {id_col} IN :ids", label)

    # 3. Owned content — the SET NULL trap. Without this the rows survive as ownerless.
    for table, column, extra, label in OWNED_CONTENT:
        await _delete(f"DELETE FROM {table} WHERE {column} IN :ids {extra}", label)

    # 4. The accounts. The 17 CASCADE relationships are the database's job, not ours.
    await _delete("DELETE FROM users WHERE id IN :ids", "the accounts themselves")
    return removed


async def verify(db, ids: List[int]) -> List[str]:
    """Anything left pointing at these ids. Empty is the only acceptable answer."""
    p = {"ids": tuple(ids)}
    problems: List[str] = []

    rows = await db.execute(text(
        """
        SELECT k.TABLE_NAME, k.COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE k
        WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME = 'users'
        """
    ))
    for table, column in rows.fetchall():
        n = await _count(db, f"SELECT COUNT(*) FROM {table} WHERE {column} IN :ids", p)
        if n:
            problems.append(f"{table}.{column}: {n} row(s) still reference a purged account")

    for table, type_col, id_col, label in POLYMORPHIC:
        n = await _count(
            db, f"SELECT COUNT(*) FROM {table} WHERE {type_col} = 'user' AND {id_col} IN :ids", p)
        if n:
            problems.append(f"{table}.{id_col}: {n} polymorphic row(s) left behind")

    still = await _count(db, "SELECT COUNT(*) FROM users WHERE id IN :ids", p)
    if still:
        problems.append(f"users: {still} account(s) still present")
    return problems


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="actually delete (default is a dry run)")
    ap.add_argument("--verify", action="store_true", help="orphan check only; deletes nothing")
    args = ap.parse_args()

    async with AsyncSessionLocal() as db:
        ids = await _user_ids(db)
        if not ids:
            print(f"No accounts match '{USERNAME_PREFIX}%'. Nothing to do.")
            return 0
        if len(ids) > MAX_EXPECTED_ACCOUNTS:
            print(f"REFUSING: {len(ids)} accounts match '{USERNAME_PREFIX}%', expected at most "
                  f"{MAX_EXPECTED_ACCOUNTS}. Check the prefix before running this.")
            return 2

        print(f"Accounts matching '{USERNAME_PREFIX}%': {len(ids)}  (ids {ids[0]}–{ids[-1]})\n")

        facts = await _schema_facts(db)
        print("Foreign keys pointing at `users`, by delete rule:")
        for rule in sorted(facts):
            note = {
                "CASCADE": "handled by the database",
                "SET NULL": "SURVIVES the delete — owned content must be removed explicitly",
                "RESTRICT": "BLOCKS the delete — removed first",
            }.get(rule, "")
            print(f"  {rule:9} {len(facts[rule]):2}  {note}")
        print()

        if args.verify:
            problems = await verify(db, ids)
            print("\n".join(problems) if problems else "Clean: nothing references these accounts.")
            return 1 if problems else 0

        counts = await inventory(db, ids)
        skipped = await catalogue_check(db, ids)
        width = max(len(k) for k in counts)
        print("Owned by these accounts:")
        for label, n in counts.items():
            print(f"  {label.ljust(width)}  {n}")
        if skipped:
            print("\nSKIPPED — not created by the stress run, so not this script's to remove:")
            for line in skipped:
                print(f"  ! {line}")
        print()

        if not args.apply:
            print("DRY RUN — nothing deleted. Re-run with --apply to remove the above.")
            return 0

        uuids = await upload_uuids(db, ids)
        if uuids:
            out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "purged_stress_upload_uuids.txt")
            with open(out, "w") as fh:
                fh.write("\n".join(uuids) + "\n")
            print(f"Wrote {len(uuids)} upload uuid(s) to {out}")
            print("  Their MEDIA-SERVER assets are NOT removed by this script — the audio, peaks,")
            print("  segments and embeddings stay until purged separately using these uuids.\n")

        print("Deleting (foreign key checks stay ON — a refusal here is information, not an "
              "obstacle)...\n")
        removed = await purge(db, ids)
        for label, n in removed.items():
            print(f"  removed {n:6}  {label}")

        problems = await verify(db, ids)
        if problems:
            print("\nINCOMPLETE — something still references these accounts:")
            print("\n".join(f"  {p}" for p in problems))
            return 1
        print("\nVerified: nothing references these accounts. No orphans created.")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
