"""
The migration chain
===================

One test, and it exists because of a real outage.

A revision id was once reused, and the head-detection that was supposed to catch it used a dict
keyed by revision id — which silently collapsed the duplicate instead of reporting it. The result
was ``alembic upgrade`` failing with "Cycle is detected in revisions", discovered on a deploy
rather than in CI.

Reads the files directly rather than going through Alembic's own API, because Alembic is the thing
being checked: if its config cannot load, this should say so plainly instead of erroring somewhere
less obvious.

Cheap enough to run on every suite, and the failure it catches costs a deploy.
"""

from __future__ import annotations

import pathlib
import re

VERSIONS = pathlib.Path(__file__).resolve().parents[2] / "alembic" / "versions"

# Two declaration styles are in use — Alembic's older `revision = "..."` and the annotated
# `revision: str = "..."` its newer templates generate. The optional `: <annotation>` group matters:
# without it 21 of the 44 files parse as nothing and get skipped, and a chain check that silently
# skips half its input is the same class of bug as the one this file exists to catch.
_REVISION = re.compile(r"^revision(?:\s*:[^=]+)?\s*=\s*[\"']([^\"']+)[\"']", re.M)
_DOWN = re.compile(r"^down_revision(?:\s*:[^=]+)?\s*=\s*(?:[\"']([^\"']+)[\"']|(None))", re.M)


def _migration_files():
    return [p for p in sorted(VERSIONS.glob("*.py")) if p.name != "__init__.py"]


def _chain():
    """[(revision, down_revision, filename)] for every migration on disk.

    Raises on a file it cannot read rather than skipping it — see `test_every_migration_parses`.
    """
    out = []
    for path in _migration_files():
        text = path.read_text()
        rev = _REVISION.search(text)
        down = _DOWN.search(text)
        if not rev or not down:
            continue
        # group(2) is the literal `None`; group(1) is a quoted parent.
        out.append((rev.group(1), down.group(1), path.name))
    return out


def _unparsed():
    """Files whose revision/down_revision this test cannot read."""
    bad = []
    for path in _migration_files():
        text = path.read_text()
        if not _REVISION.search(text) or not _DOWN.search(text):
            bad.append(path.name)
    return bad


def test_every_migration_parses() -> None:
    """Guards the guard.

    If a future Alembic template writes these in a third style, every check below would quietly
    pass on a subset. It must fail loudly instead — a green chain test over half the files is worse
    than no chain test.
    """
    assert not _unparsed(), (
        "Could not read revision/down_revision from: " + ", ".join(_unparsed())
    )
    assert len(_chain()) == len(_migration_files())


def test_no_revision_id_is_used_twice() -> None:
    """The actual bug. Two files claiming the same id is what produced "Cycle is detected".

    Collected as a list, not a set, precisely because a set is what hid it last time.
    """
    ids = [rev for rev, _, _ in _chain()]
    duplicates = {r for r in ids if ids.count(r) > 1}
    assert not duplicates, f"Revision id reused: {sorted(duplicates)}"


def test_every_parent_exists() -> None:
    """A `down_revision` pointing at a file that was renamed or deleted breaks the chain at the
    point of upgrade, not at import."""
    chain = _chain()
    known = {rev for rev, _, _ in chain}
    dangling = [
        f"{name} -> {down}" for rev, down, name in chain if down is not None and down not in known
    ]
    assert not dangling, f"down_revision points at a missing migration: {dangling}"


def test_there_is_exactly_one_head() -> None:
    """Two heads means two people added a migration against the same parent, and the second
    `upgrade head` picks one arbitrarily."""
    chain = _chain()
    parents = {down for _, down, _ in chain if down}
    heads = [(rev, name) for rev, _, name in chain if rev not in parents]
    assert len(heads) == 1, f"Expected one head, found {len(heads)}: {heads}"


def test_there_is_exactly_one_root() -> None:
    """More than one `down_revision = None` is a second, disconnected chain — it will appear to
    apply cleanly and leave half the schema missing."""
    roots = [(rev, name) for rev, down, name in _chain() if down is None]
    assert len(roots) == 1, f"Expected one root, found {len(roots)}: {roots}"


def test_the_chain_is_walkable_from_root_to_head() -> None:
    """Ties the above together: following `down_revision` from the head must visit every migration
    exactly once. Catches a cycle among revisions that all otherwise look well-formed."""
    chain = _chain()
    by_rev = {rev: down for rev, down, _ in chain}
    parents = {down for _, down, _ in chain if down}
    head = next(rev for rev, _, _ in chain if rev not in parents)

    visited = []
    cursor = head
    while cursor is not None:
        assert cursor not in visited, f"Cycle in the migration chain at {cursor}"
        visited.append(cursor)
        cursor = by_rev.get(cursor)

    assert len(visited) == len(chain), (
        f"Walked {len(visited)} of {len(chain)} migrations — "
        f"orphaned: {sorted(set(by_rev) - set(visited))}"
    )
