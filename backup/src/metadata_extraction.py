# metadata_utils.py
"""
Utility module: *limited* audio metadata extraction using Mutagen
----------------------------------------------------------------
Extract **only** these textual tags (if present):
    • Title
    • Album
    • Artist
    • Genre
    • Year
    • Label  ← derived from Publisher/Label frames
All other tags and technical fields are ignored.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, BinaryIO

from mutagen import File as MutagenFile, MutagenError
from mutagen.id3 import ID3

# ──────────────────────────────────────────────────────────────
# Mapping tables – ONLY the tags we care about
# ──────────────────────────────────────────────────────────────
ID3_MAP: Dict[str, str] = {
    "TIT2": "Title",
    "TALB": "Album",
    "TPE1": "Artist",
    "TCON": "Genre",
    "TDRC": "Year",  # v2.4 Recording time
    "TYER": "Year",  # v2.3 Year
    "TPUB": "Label",  # Publisher → Label
}

VORBIS_MAP: Dict[str, str] = {
    "TITLE": "Title",
    "ALBUM": "Album",
    "ARTIST": "Artist",
    "GENRE": "Genre",
    "YEAR": "Year",
    "DATE": "Year",      # Some FLACs use DATE for year
    "LABEL": "Label",
    "PUBLISHER": "Label",
}

IMAGE_FRAME_IDS = {"APIC", "PIC"}
IMAGE_VORBIS_KEYS = {"METADATA_BLOCK_PICTURE", "COVERART", "COVERARTMIME"}
COMMENT_IDS = {"COMM"}
_year_from_date = re.compile(r"^(\d{4})")

# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _to_str(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, (bytes, bytearray)):
        try:
            return val.decode("utf-8", errors="replace").strip()
        except Exception:
            return ""
    return str(val).strip()


def _first(lst: List[str]) -> str:
    return lst[0] if lst else ""

# ──────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────

def extract_metadata(file_obj: BinaryIO, filename: str = "") -> Dict[str, str]:
    """Return dict with ONLY the requested fields."""
    wanted: Dict[str, str] = {}
    file_obj.seek(0)
    try:
        audio = MutagenFile(file_obj, easy=False)
    except MutagenError as e:
        return {"error": str(e)}

    if audio is None or audio.tags is None:
        return wanted  # empty dict – nothing found / unsupported format

    if isinstance(audio.tags, ID3):
        _gather_id3(audio.tags, wanted)
    else:
        _gather_vorbis(dict(audio.tags), wanted)

    return wanted

# ──────────────────────────────────────────────────────────────
# Gatherers
# ──────────────────────────────────────────────────────────────

def _gather_id3(tags: ID3, out: Dict[str, str]):
    for frame in tags.values():
        fid = frame.FrameID
        if fid in IMAGE_FRAME_IDS or fid in COMMENT_IDS:
            continue
        key = ID3_MAP.get(fid)
        if not key:
            continue  # skip unneeded tags
        if hasattr(frame, "text"):
            txt = _to_str(_first(frame.text or []))
            if not txt:
                continue
            if key == "Year":
                m = _year_from_date.match(txt)
                txt = m.group(1) if m else txt
            out.setdefault(key, txt)
        else:
            # Non-text frame – ignore
            continue


def _gather_vorbis(vc: Dict[str, List[str]], out: Dict[str, str]):
    for k, vals in vc.items():
        up = k.upper()
        if up in IMAGE_VORBIS_KEYS:
            continue
        key = VORBIS_MAP.get(up)
        if not key:
            continue
        value_str = _to_str(_first(vals if isinstance(vals, list) else [vals]))
        if not value_str:
            continue
        if key == "Year":
            m = _year_from_date.match(value_str)
            value_str = m.group(1) if m else value_str
        out.setdefault(key, value_str)
