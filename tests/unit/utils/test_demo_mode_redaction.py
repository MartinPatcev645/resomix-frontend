"""
Guest redaction: what it must hide, and what it must NOT collapse.

`_mask_id` derived its output from the input's LENGTH alone. Every track uuid is 36 characters, so
every redacted track came back with a byte-identical id. Not a leak, but it broke the client: the
playlist table renders each row as `<React.Fragment key={track.id}>`, so React was handed ten
siblings sharing one key. Refetching the same playlist as a logged-in user then failed to update
the list, and only a page reload fixed it.

These tests pin both halves: the redaction still hides everything it hid before, and the ids it
produces are distinct.
"""

import uuid

import pytest

from app.utils.demo_mode_utils import (
    ANON_VISIBLE_COUNT,
    apply_demo_mode_redaction,
    is_anonymous_frontend,
)


def _track(position: int) -> dict:
    return {
        "rank": position,
        "score": 0.9 - position / 100,
        "id": str(uuid.uuid4()),
        "title": f"Real Title {position}",
        "artist": f"Real Artist {position}",
        "album": "Real Album",
        "label": "Real Label",
        "genre": "Techno | Music | Dance",
        "isrc": "GBTZZ2000010",
        "year": 2019,
        "duration": 242.465,
        "preview_url": "https://audio.example/preview.m4a",
        "artwork_url": "https://img.example/cover.jpg",
        "deep_link_url": "https://music.apple.com/track",
        "apple_song_id": "1514204667",
    }


HIDDEN_COUNT = 10


@pytest.fixture()
def payload() -> dict:
    # Always HIDDEN_COUNT tracks past the guest cap, so the redaction tests below have rows to check
    # whatever the cap is. A fixed 20 made them pass on an empty list once the cap reached 20.
    return {"similar_tracks": [_track(i) for i in range(ANON_VISIBLE_COUNT + HIDDEN_COUNT)]}


# --- the bug this file exists for ------------------------------------------- #

def test_redacted_ids_are_distinct(payload):
    """The regression. Identical ids became duplicate React keys, and the list stopped updating."""
    apply_demo_mode_redaction(payload, visible_count=ANON_VISIBLE_COUNT)
    hidden_ids = [t["id"] for t in payload["similar_tracks"][ANON_VISIBLE_COUNT:]]

    assert len(hidden_ids) == HIDDEN_COUNT
    assert len(set(hidden_ids)) == len(hidden_ids), "redacted rows must not share an id"


def test_redacted_ids_keep_the_dEm0_prefix(payload):
    """`apps/embed/src/api.ts` identifies a redacted track with `String(t.id).startsWith('dEm0')`.
    Making the ids distinct must not break that check."""
    apply_demo_mode_redaction(payload, visible_count=ANON_VISIBLE_COUNT)
    for track in payload["similar_tracks"][ANON_VISIBLE_COUNT:]:
        assert track["id"].startswith("dEm0")


def test_redacted_ids_keep_the_original_length(payload):
    apply_demo_mode_redaction(payload, visible_count=ANON_VISIBLE_COUNT)
    for track in payload["similar_tracks"][ANON_VISIBLE_COUNT:]:
        assert len(track["id"]) == 36


def test_redaction_is_deterministic(payload):
    """Same input, same output. A fake id that changed between two fetches of the same playlist
    would remount every hidden row for no reason."""
    first = apply_demo_mode_redaction({"similar_tracks": [_track(i) for i in range(20)]},
                                      visible_count=ANON_VISIBLE_COUNT)
    second = apply_demo_mode_redaction({"similar_tracks": [_track(i) for i in range(20)]},
                                       visible_count=ANON_VISIBLE_COUNT)
    assert [t["id"] for t in first["similar_tracks"]][ANON_VISIBLE_COUNT:] == \
           [t["id"] for t in second["similar_tracks"]][ANON_VISIBLE_COUNT:]


# --- what redaction must still do ------------------------------------------- #

def test_visible_tracks_are_untouched(payload):
    original = [dict(t) for t in payload["similar_tracks"][:ANON_VISIBLE_COUNT]]
    apply_demo_mode_redaction(payload, visible_count=ANON_VISIBLE_COUNT)
    assert payload["similar_tracks"][:ANON_VISIBLE_COUNT] == original


def test_identifying_text_is_masked(payload):
    apply_demo_mode_redaction(payload, visible_count=ANON_VISIBLE_COUNT)
    for track in payload["similar_tracks"][ANON_VISIBLE_COUNT:]:
        # album and genre included: Apple enrichment fills them from the real catalogue, so a
        # scrambled title next to a real album still names the record.
        for key in ("title", "artist", "album", "label", "genre"):
            assert "Real" not in track[key]
            assert "Techno" not in track[key]


def test_isrc_is_masked(payload):
    """An ISRC is a globally unique key for the recording — one lookup undoes every other mask."""
    apply_demo_mode_redaction(payload, visible_count=ANON_VISIBLE_COUNT)
    for track in payload["similar_tracks"][ANON_VISIBLE_COUNT:]:
        assert track["isrc"] != "GBTZZ2000010"
        assert track["isrc"].startswith("dEm0")


def test_apple_playback_fields_are_nulled(payload):
    """Playback past the cap is gated behind login; a live preview URL would defeat that."""
    apply_demo_mode_redaction(payload, visible_count=ANON_VISIBLE_COUNT)
    for track in payload["similar_tracks"][ANON_VISIBLE_COUNT:]:
        for key in ("preview_url", "artwork_url", "deep_link_url", "apple_song_id"):
            assert track[key] is None


def test_year_and_duration_are_constants(payload):
    apply_demo_mode_redaction(payload, visible_count=ANON_VISIBLE_COUNT)
    for track in payload["similar_tracks"][ANON_VISIBLE_COUNT:]:
        assert track["year"] == 2025
        assert track["duration"] == 300.0


def test_unlimited_sentinel_redacts_nothing(payload):
    """`-1` means unlimited. Unguarded, `position < -1` is never true and the most generous plan
    would have shown the least."""
    original = [dict(t) for t in payload["similar_tracks"]]
    apply_demo_mode_redaction(payload, visible_count=-1)
    assert payload["similar_tracks"] == original


def test_nested_data_section_is_redacted():
    """Callers pass either the payload or the whole `{success, data}` envelope."""
    nested = {"data": {"similar_tracks": [_track(i) for i in range(20)]}}
    apply_demo_mode_redaction(nested, visible_count=ANON_VISIBLE_COUNT)
    hidden = nested["data"]["similar_tracks"][ANON_VISIBLE_COUNT:]
    assert all(t["id"].startswith("dEm0") for t in hidden)
    assert len({t["id"] for t in hidden}) == len(hidden)


def test_only_unauthenticated_system_partner_callers_are_degraded():
    """B2B partners authenticate with an API key and have their own quotas — never redacted."""
    assert is_anonymous_frontend(authenticated=False, partner_id=1, system_partner_id=1) is True
    assert is_anonymous_frontend(authenticated=True, partner_id=1, system_partner_id=1) is False
    assert is_anonymous_frontend(authenticated=False, partner_id=4, system_partner_id=1) is False


def test_guest_cap_matches_the_guest_plan():
    """Guests are capped by this constant AND by the guest plan's `max_tracks_per_playlist`, and the
    smaller wins. If they drift, raising the plan in admin silently changes nothing."""
    from app.services.entitlement_seed import PLAN_ENTITLEMENTS

    assert ANON_VISIBLE_COUNT == PLAN_ENTITLEMENTS["guest"]["max_tracks_per_playlist"] == 20
