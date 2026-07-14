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


def is_anonymous_frontend(authenticated: bool, partner_id: Any, system_partner_id: Any) -> bool:
    """True when the caller is an un-authenticated frontend (System Partner) user.

    This is the group we *degrade* (first ``ANON_VISIBLE_COUNT`` real, rest scrambled, HLS
    truncated) to push them toward logging in — instead of blocking. B2B partners
    (``partner_id != system_partner_id``) authenticate via API key and are never degraded.
    """
    return (not authenticated) and partner_id == system_partner_id


def _mask_id(value: str) -> str:
    pattern = _ID_PATTERN
    length = len(value)
    return "".join(pattern[i % len(pattern)] for i in range(length))


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

    for position, track in enumerate(tracks):
        if position < visible_count:
            continue

        if not isinstance(track, MutableMapping):
            continue

        if "id" in track and track["id"] is not None:
            track["id"] = _mask_id(str(track["id"]))

        for key in ("label", "artist", "title"):
            if key in track and track[key]:
                track[key] = _mask_text(str(track[key]))

        track["year"] = 2025

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

