#!/usr/bin/env python3
"""Generate an ingestion manifest CSV from a folder of audio files.

Use this when you have a directory of `.flac` / `.wav` / `.mp3` files but **no**
manifest CSV (e.g. a first staging ingestion). It scans the folder, parses
artist / title / mix from each filename, synthesizes a unique valid-format ISRC
per track, best-effort reads duration via mutagen, and writes a manifest CSV
matching the contract the media server's ingestion validator enforces
(`resomix-similarity-open/app/services/ingestion_runner.py`):

    required columns: isrc, title, audio_filename, display_artist
    ISRC regex:       ^[A-Z]{2}[A-Z0-9]{3}\\d{7}$   (12 chars, unique per batch)

The synthesized ISRCs are placeholders (prefix `QZRMX` by default — `QZ` is a
safe non-allocated country code) so a staging batch validates. Review/edit the
output CSV before a real ingestion if you have authoritative metadata.

Usage:
    python scripts/generate_manifest.py <audio_dir> [--out manifest.csv]
                                        [--isrc-prefix QZRMX] [--genre Electronic]

Standalone: stdlib only (mutagen is optional; duration is left blank without it).
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

AUDIO_EXTS = {".flac", ".wav", ".mp3"}

# Columns we emit. Required-by-validator first, then useful optionals.
FIELDNAMES = [
    "isrc",
    "title",
    "display_artist",
    "audio_filename",
    "mix_name",
    "version_title",
    "genre",
    "duration_ms",
]

_TRACKNO_RE = re.compile(r"^\s*\d+\s*[.\)-]\s*(.*)$")  # strip leading "01. " / "01) " / "01 - "
_TRAILING_PAREN_RE = re.compile(r"\(([^()]*)\)\s*$")   # last "(...)" group = mix name


def parse_filename(stem: str) -> tuple[str, str, str]:
    """Return (display_artist, title, mix_name) parsed from a filename stem.

    Heuristic for names like ``01. Artist, Other - Title feat. X (Original Mix)``:
      * drop a leading track number,
      * split artist/title on the first ' - ',
      * treat a trailing parenthetical as the mix name (default 'Original Mix').
    """
    m = _TRACKNO_RE.match(stem)
    core = m.group(1) if m else stem.strip()

    if " - " in core:
        artist, rest = core.split(" - ", 1)
    else:
        artist, rest = "", core
    artist = artist.strip()
    rest = rest.strip()

    pm = _TRAILING_PAREN_RE.search(rest)
    if pm:
        mix = pm.group(1).strip() or "Original Mix"
        title = rest[: pm.start()].strip()
    else:
        mix = "Original Mix"
        title = rest

    if not title:
        title = rest or stem.strip()
    if not artist:
        artist = "Unknown Artist"
    return artist, title, mix


def read_duration_ms(path: Path) -> str:
    """Best-effort track duration in ms via mutagen; '' if unavailable."""
    try:
        from mutagen import File as MutagenFile  # type: ignore
    except Exception:
        return ""
    try:
        mf = MutagenFile(str(path))
        length = getattr(getattr(mf, "info", None), "length", None)
        if length and length > 0:
            return str(int(round(length * 1000)))
    except Exception:
        pass
    return ""


def make_isrc(prefix: str, seq: int) -> str:
    """Synthesize a unique, format-valid ISRC: <2 alpha><3 alnum><7 digits>."""
    prefix = prefix.upper()
    if not re.match(r"^[A-Z]{2}[A-Z0-9]{3}$", prefix):
        raise SystemExit(
            f"--isrc-prefix '{prefix}' must be 5 chars: 2 letters + 3 letters/digits (e.g. QZRMX)."
        )
    return f"{prefix}{seq:07d}"


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate an ingestion manifest CSV from an audio folder.")
    ap.add_argument("audio_dir", help="Folder containing .flac/.wav/.mp3 files")
    ap.add_argument("--out", default="manifest.csv", help="Output CSV path (default: ./manifest.csv)")
    ap.add_argument("--isrc-prefix", default="QZRMX", help="5-char ISRC prefix (2 alpha + 3 alnum). Default QZRMX.")
    ap.add_argument("--genre", default="", help="Optional genre to stamp on every row (e.g. Electronic).")
    args = ap.parse_args()

    src = Path(args.audio_dir).expanduser()
    if not src.is_dir():
        raise SystemExit(f"Not a directory: {src}")

    files = sorted(
        (p for p in src.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTS),
        key=lambda p: p.name.lower(),
    )
    if not files:
        raise SystemExit(f"No .flac/.wav/.mp3 files found in {src}")

    out_path = Path(args.out).expanduser()
    rows = []
    for i, p in enumerate(files, start=1):
        artist, title, mix = parse_filename(p.stem)
        rows.append({
            "isrc": make_isrc(args.isrc_prefix, i),
            "title": title,
            "display_artist": artist,
            "audio_filename": p.name,   # exact basename — must match the file in the SFTP env dir
            "mix_name": mix,
            "version_title": "",
            "genre": args.genre,
            "duration_ms": read_duration_ms(p),
        })

    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    with_dur = sum(1 for r in rows if r["duration_ms"])
    print(f"Wrote {len(rows)} rows -> {out_path}")
    print(f"  duration filled for {with_dur}/{len(rows)} (mutagen {'available' if with_dur else 'unavailable/none'})")
    print("  ISRCs are SYNTHETIC placeholders — review the CSV before a real ingestion.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
