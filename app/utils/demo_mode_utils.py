"""
Demo Mode Utilities
===================

Helper functions to redact playlist/similarity payloads when demo mode is enabled.
Ensures only a limited number of records expose real metadata.
"""

from __future__ import annotations

from typing import Any, Dict, List, MutableMapping

REDACTION_LIMIT = 20
# How many tracks an un-authenticated ("logged-out") frontend caller may see/play in full
# before the rest are scrambled. The scramble (not removal) lets the UI show "log in to unlock".
ANON_VISIBLE_COUNT = 10
_ID_PATTERN = "dEm0"
_TEXT_PATTERN = "demo"
# Width of the per-row index appended to a masked id, so redacted rows do not all
# collide on one value. See _mask_id.
_ID_SUFFIX_WIDTH = 4


def is_anonymous_frontend(authenticated: bool, partner_id: Any, system_partner_id: Any) -> bool:
    """True when the caller is an un-authenticated frontend (System Partner) user.

    This is the group we *degrade* (first ``ANON_VISIBLE_COUNT`` real, rest scrambled, HLS
    truncated) to push them toward logging in — instead of blocking. B2B partners
    (``partner_id != system_partner_id``) authenticate via API key and are never degraded.
    """
    return (not authenticated) and partner_id == system_partner_id


def _mask_id(value: str, position: int | None = None) -> str:
    """A fake id of the same length as the real one, DISTINCT per row.

    The original derived the output from the input's LENGTH alone. Every track uuid is 36
    characters, so every redacted track received a byte-identical id — ten rows, one id.

    That is not a leak, but it broke the client: the playlist table renders each row as
    ``<React.Fragment key={track.id}>``, so React was handed ten siblings sharing one key. When
    the same playlist was refetched as a logged-in user, the list did not update to the now-real
    tracks; only a page reload did. Duplicate sibling keys make reconciliation undefined, and the
    UI kept showing the redacted rows while the store held the correct ones.

    ``position`` is the row's index, which the client already knows as ``rank`` — appending it
    reveals nothing that is not on screen. The ``dEm0`` prefix is preserved because the embed
    widget identifies redacted tracks with ``String(t.id).startsWith('dEm0')``.
    """
    pattern = _ID_PATTERN
    length = len(value)
    masked = "".join(pattern[i % len(pattern)] for i in range(length))
    if position is None:
        return masked
    suffix = str(position).zfill(_ID_SUFFIX_WIDTH)
    # No room to disambiguate without eating the prefix the embed widget matches on. Short values
    # are never the track `id` (a uuid), so leaving them undifferentiated is safe.
    if length <= len(suffix) + len(pattern):
        return masked
    return masked[: length - len(suffix)] + suffix


def _mask_text(value: str) -> str:
    result_chars: List[str] = []
    idx = 0
    for char in value:
        if char.isalpha():
            repl = _TEXT_PATTERN[idx % len(_TEXT_PATTERN)]
            repl = repl.upper() if char.isupper() else repl
            result_chars.append(repl)
            idx += 1
        else:
            result_chars.append(char)
    return "".join(result_chars)


def _redact_tracks(tracks: List[MutableMapping[str, Any]], visible_count: int) -> None:
    if not isinstance(tracks, list):
        return

    # `-1` is this system's sentinel for "unlimited" and callers pass a plan entitlement straight
    # in. Left unguarded, `position < -1` is never true and EVERY track would be scrambled — a plan
    # that grants the most would show the least. No seeded plan uses -1 for
    # `max_tracks_per_playlist` today, but the admin can set it and the convention invites it.
    if visible_count < 0:
        return

    for position, track in enumerate(tracks):
        if position < visible_count:
            continue

        if not isinstance(track, MutableMapping):
            continue

        if "id" in track and track["id"] is not None:
            track["id"] = _mask_id(str(track["id"]), position)

        # Every free-text field that identifies the recording. `album` and `genre` were missing:
        # Apple enrichment fills them from the real catalogue, so a scrambled title sitting next to
        # "La French Touch - EP / House | Music | Dance" still names the record to anyone who knows
        # it. Masking the title alone is not redaction, it is obfuscation.
        for key in ("label", "artist", "title", "album", "genre"):
            if key in track and track[key]:
                track[key] = _mask_text(str(track[key]))

        # An ISRC is a globally unique key for the recording — one lookup turns it straight back
        # into artist and title, which defeats everything above. Masked with the id pattern rather
        # than the text pattern: `_mask_text` leaves digits alone, and an ISRC's digits carry its
        # registration year and designation code.
        if track.get("isrc"):
            track["isrc"] = _mask_id(str(track["isrc"]), position)

        # Constants, not scrambles: a real duration narrows the candidates a lot on its own, and
        # unlike the text fields there is no way to mangle a number without it still being a number
        # in the right neighbourhood.
        track["year"] = 2025
        if "duration" in track:
            track["duration"] = 300.0

        # Hidden tracks must not leak their Apple preview/artwork/deep-link — playback is gated
        # behind login. Null the Apple playback fields so the UI shows "log in to unlock".
        for key in ("preview_url", "artwork_url", "deep_link_url", "apple_song_id"):
            if key in track:
                track[key] = None


def apply_demo_mode_redaction(payload: Dict[str, Any], visible_count: int = REDACTION_LIMIT) -> Dict[str, Any]:
    """
    Redact similar track metadata in responses when demo mode is active.
    Mutates payload in place and also returns it for convenience.
    """
    if not isinstance(payload, MutableMapping):
        return payload

    if "similar_tracks" in payload:
        _redact_tracks(payload["similar_tracks"], visible_count)

    data_section = payload.get("data")
    if isinstance(data_section, MutableMapping) and "similar_tracks" in data_section:
        _redact_tracks(data_section["similar_tracks"], visible_count)

    return payload

