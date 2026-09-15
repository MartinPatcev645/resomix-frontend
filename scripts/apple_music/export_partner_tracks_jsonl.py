#!/usr/bin/env python3
"""
Export PARTNER-INGESTED tracks from Alwyzon's DB to the JSONL the Apple matcher reads.

This is the new-schema twin of ``export_tracks_jsonl.py``. That script queries the OLD
Electrobuzz catalogue (``t.file_path``, ``t.duration_sec``, ``track_artists``, ``albums``), none
of which exists on Alwyzon's ``tracks`` table. Tracks that came in through the partner
ingestion pipeline (the 2026 re-ingest: partner 6, ingest runs 18-20) live here:

    tracks.title, tracks.display_artist, tracks.duration_ms, tracks.isrc,
    tracks.source_file_path  (the veggera/... path, same convention as the old file_path)

The OUTPUT SHAPE IS IDENTICAL to the old exporter's, so ``run_apple_matching.py`` runs on it
unchanged (via ``run_apple_matching_partner.py``, which only points it at these files).
Extra keys (``isrc``, ``ingest_log_id``, ``partner_id``, ``album_artist``) are carried for the
promotion step later; the matcher ignores keys it does not know.

WHAT IS EXPORTED

  * ``--partner-id`` (default 6) and ``--ingest-log-ids`` (default 18,19,20): the real load.
    Runs 11/12/13/16 are the 4,967-track pipeline test and are deliberately excluded.
  * Only tracks whose ``embedding_status`` is ``completed`` (``--include-unembedded`` lifts
    this). A track with no vector is not going to be promoted, so there is no point spending
    Apple requests on it. NOTE: Alwyzon writes embedding_status when the admin poll sees the
    job finish, so open the job in admin once before exporting, or a finished run reads as 0.

ALBUM / LABEL are not columns on these rows. They are parsed, best-effort, from the folder the
file sits in, which follows ``<ReleaseArtist> - <Album> - (<Label>)`` throughout the source
catalogue. Wrong or missing values here only affect the informational ``in_house`` block of the
match output, never the match itself (the matcher uses title, artists, duration, file_path).

Resumable exactly like the original: re-running continues after the largest ``id`` already in
the output file, so a killed export never duplicates rows.

USAGE (on Alwyzon, repo root, venv active)

    python scripts/apple_music/export_partner_tracks_jsonl.py                 # all three runs
    python scripts/apple_music/export_partner_tracks_jsonl.py --limit 200     # a taste
    python scripts/apple_music/export_partner_tracks_jsonl.py --ingest-log-ids 20
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# scripts/apple_music -> repo root, so `app` / `database` import when run directly.
sys.path.insert(0, os.path.dirname(os.path.dirname(SCRIPT_DIR)))

DEFAULT_OUT = os.path.join(SCRIPT_DIR, "tracks_input.partner6.jsonl")
PROGRESS_EVERY = 5000

# "<ReleaseArtist> - <Album> - (<Label>)"  ->  the trailing " - (Label)" part
_LABEL_SUFFIX_RE = re.compile(r"\s+-\s+\(([^()]+)\)\s*$")


def album_label_from_path(source_file_path: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """(album_artist, album, label) from the file's parent folder, or Nones.

    Best-effort by design: the folder convention is consistent across the catalogue, but a
    folder that does not follow it yields (None, folder-name, None) rather than a wrong split.
    """
    if not source_file_path:
        return None, None, None
    folder = os.path.basename(os.path.dirname(source_file_path.rstrip("/")))
    if not folder:
        return None, None, None
    label = None
    m = _LABEL_SUFFIX_RE.search(folder)
    if m:
        label = m.group(1).strip() or None
        folder = folder[: m.start()].strip()
    if " - " in folder:
        artist, album = folder.split(" - ", 1)
        return artist.strip() or None, album.strip() or None, label
    return None, folder or None, label


def record_from_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """One JSONL line in exactly the shape run_apple_matching.py / output_record expect."""
    dur_ms = row.get("duration_ms")
    album_artist, album, label = album_label_from_path(row.get("source_file_path"))
    return {
        "id": int(row["id"]),
        "uuid": row.get("uuid") or "",
        "file_path": row.get("source_file_path") or "",
        # in-house metadata, straight from our DB (the matcher's inputs)
        "title": row.get("title") or "",
        "artists": row.get("display_artist") or "",
        "album": album,
        "album_cover": None,
        "album_release_date": None,
        "genre": row.get("genre"),
        "label": label,
        "label_website": None,
        "duration_sec": (float(dur_ms) / 1000.0) if dur_ms else None,
        "year": int(row["p_line_year"]) if row.get("p_line_year") else None,
        "bpm": int(row["bpm"]) if row.get("bpm") is not None else None,
        "musical_key": row.get("musical_key"),
        "file_size": None,
        "preview_path": None,
        "type": row.get("type") or "electrobuzz",
        # extras for the promotion step; ignored by the matcher
        "isrc": row.get("isrc") or "",
        "album_artist": album_artist,
        "ingest_log_id": row.get("ingest_log_id"),
        "partner_id": row.get("partner_id"),
    }


def last_written_id_and_count(path: str) -> Tuple[int, int]:
    """Resume support, tolerating a truncated final line (same as the original exporter)."""
    if not os.path.exists(path):
        return 0, 0
    max_id, count = 0, 0
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.endswith("\n"):
                break
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            max_id = max(max_id, int(rec.get("id") or 0))
            count += 1
    return max_id, count


def _parse_ids(s: str) -> List[int]:
    out = []
    for part in s.split(","):
        part = part.strip()
        if part:
            out.append(int(part))
    if not out:
        raise argparse.ArgumentTypeError("at least one ingest log id is required")
    return out


async def export(args) -> int:
    from sqlalchemy import text  # noqa: E402
    from app.core.context import set_admin_context, set_current_partner_id  # noqa: E402
    from database.connection import AsyncSessionLocal  # noqa: E402

    # The tenancy failsafe injects partner_id into every ORM query; this is a deliberate
    # cross-partner read from an operator script, same as catalogue_high_water_mark.py.
    set_current_partner_id(None)
    set_admin_context(True)

    ids = args.ingest_log_ids
    placeholders = ", ".join(f":lid{i}" for i in range(len(ids)))
    params: Dict[str, Any] = {f"lid{i}": v for i, v in enumerate(ids)}
    params["pid"] = args.partner_id
    embedded_clause = "" if args.include_unembedded else "AND s.embedding_status = 'completed'"

    sql = text(f"""
        SELECT t.id, t.uuid, t.source_file_path, t.title, t.display_artist, t.duration_ms,
               t.isrc, t.bpm, t.musical_key, t.p_line_year, t.type, t.partner_id,
               s.ingest_log_id, g.name AS genre
        FROM tracks t
        JOIN track_processing_status s ON s.track_id = t.id
        LEFT JOIN genres g ON g.id = t.genre_id
        WHERE t.partner_id = :pid
          AND s.ingest_log_id IN ({placeholders})
          {embedded_clause}
          AND t.id > :after
        ORDER BY t.id
        LIMIT :page
    """)

    start_after, already = last_written_id_and_count(args.out)
    if already:
        print(f"Resuming export: {already} rows already written (after id {start_after}).")
    remaining = None if args.limit is None else max(0, args.limit - already)
    if remaining == 0:
        print(f"Target --limit {args.limit} already met ({already} rows). Nothing to do.")
        return 0

    written = 0
    after = start_after
    with open(args.out, "a", encoding="utf-8") as out:
        async with AsyncSessionLocal() as db:
            while True:
                page = args.page_size if remaining is None else min(args.page_size, remaining - written)
                if page <= 0:
                    break
                rows = (await db.execute(sql, {**params, "after": after, "page": page})).mappings().all()
                if not rows:
                    break
                for row in rows:
                    rec = record_from_row(dict(row))
                    out.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")
                    written += 1
                    after = rec["id"]
                    if written % PROGRESS_EVERY == 0:
                        out.flush()
                        print(f"  exported {already + written} rows (id {after})...", flush=True)
                if len(rows) < page:
                    break

    print(f"Done. Exported {written} new rows -> {args.out} (total {already + written}).")
    if written == 0 and already == 0:
        print("NOTHING EXPORTED. If the run finished on media but shows 0 embedded here, open the\n"
              "job in admin once (the poll applies per-track statuses) and re-run.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--partner-id", type=int, default=6)
    ap.add_argument("--ingest-log-ids", type=_parse_ids, default=[18, 19, 20],
                    help="Comma-separated ingest run ids to export (default 18,19,20).")
    ap.add_argument("--out", default=DEFAULT_OUT,
                    help=f"Output JSONL (default {os.path.basename(DEFAULT_OUT)} next to this script).")
    ap.add_argument("--include-unembedded", action="store_true",
                    help="Also export tracks whose embedding_status is not 'completed'.")
    ap.add_argument("--limit", type=int, default=None, help="Cap total rows in the output file.")
    ap.add_argument("--page-size", type=int, default=5000)
    args = ap.parse_args()

    legacy = os.path.join(SCRIPT_DIR, "tracks_input.jsonl")
    if os.path.abspath(args.out) == os.path.abspath(legacy):
        print(f"Refusing to write to {legacy}: that is the OLD catalogue's staging file. "
              f"Use a different --out.", file=sys.stderr)
        return 2
    return asyncio.run(export(args))


if __name__ == "__main__":
    raise SystemExit(main())
