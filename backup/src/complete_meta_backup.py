# metadata_utils.py
"""
Utility module: audio metadata extraction using Mutagen
------------------------------------------------------
• Exposes `extract_metadata(file_obj, filename="")` that returns a dict of
  *readable* audio metadata.
• Supports ID3 (MP3/WAV/AIFF) and Vorbis‑style tags (FLAC/Ogg/Opus).
• Skips embedded images / binary blocks.
• Robust against non‑string tag objects (e.g. `ID3TimeStamp`).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, BinaryIO, Union

from mutagen import File as MutagenFile, MutagenError
from mutagen.id3 import ID3

# ──────────────────────────────────────────────────────────────
# Friendly name maps
# ──────────────────────────────────────────────────────────────
ID3_FRIENDLY: Dict[str, str] = {
    "TIT2": "Title",
    "TPE1": "Artist",
    "TPE2": "Album Artist",
    "TALB": "Album",
    "TCON": "Genre",
    "TDRC": "Year",
    "TYER": "Year",
    "TDRL": "Release Date",
    "TRCK": "Track Number",
    "TPOS": "Disc Number",
    "TBPM": "BPM",
    "TSRC": "ISRC",
    "TPUB": "Publisher",
    "TCOM": "Composer",
}

VORBIS_FRIENDLY: Dict[str, str] = {
    "TITLE": "Title",
    "ARTIST": "Artist",
    "ALBUM": "Album",
    "ALBUMARTIST": "Album Artist",
    "GENRE": "Genre",
    "TRACKNUMBER": "Track Number",
    "TRACKTOTAL": "Track Total",
    "TOTALTRACKS": "Track Total",
    "DISCNUMBER": "Disc Number",
    "DISCTOTAL": "Disc Total",
    "TOTALDISCS": "Disc Total",
    "DATE": "Release Date",
    "YEAR": "Year",
    "BPM": "BPM",
    "ISRC": "ISRC",
    "CATALOGNUMBER": "Catalog Number",
    "LABEL": "Publisher",
    "PUBLISHER": "Publisher",
    "COMPOSER": "Composer",
    "COMMENT": "Comment",
    "COMMENTS": "Comment",
}

IMAGE_FRAME_IDS = {"APIC", "PIC"}
IMAGE_VORBIS_KEYS = {"METADATA_BLOCK_PICTURE", "COVERART", "COVERARTMIME"}
COMMENT_KEYS = {"COMM"}
TRACK_SPLIT = re.compile(r"^(?P<num>\d+)(?:/?(?P<tot>\d+))?$")

# ──────────────────────────────────────────────────────────────
# Small helpers
# ──────────────────────────────────────────────────────────────

def _to_text(value: Any) -> str:
    """Convert *value* (may be ID3TimeStamp, bytes, etc.) to stripped str."""
    if value is None:
        return ""
    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode("utf‑8", errors="replace").strip()
        except Exception:
            return ""
    return str(value).strip()


def _clean_numeric(s: str) -> Union[int, str]:
    return int(s) if s.isdigit() else s


def _flatten(val: Union[str, List[str]]):
    return val[0] if isinstance(val, list) and len(val) == 1 else val


def _handle_track_disc(text: str) -> str:
    m = TRACK_SPLIT.match(text.strip())
    if not m:
        return text.strip()
    num, tot = m.group("num"), m.group("tot")
    return f"{num}/{tot}" if tot else num

# ──────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────

def extract_metadata(file_obj: BinaryIO, filename: str = "") -> Dict[str, Any]:
    """Return cleaned metadata for *file_obj* (opened in binary mode)."""
    print(f"[extract_metadata] ▶ processing '{filename or '<in‑memory>'}'")
    meta: Dict[str, Any] = {}

    file_obj.seek(0)
    try:
        audio = MutagenFile(file_obj, easy=False)
    except MutagenError as e:
        print("[extract_metadata] MutagenError:", e)
        return {"error": str(e)}

    if audio is None or audio.tags is None:
        return {"info": "No tags found or unsupported format."}

    # Technical details
    if hasattr(audio, "info"):
        info = audio.info
        meta.update({
            "Duration (s)": round(getattr(info, "length", 0), 3),
            "Bitrate": getattr(info, "bitrate", None),
            "Sample Rate": getattr(info, "sample_rate", None),
            "Channels": getattr(info, "channels", None),
        })

    # Dispatch by tag container type
    if isinstance(audio.tags, ID3):
        _parse_id3(audio.tags, meta)
    else:
        # FLAC / OGG / OPUS => Vorbis comments dict‑like
        _parse_vorbis(dict(audio.tags), meta)

    print(f"[extract_metadata] ✔ collected {len(meta)} fields from '{filename}'")
    return meta

# ──────────────────────────────────────────────────────────────
# ID3 parsing
# ──────────────────────────────────────────────────────────────

def _parse_id3(tags: ID3, meta: Dict[str, Any]):
    for frame in tags.values():
        fid = frame.FrameID
        if fid in IMAGE_FRAME_IDS:
            continue  # skip artwork frames
        if fid in COMMENT_KEYS:
            txt_raw = (frame.text or [""])[0]
            txt = _to_text(txt_raw)
            if not txt:
                continue
            desc = _to_text(frame.desc or "Comment")
            key = "Comment" if desc.lower() == "comment" else f"Comment ({desc})"
            meta[key] = txt
            continue
        if hasattr(frame, "text"):
            raw_vals = frame.text or []
            vals = [_to_text(v) for v in raw_vals if _to_text(v)]
            if not vals:
                continue
            key = ID3_FRIENDLY.get(fid, fid)
            if fid == "TXXX":
                key = VORBIS_FRIENDLY.get(frame.desc.upper(), frame.desc)
            if fid in ("TRCK", "TPOS"):
                value = _handle_track_disc(vals[0])
            elif fid == "TBPM":
                value = _clean_numeric(vals[0])
            else:
                value = _flatten(vals)
            meta[key] = value
        else:
            # fallback — store string repr
            s = _to_text(frame)
            if s:
                meta[fid] = s

# ──────────────────────────────────────────────────────────────
# Vorbis / FLAC parsing
# ──────────────────────────────────────────────────────────────

def _parse_vorbis(vc: Dict[str, List[str]], meta: Dict[str, Any]):
    tn = tt = dn = dt = None  # track/disc helpers
    for k, raw in vc.items():
        up = k.upper()
        if up in IMAGE_VORBIS_KEYS:
            continue
        vals = raw if isinstance(raw, list) else [raw]
        vals = [_to_text(v) for v in vals if _to_text(v)]
        if not vals:
            continue
        if up in ("TRACKNUMBER", "TRACKTOTAL", "TOTALTRACKS"):
            if up == "TRACKNUMBER":
                tn = vals[0]
            else:
                tt = vals[0]
            continue
        if up in ("DISCNUMBER", "DISCTOTAL", "TOTALDISCS"):
            if up == "DISCNUMBER":
                dn = vals[0]
            else:
                dt = vals[0]
            continue
        key = VORBIS_FRIENDLY.get(up, k.title())
        if up == "BPM":
            meta[key] = _clean_numeric(vals[0])
        else:
            meta[key] = _flatten(vals)
    if tn:
        meta["Track Number"] = f"{tn}/{tt}" if tt else tn
    if dn:
        meta["Disc Number"] = f"{dn}/{dt}" if dt else dn
