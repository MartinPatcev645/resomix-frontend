"""Seed reference used in an exported Apple Music playlist's description (and as its name only when
the Resomix playlist has none; normally the export keeps the playlist's own name).

An upload-seeded playlist once exported as `Resomix Sonic Match Found, for "Unknown Artist - Totemo"`
while the playlist page itself showed the artist correctly. The export consulted Apple's metadata
and then `tracks.display_artist` only — but an UPLOAD carries its artist in `track_contributors`,
which is what the playlist view reads. `display_artist` is typically empty for uploads, so the
export fell through to "Unknown Artist".

Pure resolution logic with stubbed repositories: no database, so this is safe to run at any time.
"""
import asyncio
from types import SimpleNamespace

import pytest

from app.services.apple_music_transfer_service import AppleMusicTransferService


class _AppleRepo:
    def __init__(self, match=None):
        self._match = match

    async def async_get_by_track_ids(self, _db, track_ids):
        return {track_ids[0]: self._match} if self._match else {}


class _TrackRepo:
    def __init__(self, track=None, contributors=None):
        self._track = track
        self._contributors = contributors or []

    async def async_get_by_id(self, _db, _track_id):
        return self._track

    async def async_get_track_artists(self, _db, _track_id):
        return self._contributors


def _service(apple_match=None, track=None, contributors=None):
    svc = AppleMusicTransferService.__new__(AppleMusicTransferService)
    svc.apple_music_repository = _AppleRepo(apple_match)
    svc.track_repository = _TrackRepo(track, contributors)
    return svc


def _resolve(svc, seed_id=1):
    # `asyncio.run`, not `get_event_loop().run_until_complete`: the latter relies on an implicit
    # loop that no longer exists once any earlier test in the session has used `asyncio.run`
    # (which closes its loop and clears the current one). That made these tests pass alone and
    # fail in a full run, purely on collection order.
    return asyncio.run(svc._resolve_seed_reference(None, seed_id))


def test_upload_seed_uses_contributors_when_display_artist_is_empty():
    """The reported bug: artist lives only in contributors."""
    svc = _service(
        track=SimpleNamespace(title="Totemo", display_artist=None),
        contributors=[SimpleNamespace(full_name="Foodman")],
    )
    assert _resolve(svc) == ("Totemo", "Foodman")


def test_apple_metadata_wins_for_a_catalogue_seed():
    """Apple is authoritative when it has a match, so the export matches what Apple shows."""
    svc = _service(
        apple_match={"name": "Quod Libet", "artist": "Max Abysmal"},
        track=SimpleNamespace(title="stale title", display_artist="stale artist"),
        contributors=[SimpleNamespace(full_name="ignored")],
    )
    assert _resolve(svc) == ("Quod Libet", "Max Abysmal")


def test_display_artist_still_used_when_there_are_no_contributors():
    svc = _service(
        track=SimpleNamespace(title="Totemo", display_artist="Foodman"),
        contributors=[],
    )
    assert _resolve(svc) == ("Totemo", "Foodman")


def test_multiple_contributors_are_joined():
    svc = _service(
        track=SimpleNamespace(title="Scattered Cipher", display_artist=None),
        contributors=[SimpleNamespace(full_name="Ben Shirken"), SimpleNamespace(full_name="Ex Wiish")],
    )
    assert _resolve(svc) == ("Scattered Cipher", "Ben Shirken, Ex Wiish")


def test_blank_contributor_names_are_ignored():
    svc = _service(
        track=SimpleNamespace(title="Totemo", display_artist=None),
        contributors=[SimpleNamespace(full_name="   "), SimpleNamespace(full_name="Foodman")],
    )
    assert _resolve(svc) == ("Totemo", "Foodman")


def test_falls_back_to_unknown_when_nothing_resolves():
    """Naming must never raise — an unnamed export is better than a failed one."""
    svc = _service(track=None, contributors=[])
    assert _resolve(svc) == ("Unknown Track", "Unknown Artist")


def test_no_seed_track_at_all():
    svc = _service()
    assert _resolve(svc, seed_id=None) == ("Unknown Track", "Unknown Artist")


def test_contributor_lookup_failure_does_not_break_the_export():
    class _Boom(_TrackRepo):
        async def async_get_track_artists(self, _db, _track_id):
            raise RuntimeError("db down")

    svc = AppleMusicTransferService.__new__(AppleMusicTransferService)
    svc.apple_music_repository = _AppleRepo()
    svc.track_repository = _Boom(SimpleNamespace(title="Totemo", display_artist=None))
    assert _resolve(svc) == ("Totemo", "Unknown Artist")


@pytest.mark.parametrize("artist,title", [("Foodman", "Totemo")])
def test_reference_string_shape(artist, title):
    """The exported name is f'{artist} - {title}' — the format the user sees on Apple Music."""
    svc = _service(track=SimpleNamespace(title=title, display_artist=None),
                   contributors=[SimpleNamespace(full_name=artist)])
    t, a = _resolve(svc)
    assert f"{a} - {t}" == "Foodman - Totemo"
