"""
Playlist Export Service
=======================

Builds a playlist's exportable file **server-side**.

WHY THIS EXISTS
---------------
TXT export used to be assembled entirely in the browser: ``usePlaylistExport.ts`` built the string,
wrapped it in a ``Blob`` and triggered an anchor download. The server never saw it.

That makes two of the pricing rules unenforceable rather than merely unenforced:

  * ``exports_per_day`` cannot be counted — there is no request to count.
  * ``export_track_limit`` is whatever the client decides, and the client is editable.

So the formatting moved here, where the limit is applied to the bytes the user receives. The output
is deliberately **identical** to the file people already download — same header, same numbering, same
footer — because this is a relocation, not a redesign. A user should not be able to tell that
anything changed.

WHAT THIS MODULE IS NOT
-----------------------
It resolves no entitlements and consumes no credits. It is handed a track limit and formats to it.
The gate lives in ``PlaylistExportController``; keeping this module free of ``db`` is what lets the
formatting be tested exhaustively without a database.

Version: 1.0.0
Init Date: August 5, 2026
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# Canonical export targets. These are the tokens stored in the ``export_targets`` entitlement CSV
# and the values the API accepts.
TARGET_TXT = "txt"
TARGET_APPLE = "apple"
TARGET_SPOTIFY = "spotify"
TARGET_EMBED = "embed"

# Spelling drift, resolved in one place. Production stores "apple" and the frontend compares against
# the literal "apple" (`useAccess.ts`), while the pricing spec writes "apple_music". Aliasing means
# neither has to move and a target can never be half-recognised — allowed by the gate but rejected
# by the endpoint, or the reverse.
TARGET_ALIASES = {
    "apple_music": TARGET_APPLE,
    "applemusic": TARGET_APPLE,
    "text": TARGET_TXT,
    "txt_file": TARGET_TXT,
}

# Targets this endpoint can actually produce a file for. Apple/Spotify are transfers, not downloads,
# and keep their own endpoints; embed is a link (Phase G).
DOWNLOADABLE_TARGETS = {TARGET_TXT}

_FOOTER = "Sonic matches provided by Resomix https://resomix.com"
_TRUNCATION_NOTICE = "Showing the first {count} tracks. Upgrade your plan to export the full list."

# Mirrors the browser's `replace(/[^a-zA-Z0-9\s-_]/g, '')` — letters, digits, whitespace, hyphen and
# underscore survive. Kept identical so filenames do not change for anyone.
_FILENAME_STRIP = re.compile(r"[^a-zA-Z0-9\s\-_]")
_FILENAME_SPACES = re.compile(r"\s+")


def canonical_target(target: Optional[str]) -> str:
    """Normalise a caller-supplied or stored target token. Unknown values pass through unchanged so
    the caller can reject them explicitly rather than have them silently become something else."""
    if not target:
        return ""
    token = target.strip().lower()
    return TARGET_ALIASES.get(token, token)


def effective_track_limit(
    export_track_limit: Optional[int],
    unlocked_tracks: Optional[int],
    requested: Optional[int] = None,
) -> Optional[int]:
    """How many tracks may leave the server, or ``None`` for "no cap".

    Three ceilings apply and the **lowest** wins:

      * ``export_track_limit`` — the plan's export allowance (free 20, pro 100).
      * ``unlocked_tracks``    — what the user can actually see (``max_tracks_per_playlist``).
      * ``requested``          — an optional client ask. It can only ever *lower* the result, which
        is the entire reason a client-supplied number is safe to accept here.

    The second is what makes ``export_scope = "full"`` mean what the spec says it means: *"export
    what the user can see"*. A free user with a 50-track playlist sees 20 unlocked, so the export
    contains 20 — not 50. Without this ceiling the export would be a way to read the blurred tracks.

    Non-positive is "no ceiling from this source", which covers both conventions already in the
    data: ``0`` (the historical "full" for ``export_track_limit``) and ``-1`` (the ``UNLIMITED``
    sentinel introduced in Phase A). Neither may be read as "export nothing" — ``can_export`` is what
    denies, and it is checked before we ever get here.
    """
    caps = [
        c for c in (export_track_limit, unlocked_tracks, requested) if isinstance(c, int) and c > 0
    ]
    return min(caps) if caps else None


def _label_suffix(value: Any) -> str:
    return f" [{value}]" if value else ""


def _rank(value: Any) -> str:
    """Ranks are stored as floats. JavaScript printed ``1.0`` as ``1``; Python would print ``1.0``
    and every line of every existing export would change. Render integral values as integers."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    return str(int(number)) if number.is_integer() else str(number)


def build_filename(playlist_name: Optional[str], *, now: Optional[datetime] = None) -> str:
    """``sonic_journey_2026-08-05.txt`` — same rules the browser used.

    The date is UTC, matching the browser's ``toISOString()`` rather than the viewer's local day, so
    two people exporting the same playlist at the same moment get the same filename.
    """
    name = playlist_name or "playlist"
    sanitized = _FILENAME_STRIP.sub("", name)
    sanitized = _FILENAME_SPACES.sub("_", sanitized).lower()
    if not sanitized:
        sanitized = "playlist"
    stamp = (now or datetime.now(timezone.utc)).strftime("%Y-%m-%d")
    return f"{sanitized}_{stamp}.txt"


def build_txt(
    similarity_data: Dict[str, Any],
    *,
    track_limit: Optional[int] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Render the TXT export.

    Returns ``filename`` / ``content`` plus the counts the caller needs to tell the user what they
    got: ``track_count`` (in the file), ``total_tracks`` (in the playlist) and ``truncated``.
    """
    playlist = similarity_data.get("playlist") or {}
    queried_track = similarity_data.get("queried_track") or {}
    similar_tracks: List[Dict[str, Any]] = similarity_data.get("similar_tracks") or []

    playlist_name = (playlist.get("name") or "").upper()

    input_line = (
        f"INPUT TRACK: {queried_track.get('artist', '')} - {queried_track.get('title', '')}"
        f"{_label_suffix(queried_track.get('label'))}"
    )

    total = len(similar_tracks)
    exported = similar_tracks if track_limit is None else similar_tracks[:track_limit]

    lines = "\n".join(
        f"{_rank(track.get('rank'))}. {track.get('artist', '')} - {track.get('title', '')}"
        f"{_label_suffix(track.get('label'))}"
        for track in exported
    )

    truncated = len(exported) < total
    footer = (
        f"\n\n{_TRUNCATION_NOTICE.format(count=len(exported))}\n{_FOOTER}"
        if truncated
        else f"\n\n{_FOOTER}"
    )

    return {
        "filename": build_filename(playlist.get("name"), now=now),
        "content": f"{playlist_name}\n\n{input_line}\n\n{lines}{footer}",
        "format": TARGET_TXT,
        "track_count": len(exported),
        "total_tracks": total,
        "truncated": truncated,
    }
