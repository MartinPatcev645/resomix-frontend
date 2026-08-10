"""
Apple Music export — telling the truth about what landed
========================================================

Three numbers were being conflated, and the user was shown the wrong one:

* ``matched``        — Apple catalogue ids we resolved
* ``tracks_added``   — batches Apple's add endpoint accepted (204, no body, nothing to confirm)
* ``verified_tracks``— what Apple says the playlist actually holds, read back afterwards

The old success message quoted ``matched`` alone, so an export where every add failed still read
*"Successfully transferred — 40 tracks matched"*. That is how a broken export looked fine and
nobody knew to investigate.

Two properties matter most here, and both are about NOT lying:

* **``None`` is not zero.** A verification read that fails means "we don't know"; reporting it as 0
  would turn a healthy export into a reported failure.
* **Apple is eventually consistent.** A just-created playlist can read back empty for a few
  seconds, so a single immediate read would report 0 for a perfectly good export.

No network: the HTTP layer is stubbed.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from app.services.apple_music_transfer_service import AppleMusicTransferService


def _response(status=200, body=None):
    r = MagicMock()
    r.status_code = status
    r.ok = 200 <= status < 300
    r.json.return_value = body if body is not None else {}
    r.text = json.dumps(body or {})
    return r


def _with_responses(*responses):
    """Patch the module's HTTP helper to return each response in turn."""
    it = iter(responses)
    return patch(
        "app.services.apple_music_transfer_service._http_request",
        side_effect=lambda *a, **kw: next(it),
    )


@pytest.fixture(autouse=True)
def _no_backoff_sleeps():
    """Run the back-off logic without waiting for it.

    The retry schedule is 0/2/5 seconds, so a faithful test file took 18 seconds — enough that
    someone eventually stops running it. The DELAYS are not what is being tested; the branching
    around them is.
    """
    async def _instant(_seconds):
        return None

    with patch("app.services.apple_music_transfer_service.asyncio.sleep", _instant):
        yield


# --------------------------------------------------------------------------- #
# Verification
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_a_healthy_playlist_reports_what_apple_holds() -> None:
    with _with_responses(_response(200, {"meta": {"total": 12}})):
        n = await AppleMusicTransferService()._verify_playlist("dev", "usr", "p.1", expected=12)

    assert n == 12


@pytest.mark.asyncio
async def test_an_unreadable_playlist_reports_none_not_zero() -> None:
    """"We could not check" and "it is empty" call for completely different messages. Folding the
    first into the second would report a working export as a failure."""
    with _with_responses(_response(500, {})):
        n = await AppleMusicTransferService()._verify_playlist("dev", "usr", "p.1", expected=5)

    assert n is None


@pytest.mark.asyncio
async def test_a_genuinely_empty_playlist_reports_zero() -> None:
    """The case worth catching: the playlist exists, and nothing is in it."""
    with _with_responses(
        _response(200, {"meta": {"total": 0}}),
        _response(200, {"meta": {"total": 0}}),
        _response(200, {"meta": {"total": 0}}),
    ):
        n = await AppleMusicTransferService()._verify_playlist("dev", "usr", "p.1", expected=5)

    assert n == 0


@pytest.mark.asyncio
async def test_it_retries_while_apple_catches_up() -> None:
    """Reading a just-created playlist can return no tracks; they appear seconds later. A single
    immediate read would report 0 for a perfectly good export."""
    with _with_responses(
        _response(200, {"meta": {"total": 0}}),   # too early
        _response(200, {"meta": {"total": 9}}),   # caught up
    ):
        n = await AppleMusicTransferService()._verify_playlist("dev", "usr", "p.1", expected=9)

    assert n == 9


@pytest.mark.asyncio
async def test_a_404_is_treated_as_propagation_not_absence() -> None:
    """Apple can 404 a playlist it created moments earlier. Reporting that as "gone" would be the
    same mistake the old code made in the other direction."""
    with _with_responses(
        _response(404, {}),
        _response(200, {"meta": {"total": 3}}),
    ):
        n = await AppleMusicTransferService()._verify_playlist("dev", "usr", "p.1", expected=3)

    assert n == 3


@pytest.mark.asyncio
async def test_it_stops_early_once_the_count_is_reached() -> None:
    """The back-off is for the slow case. A healthy export must not pay 7 seconds for it."""
    calls = []

    def _record(*a, **kw):
        calls.append(kw.get("params"))
        return _response(200, {"meta": {"total": 4}})

    with patch("app.services.apple_music_transfer_service._http_request", side_effect=_record):
        n = await AppleMusicTransferService()._verify_playlist("dev", "usr", "p.1", expected=4)

    assert n == 4
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_a_partial_add_is_reported_honestly() -> None:
    """Apple accepted 10 and kept 6 — almost always a storefront mismatch, and the only place it
    becomes visible is this number."""
    with _with_responses(
        _response(200, {"meta": {"total": 6}}),
        _response(200, {"meta": {"total": 6}}),
        _response(200, {"meta": {"total": 6}}),
    ):
        n = await AppleMusicTransferService()._verify_playlist("dev", "usr", "p.1", expected=10)

    assert n == 6


@pytest.mark.asyncio
async def test_verification_never_raises_into_the_export() -> None:
    """The export already succeeded by this point. A failed check must not turn it into an error."""
    with patch(
        "app.services.apple_music_transfer_service._http_request",
        side_effect=RuntimeError("connection reset"),
    ):
        n = await AppleMusicTransferService()._verify_playlist("dev", "usr", "p.1", expected=5)

    assert n is None


# --------------------------------------------------------------------------- #
# The create POST must not be retried
# --------------------------------------------------------------------------- #

def test_a_create_does_not_replay_a_5xx() -> None:
    """Apple's create endpoint is known to return 504 having created the playlist anyway. Retrying
    leaves two or three playlists in someone's library — and we then report failure, because the
    last response we saw was the 504.
    """
    from app.services.apple_music_transfer_service import _http_request

    calls = []

    def _fake(method, url, **kw):
        calls.append(method)
        return _response(504, {})

    with patch("app.services.apple_music_transfer_service.requests.request", side_effect=_fake):
        _http_request("POST", "https://x", headers={}, retry_5xx=False)

    assert len(calls) == 1, "the create POST was replayed after a 504"


def test_reads_still_retry_a_5xx() -> None:
    """The guard is scoped to writes. Making every request single-shot would trade one problem for
    a flakier one."""
    from app.services.apple_music_transfer_service import _http_request

    calls = []

    def _fake(method, url, **kw):
        calls.append(method)
        return _response(503, {})

    with patch("app.services.apple_music_transfer_service.requests.request", side_effect=_fake), \
         patch("app.services.apple_music_transfer_service.time.sleep"):
        _http_request("GET", "https://x", headers={})

    assert len(calls) == 3


def test_a_429_is_still_retried_even_on_a_create() -> None:
    """A rate-limit rejection means the request was never processed, so replaying it cannot
    duplicate anything — the hazard is 5xx, not 429."""
    from app.services.apple_music_transfer_service import _http_request

    calls = []

    def _fake(method, url, **kw):
        calls.append(method)
        return _response(429, {})

    with patch("app.services.apple_music_transfer_service.requests.request", side_effect=_fake), \
         patch("app.services.apple_music_transfer_service.time.sleep"):
        _http_request("POST", "https://x", headers={}, retry_5xx=False)

    assert len(calls) == 3
