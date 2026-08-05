"""
Library visibility at creation (pricing v2.1, C1)
=================================================

Free accounts list 5 playlists in the Library. Beyond that a playlist is created **hidden** — it
still exists and is fully usable by link (open, play, rename, export, share, fork); it is simply not
listed. The cap governs the listing, never creation and never access.

The decision is made ONCE at creation and stored, deliberately not derived later:

    Deleting a visible playlist frees a slot, but hidden playlists are never promoted — the next
    NEW playlist takes it.

A "first N by created_at" query cannot express that, because after the fact the ordering no longer
tells you which ones the user actually saw.

The safe default matters as much as the rule: whenever the cap cannot be resolved, the playlist is
**visible**. Hiding someone's playlist by mistake is far worse than listing one too many.
"""

import pytest

from app.repositories.playlist_repository import PlaylistRepository


class _CountingSession:
    """Returns a fixed count for the "how many are visible" query."""

    def __init__(self, visible_count=0):
        self.visible_count = visible_count
        self.queried = False

    async def execute(self, statement):
        self.queried = True
        count = self.visible_count

        class _Result:
            @staticmethod
            def scalar():
                return count

        return _Result()


async def _visible(*, user_id, cap, current=0):
    db = _CountingSession(current)
    return await PlaylistRepository()._resolve_library_visibility(db, user_id=user_id, cap=cap), db


@pytest.mark.asyncio
class TestUnderAndOverTheCap:
    async def test_under_the_cap_is_visible(self):
        visible, _ = await _visible(user_id=7, cap=5, current=4)
        assert visible is True

    async def test_at_the_cap_is_hidden(self):
        """The 6th playlist for a free user: created, usable by link, not listed."""
        visible, _ = await _visible(user_id=7, cap=5, current=5)
        assert visible is False

    async def test_over_the_cap_is_hidden(self):
        """Reachable after a downgrade — someone with 12 visible drops to a cap of 5."""
        visible, _ = await _visible(user_id=7, cap=5, current=12)
        assert visible is False

    async def test_first_ever_playlist_is_visible(self):
        visible, _ = await _visible(user_id=7, cap=5, current=0)
        assert visible is True


@pytest.mark.asyncio
class TestSentinels:
    async def test_unlimited_is_always_visible(self):
        """Pro. -1 must never be read as "cap of -1" and hide everything."""
        visible, db = await _visible(user_id=7, cap=-1, current=999)
        assert visible is True
        assert db.queried is False, "unlimited must not pay for a COUNT on every creation"

    async def test_zero_cap_hides_without_counting(self):
        """Guest: `library_playlists_max` is 0. There is no Library to list into."""
        visible, db = await _visible(user_id=7, cap=0, current=0)
        assert visible is False
        assert db.queried is False


@pytest.mark.asyncio
class TestSafeDefaults:
    async def test_unresolved_cap_defaults_to_visible(self):
        """`None` means the caller could not resolve a cap — a partner path, or an entitlement
        lookup that failed. Defaulting to hidden would silently swallow playlists."""
        visible, db = await _visible(user_id=7, cap=None, current=99)
        assert visible is True
        assert db.queried is False

    async def test_anonymous_owner_is_visible(self):
        """A guest playlist has no owner to count against; it is reached by link anyway."""
        visible, _ = await _visible(user_id=None, cap=5, current=99)
        assert visible is True


@pytest.mark.asyncio
class TestListingFilter:
    async def test_the_listing_excludes_hidden_playlists(self):
        import inspect

        src = inspect.getsource(PlaylistRepository.async_get_all_user_playlists)
        assert "Playlist.is_library_visible.is_(True)" in src

    async def test_hidden_playlists_are_not_soft_deleted(self):
        """Hiding must never be implemented by setting `deleted_at` — the owner would lose the
        playlist entirely instead of just its listing."""
        import inspect

        src = inspect.getsource(PlaylistRepository._resolve_library_visibility)
        assert "deleted_at" in src, "the COUNT must exclude soft-deleted rows"
        assert "delete" not in src.lower().replace("deleted_at", ""), "must not delete anything"
