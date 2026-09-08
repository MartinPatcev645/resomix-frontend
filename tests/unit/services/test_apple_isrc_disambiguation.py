"""
Apple Music export — an ISRC does not identify a recording
==========================================================

2026-09-08, reported from a real export. A 100-track playlist came back with position 2 as
*Ed Prosek — I Could Never* where *Cristian Vogel — Hold* should have been.

Apple's catalogue has THREE recordings carrying ISRC ``DEX181600071``:

===========  ===================================  ======
id           artist / title                       length
===========  ===================================  ======
1450300101   Ed Prosek — I Could Never (Single)     255s
1450300281   Ed Prosek — I Could Never (Truth EP)   255s
1149004988   Cristian Vogel — Hold                  425s   <- ours
===========  ===================================  ======

``filter[isrc]`` returns all three, in that order, in **both** ``us`` and ``gr``. The old code
did ``if aisrc not in out: out[aisrc] = sid`` — first result wins — so it picked Ed Prosek and
added a stranger's song to a user's library, while still reporting the export as successful.

Only non-US users were ever exposed: a user whose storefront matches the catalogue's uses the
stored id directly and never performs this lookup at all. That is why it survived until
someone exported from Greece.

The properties pinned here:

* the stored ``apple_song_id`` wins outright when Apple returns it, whatever its position;
* an ambiguous ISRC resolves to NOTHING rather than to a guess;
* a text search hit that is not the same recording is rejected;
* artists joined differently for the same recording still match.

No network: the HTTP layer is stubbed.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from app.services.apple_music_transfer_service import (
    AppleMusicTransferService,
    _artist_tokens,
    _is_same_recording,
)

ISRC = "DEX181600071"
OURS = "1149004988"
WRONG = "1450300101"

# Exactly what Apple returns for filter[isrc]=DEX181600071, in Apple's own order.
APPLE_ISRC_RESPONSE = {
    "data": [
        {"id": WRONG, "attributes": {"isrc": ISRC, "name": "I Could Never",
                                     "artistName": "Ed Prosek",
                                     "albumName": "I Could Never - Single",
                                     "durationInMillis": 255000}},
        {"id": "1450300281", "attributes": {"isrc": ISRC, "name": "I Could Never",
                                            "artistName": "Ed Prosek",
                                            "albumName": "Truth - EP",
                                            "durationInMillis": 255000}},
        {"id": OURS, "attributes": {"isrc": ISRC, "name": "Hold",
                                    "artistName": "Cristian Vogel",
                                    "albumName": "The Assistenz",
                                    "durationInMillis": 425000}},
    ]
}

EXPECTED_HOLD = {
    "apple_song_id": OURS,
    "name": "Hold",
    "artist": "Cristian Vogel",
    "duration_ms": 425000,
}


def _response(status=200, body=None):
    r = MagicMock()
    r.status_code = status
    r.ok = 200 <= status < 300
    r.json.return_value = body if body is not None else {}
    r.text = json.dumps(body or {})
    return r


@pytest.fixture
def service():
    return AppleMusicTransferService()


# --------------------------------------------------------------------------------------
# The bug itself
# --------------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stored_id_wins_over_apples_first_result(service):
    """The regression. Our id is LAST in Apple's response and must still be the answer."""
    with patch("app.services.apple_music_transfer_service._http_request",
               return_value=_response(200, APPLE_ISRC_RESPONSE)):
        out = await service._resolve_songs_by_isrc(
            "dev", "gr", [ISRC], expected={ISRC: EXPECTED_HOLD}
        )
    assert out[ISRC] == OURS, "must pick Cristian Vogel by id, not Apple's first result"
    assert out[ISRC] != WRONG


@pytest.mark.asyncio
async def test_ambiguous_isrc_resolves_to_nothing_rather_than_guessing(service):
    """With no stored id and nothing distinguishing the candidates, refuse to choose.

    Reporting the track unmatched is recoverable. Silently adding the wrong song is not.
    """
    with patch("app.services.apple_music_transfer_service._http_request",
               return_value=_response(200, APPLE_ISRC_RESPONSE)):
        out = await service._resolve_songs_by_isrc("dev", "gr", [ISRC], expected={})
    assert ISRC not in out


@pytest.mark.asyncio
async def test_duration_alone_rejects_the_wrong_recording(service):
    """Even with no stored id, 425s vs 255s is decisive."""
    with patch("app.services.apple_music_transfer_service._http_request",
               return_value=_response(200, APPLE_ISRC_RESPONSE)):
        out = await service._resolve_songs_by_isrc(
            "dev", "gr", [ISRC],
            expected={ISRC: {"name": "Hold", "artist": "Cristian Vogel", "duration_ms": 425000}},
        )
    assert out[ISRC] == OURS


@pytest.mark.asyncio
async def test_unambiguous_isrc_still_resolves(service):
    """The fix must not break the normal single-result case."""
    body = {"data": [{"id": "999", "attributes": {"isrc": "GB0000000001", "name": "Solo",
                                                  "artistName": "Someone",
                                                  "durationInMillis": 200000}}]}
    with patch("app.services.apple_music_transfer_service._http_request",
               return_value=_response(200, body)):
        out = await service._resolve_songs_by_isrc("dev", "gr", ["GB0000000001"], expected={})
    assert out["GB0000000001"] == "999"


# --------------------------------------------------------------------------------------
# filter[equivalents] — the route now tried first
# --------------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_equivalents_confirms_an_unchanged_id(service):
    """Apple returned our own id, so the id is valid in this storefront as-is."""
    body = {"data": [{"id": OURS, "attributes": {"isrc": ISRC, "name": "Hold",
                                                 "artistName": "Cristian Vogel",
                                                 "durationInMillis": 425000}}]}
    with patch("app.services.apple_music_transfer_service._http_request",
               return_value=_response(200, body)):
        out = await service._resolve_songs_by_equivalents(
            "dev", "gr", [OURS], expected={OURS: EXPECTED_HOLD}
        )
    assert out[OURS] == OURS


@pytest.mark.asyncio
async def test_equivalents_maps_a_translated_id_by_identity_not_position(service):
    """A different id in this storefront is accepted only because it IS the same recording."""
    body = {"data": [{"id": "555", "attributes": {"isrc": ISRC, "name": "Hold",
                                                  "artistName": "Cristian Vogel",
                                                  "durationInMillis": 425000}}]}
    with patch("app.services.apple_music_transfer_service._http_request",
               return_value=_response(200, body)):
        out = await service._resolve_songs_by_equivalents(
            "dev", "gr", [OURS], expected={OURS: EXPECTED_HOLD}
        )
    assert out[OURS] == "555"


@pytest.mark.asyncio
async def test_equivalents_rejects_a_different_recording(service):
    with patch("app.services.apple_music_transfer_service._http_request",
               return_value=_response(200, {"data": [APPLE_ISRC_RESPONSE["data"][0]]})):
        out = await service._resolve_songs_by_equivalents(
            "dev", "gr", [OURS], expected={OURS: EXPECTED_HOLD}
        )
    assert out == {}


# --------------------------------------------------------------------------------------
# The search fallback must not return its best guess
# --------------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_search_rejects_a_wrong_first_hit(service):
    """A text search always answers. Answering is not the same as being right."""
    body = {"results": {"songs": {"data": [
        {"id": WRONG, "attributes": {"name": "I Could Never", "artistName": "Ed Prosek",
                                     "durationInMillis": 255000}},
    ]}}}
    with patch("requests.Session.get", return_value=_response(200, body)):
        got = await service._search_song("dev", isrc=None, title="Hold",
                                         artist="Cristian Vogel", storefront="gr")
    assert got is None


@pytest.mark.asyncio
async def test_search_takes_a_lower_result_that_actually_matches(service):
    body = {"results": {"songs": {"data": [
        {"id": "111", "attributes": {"name": "Holding On", "artistName": "Someone Else",
                                     "durationInMillis": 200000}},
        {"id": OURS, "attributes": {"name": "Hold", "artistName": "Cristian Vogel",
                                    "durationInMillis": 425000}},
    ]}}}
    with patch("requests.Session.get", return_value=_response(200, body)):
        got = await service._search_song("dev", isrc=None, title="Hold",
                                         artist="Cristian Vogel", storefront="gr")
    assert got is not None and got["id"] == OURS


# --------------------------------------------------------------------------------------
# Identity matching
# --------------------------------------------------------------------------------------

def test_artists_joined_differently_are_the_same_artists():
    ours = _artist_tokens("Out Of Place Artefacts, Rødhåd, VRIL")
    apple = _artist_tokens("Out Of Place Artefacts, VRIL & Rødhåd")
    assert ours & apple


@pytest.mark.parametrize("expected_name,candidate_name", [
    ("Immense ramps (Original Mix)", "Immense Ramps"),   # our suffix, not Apple's
    ("Hold", "Hold (Remastered)"),                        # Apple's suffix, not ours
    ("LAGEOS 1 (Original Mix)", "Lageos 1"),              # casing plus suffix
])
def test_title_variants_of_one_recording_match(expected_name, candidate_name):
    assert _is_same_recording(
        {"name": candidate_name, "artistName": "A", "durationInMillis": 300000},
        {"name": expected_name, "artist": "A", "duration_ms": 300000},
    )


def test_same_title_different_artist_is_not_the_same_recording():
    assert not _is_same_recording(
        {"name": "Hold", "artistName": "Ed Prosek", "durationInMillis": 425000},
        {"name": "Hold", "artist": "Cristian Vogel", "duration_ms": 425000},
    )


def test_duration_gap_is_decisive():
    assert not _is_same_recording(
        {"name": "Hold", "artistName": "Cristian Vogel", "durationInMillis": 255000},
        {"name": "Hold", "artist": "Cristian Vogel", "duration_ms": 425000},
    )


def test_missing_duration_falls_back_to_names():
    """Apple omits durationInMillis on occasion; that must not reject a real match."""
    assert _is_same_recording(
        {"name": "Hold", "artistName": "Cristian Vogel"},
        {"name": "Hold", "artist": "Cristian Vogel", "duration_ms": 425000},
    )
