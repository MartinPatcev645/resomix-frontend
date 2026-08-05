"""
Repeat-search idempotency lookup (pricing v2.1)
===============================================

Asking for the same catalogue reference twice in one day must return the playlist already built
rather than charge a second search credit — the engine is deterministic for a given seed, so the
second result would be identical and charging for it charges for value already delivered.

The dangerous failure here is not "we charged twice". It is **handing one caller's playlist to
another**, which would leak a private playlist. So the query is asserted at the SQL level: whatever
else changes, the owner predicate and the soft-delete filter must survive.

Pure unit tests — the statement is inspected, never executed.
"""

from datetime import datetime

import pytest

from app.models.constants import PlaylistType
from app.repositories.playlist_repository import PlaylistRepository


class _CapturingSession:
    """Stands in for AsyncSession: records the statement instead of running it."""

    def __init__(self):
        self.statement = None

    async def execute(self, statement):
        self.statement = statement

        class _Result:
            @staticmethod
            def scalar_one_or_none():
                return None

        return _Result()


def _sql(statement) -> str:
    return str(statement.compile(compile_kwargs={"literal_binds": True}))


SINCE = datetime(2026, 8, 5, 0, 0, 0)


@pytest.mark.asyncio
class TestOwnerScoping:
    async def test_user_lookup_is_scoped_to_that_user(self):
        db = _CapturingSession()
        await PlaylistRepository().find_same_day_similarity(
            db, seed_track_id=99, since=SINCE, user_id=7
        )
        assert "playlists.user_id = 7" in _sql(db.statement)

    async def test_guest_lookup_requires_both_null_user_and_the_visitor_id(self):
        """A guest playlist has `user_id IS NULL`. Matching on visitor_id alone would be enough
        today, but pairing them means a future row with both set can never be mismatched."""
        db = _CapturingSession()
        await PlaylistRepository().find_same_day_similarity(
            db, seed_track_id=99, since=SINCE, guest_visitor_id="visitor-abc"
        )
        sql = _sql(db.statement)
        assert "playlists.user_id IS NULL" in sql
        assert "visitor-abc" in sql

    async def test_no_identity_returns_none_without_querying(self):
        """No subject means nothing to match against — returning a playlist here would be
        returning a stranger's."""
        db = _CapturingSession()
        result = await PlaylistRepository().find_same_day_similarity(
            db, seed_track_id=99, since=SINCE
        )
        assert result is None
        assert db.statement is None, "must not reach the database at all"


@pytest.mark.asyncio
class TestFilters:
    async def test_matches_the_seed_track(self):
        db = _CapturingSession()
        await PlaylistRepository().find_same_day_similarity(
            db, seed_track_id=1234, since=SINCE, user_id=7
        )
        assert "seed_track_id = 1234" in _sql(db.statement)

    async def test_excludes_soft_deleted_playlists(self):
        """Otherwise deleting a playlist and re-searching would return the deleted one and the
        user would never get their playlist back — while still not being charged."""
        db = _CapturingSession()
        await PlaylistRepository().find_same_day_similarity(
            db, seed_track_id=99, since=SINCE, user_id=7
        )
        assert "deleted_at IS NULL" in _sql(db.statement)

    async def test_only_similarity_playlists(self):
        """A hand-made 'custom' playlist that happens to carry a seed must never be handed back
        as though the engine had produced it."""
        db = _CapturingSession()
        await PlaylistRepository().find_same_day_similarity(
            db, seed_track_id=99, since=SINCE, user_id=7
        )
        assert f"'{PlaylistType.SIMILARITY}'" in _sql(db.statement)

    async def test_bounded_by_the_period_start(self):
        """`since` is the current window's start, so yesterday's playlist does not suppress
        today's charge."""
        db = _CapturingSession()
        await PlaylistRepository().find_same_day_similarity(
            db, seed_track_id=99, since=SINCE, user_id=7
        )
        assert "created_at >= " in _sql(db.statement)

    async def test_returns_the_newest_match(self):
        """If a race created two, hand back the one the caller most likely has open."""
        db = _CapturingSession()
        await PlaylistRepository().find_same_day_similarity(
            db, seed_track_id=99, since=SINCE, user_id=7
        )
        sql = _sql(db.statement).lower()
        assert "order by" in sql and "desc" in sql
        assert "limit 1" in sql
