"""
Build the `new_partner` E2E onboarding batch.
======================================================

Creates `aa_staging_resources/new_partner/` containing everything a partner
would upload to their SFTP `live/` (or `test/`) folder for a full end-to-end
ingestion run:

  * The 71 open FLAC tracks (copied verbatim from `audio_files_raw/`).
  * `manifest.csv` — a valid ingestion manifest matching the headers expected
    by `app/services/ingestion_service.py`:
        required: isrc, title, audio_filename, display_artist
        optional: duration_ms, bpm, musical_key, genre
  * `.done` — the empty completion marker whose upload triggers the SFTPGo
    event hook (`/internal/sftp/event`).

Metadata enrichment
-------------------
Artist / title are parsed from the canonical filename pattern
`07 - <Artist> - <Title>.flac`. Where available, genre / duration_ms / bpm /
musical_key are pulled from `scripts/extracted_track_info.json`, keyed by the
basename of each entry's `local_file_path` (which equals the raw FLAC filename).

Synthetic ISRCs
---------------
Each track gets a sequential, valid, batch-unique synthetic ISRC of the form
`USRMX25NNNNN` (US country, RMX registrant, 7 numeric) — e.g. `USRMX2500001`.
These satisfy the ingestion regex `^[A-Z]{2}[A-Z0-9]{3}\\d{7}$` and uniqueness.

Run:
    python scripts/build_new_partner_batch.py
"""

import csv
import json
import os
import shutil
from pathlib import Path

# ── Paths ───────────────────────────────────────────────────────────────────
STAGING_ROOT = Path(
    "/Users/muhammadusmannaeem/Data/projects/Upwork/George/aa_staging_resources"
)
RAW_DIR = STAGING_ROOT / "audio_files_raw"
OUT_DIR = STAGING_ROOT / "new_partner"
JSON_PATH = Path(__file__).resolve().parent / "extracted_track_info.json"


def parse_artist_title(filename: str) -> tuple[str, str]:
    """`07 - Artist - Title.flac` -> ("Artist", "Title")."""
    stem = filename
    for ext in (".flac", ".wav", ".mp3"):
        if stem.lower().endswith(ext):
            stem = stem[: -len(ext)]
            break
    parts = [p.strip() for p in stem.split(" - ")]
    if len(parts) >= 3:
        # drop leading track-number token, artist is next, title is the rest
        return parts[1], " - ".join(parts[2:])
    if len(parts) == 2:
        return parts[0], parts[1]
    return "Unknown Artist", stem


def load_metadata_index() -> dict[str, dict]:
    """Index extracted_track_info.json by basename(local_file_path)."""
    if not JSON_PATH.exists():
        return {}
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    index: dict[str, dict] = {}
    for entry in data:
        lfp = entry.get("local_file_path") or ""
        if lfp:
            index[os.path.basename(lfp)] = entry
    return index


def duration_ms_from(entry: dict | None) -> str:
    if not entry:
        return ""
    raw = entry.get("duration_sec")
    if raw in (None, "", "null"):
        return ""
    try:
        return str(int(round(float(raw) * 1000)))
    except (TypeError, ValueError):
        return ""


def clean_optional(value) -> str:
    """Return a CSV-safe string, treating placeholder values as empty."""
    if value in (None, "", "null", "Unknown", "unknown"):
        return ""
    return str(value)


def main() -> None:
    if not RAW_DIR.is_dir():
        raise SystemExit(f"Raw dir not found: {RAW_DIR}")

    flacs = sorted(p.name for p in RAW_DIR.glob("*.flac"))
    if not flacs:
        raise SystemExit(f"No FLAC files found in {RAW_DIR}")

    meta_index = load_metadata_index()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "isrc",
        "title",
        "audio_filename",
        "display_artist",
        "duration_ms",
        "bpm",
        "musical_key",
        "genre",
    ]

    rows: list[dict[str, str]] = []
    copied = 0
    enriched = 0

    for i, filename in enumerate(flacs, start=1):
        artist, title = parse_artist_title(filename)
        entry = meta_index.get(filename)
        if entry:
            enriched += 1
            # Prefer the cleaner JSON title/artist when present.
            json_title = (entry.get("title") or "").strip()
            if json_title:
                title = json_title
            json_artists = entry.get("artists") or []
            if json_artists:
                artist = ", ".join(a.strip() for a in json_artists if a.strip()) or artist

        isrc = f"USRMX{2500000 + i:07d}"  # 2 alpha + 3 alnum + 7 digits = 12 chars

        rows.append(
            {
                "isrc": isrc,
                "title": title,
                "audio_filename": filename,
                "display_artist": artist,
                "duration_ms": duration_ms_from(entry),
                "bpm": clean_optional(entry.get("bpm") if entry else None),
                "musical_key": clean_optional(entry.get("musical_key") if entry else None),
                "genre": clean_optional(entry.get("genre_name") if entry else None),
            }
        )

        # Copy the audio file alongside the manifest.
        dst = OUT_DIR / filename
        if not dst.exists():
            shutil.copy2(RAW_DIR / filename, dst)
        copied += 1

    # Write the manifest (DictWriter handles quoting of commas / special chars).
    manifest_path = OUT_DIR / "manifest.csv"
    with open(manifest_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # Create the empty .done completion marker LAST.
    (OUT_DIR / ".done").write_text("")

    print(f"✅ new_partner batch built at: {OUT_DIR}")
    print(f"   FLAC files copied : {copied}")
    print(f"   manifest rows     : {len(rows)} (metadata-enriched: {enriched})")
    print(f"   manifest          : {manifest_path}")
    print(f"   trigger marker    : {OUT_DIR / '.done'}")


if __name__ == "__main__":
    main()
