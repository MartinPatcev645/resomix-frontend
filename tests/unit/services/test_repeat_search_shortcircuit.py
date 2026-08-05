"""
Repeat-search short-circuit (pricing v2.1, B2)
==============================================

Re-running the same catalogue reference within 24 hours returns the playlist already built instead
of calling the similarity engine again. The engine is deterministic for a given seed, so a second
run produces the same playlist while costing a computation, a search credit, and — now that the
Library is capped at 5 — another of the user's visible slots on a duplicate.

Two properties are load-bearing:

  * **logged-in only.** A guest is identified by a device hash they can clear, so "same owner" is
    not a claim we can stand behind for them. A guest creating a duplicate is a wasted computation;
    a guest being handed someone else's playlist is a data leak. We take the former.
  * **it never fails the request.** This is an optimisation. If the lookup or the mapper fails, the
    request must fall through to a normal computation, not error.

Pure unit tests — the controller's helper is exercised with fakes, no DB and no engine.
"""

from datetime import timedelta

import pytest

from app.controllers.similarity_controller import SimilarityController


class _FakeTrackRepo:
    def __init__(self, track_id=None, raises=False):
        self._track_id = track_id
        self._raises = raises

    async def async_get_id_by_uuid(self, db, uuid):
        if self._raises:
            raise RuntimeError("track lookup exploded")
        return self._track_id


class _RecordingPlaylistRepo:
    def __init__(self, found=None):
        self.calls = []
        self._found = found

    async def find_same_day_similarity(self, db, **kw):
        self.calls.append(kw)
        return self._found


class _FakeUser:
    id = 7


def _controller(*, track_id=42, found=None, track_raises=False):
    c = SimilarityController()
    c.similarity_service.track_repository = _FakeTrackRepo(track_id, raises=track_raises)
    c.playlist_service.playlist_repository = _RecordingPlaylistRepo(found)
    return c


@pytest.mark.asyncio
class TestLookupScoping:
    async def test_scopes_the_lookup_to_the_logged_in_user(self):
        c = _controller()
        await c._find_repeat_playlist(None, "track-uuid", _FakeUser())
        assert c.playlist_service.playlist_repository.calls[0]["user_id"] == 7

    async def test_never_passes_a_guest_visitor_id(self):
        """The guest branch is excluded upstream; the helper must not open a back door to it."""
        c = _controller()
        await c._find_repeat_playlist(None, "track-uuid", _FakeUser())
        assert "guest_visitor_id" not in c.playlist_service.playlist_repository.calls[0]

    async def test_uses_the_resolved_seed_track_id(self):
        c = _controller(track_id=1234)
        await c._find_repeat_playlist(None, "track-uuid", _FakeUser())
        assert c.playlist_service.playlist_repository.calls[0]["seed_track_id"] == 1234


@pytest.mark.asyncio
class TestWindow:
    async def test_window_is_a_rolling_24_hours(self):
        """Deliberately not the meter's calendar day: searching at 23:50 and again at 00:10 is the
        same person repeating themselves, and charging twice for it is not defensible."""
        assert SimilarityController.REPEAT_SEARCH_WINDOW == timedelta(hours=24)

    async def test_lookup_is_bounded_by_that_window(self):
        from datetime import datetime

        c = _controller()
        before = datetime.utcnow()
        await c._find_repeat_playlist(None, "track-uuid", _FakeUser())
        since = c.playlist_service.playlist_repository.calls[0]["since"]
        # ~24h back, allowing for the moment that elapsed during the call.
        assert timedelta(hours=23, minutes=59) < (before - since) < timedelta(hours=24, minutes=1)


@pytest.mark.asyncio
class TestNeverBreaksTheRequest:
    async def test_unknown_track_uuid_returns_none(self):
        """An unresolvable seed is not an error here — it just means nothing to reuse."""
        c = _controller(track_id=None)
        assert await c._find_repeat_playlist(None, "nope", _FakeUser()) is None

    async def test_unknown_track_does_not_query_for_a_playlist(self):
        c = _controller(track_id=None)
        await c._find_repeat_playlist(None, "nope", _FakeUser())
        assert c.playlist_service.playlist_repository.calls == []

    async def test_a_raising_lookup_is_swallowed(self):
        """A broken optimisation must degrade to 'compute it again', never to a 500."""
        c = _controller(track_raises=True)
        assert await c._find_repeat_playlist(None, "track-uuid", _FakeUser()) is None

    async def test_no_match_returns_none(self):
        c = _controller(found=None)
        assert await c._find_repeat_playlist(None, "track-uuid", _FakeUser()) is None

    async def test_a_match_is_returned(self):
        sentinel = object()
        c = _controller(found=sentinel)
        assert await c._find_repeat_playlist(None, "track-uuid", _FakeUser()) is sentinel
