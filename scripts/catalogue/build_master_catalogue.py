#!/usr/bin/env python3
"""
Build the master catalogue: one row for every Electrobuzz track Resomix has ingested, whether or
not it made it into production, with everything we know about it in one place.

It is the reference for the whole catalogue: identifying a track, comparing it with an outside
store (Traxsource, Bandcamp, ...), finding its original file, its preview, its Apple Music match
and its state in production. Rebuild it after an ingest; otherwise it does not change.

WHAT GOES IN (2,496,688 tracks as of October 2026)

  old_catalogue     The original Electrobuzz catalogue, `resomix_db` on Alwyzon (2,350,642). Read
                    from the Apple-matching files, which carry every column of that database plus
                    the Apple result. 1,986,509 of these are in production (partner 1); the rest
                    were never imported because Apple Music did not match them.
  ingest_2026_09    Files added to Electrobuzz up to 31 October 2025, ingested in September 2026
                    as runs 18, 19 and 20 (146,046). 87,593 now live on partner 1, the rest are
                    parked on partner 6.

  Left out on purpose: the 4,967 tracks of the partner-pipeline test (runs 11, 12, 13, 16), the
  retired open catalogue (type `open`) and user uploads.

SOURCES (all on Alwyzon, read only)

  scripts/apple_music/apple_matches.migrate.jsonl   old catalogue: in-house fields, Apple result,
                                                    track_uuid. (apple_matches.jsonl also works;
                                                    track_uuid is then computed.)
  scripts/apple_music/tracks_input.jsonl            old catalogue: only the old numeric id is used
  scripts/apple_music/apple_matches.partner6.jsonl  September ingest: Apple result, and the album
                                                    and label parsed from the release folder
  resomix_prod (MariaDB, MARIA_DB_* in .env)        tracks, track_processing_status,
                                                    apple_music_tracks, audio_files, genres

THE KEY

  track_uuid is the id production and the media server use. For the old catalogue it is
  uuid5(RESOMIX_NS, old object id) (see scripts/apple_music/add_track_uuid.py); for the September
  ingest it is the uuid production assigned. Every track has one, in production or not.

OUTPUT

  One SQLite file. Table `catalogue` (one row per track, columns documented in COLUMNS below),
  `build_meta` (when, from which inputs, totals) and `build_issues` (anything that did not
  reconcile, one row per track, for checking). The file is built under a temporary name and only
  replaces the previous one when the build has finished.

USAGE (on Alwyzon, repo root, venv active)

    python scripts/catalogue/build_master_catalogue.py build --out ~/usman/catalogue/master_catalogue.sqlite
    python scripts/catalogue/build_master_catalogue.py report --out ~/usman/catalogue/master_catalogue.sqlite

Takes about a quarter of an hour; production is only read (plain SELECTs, streamed).
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
APPLE_DIR = REPO_ROOT / "scripts" / "apple_music"

# Must match scripts/apple_music/add_track_uuid.py and the media backfill exactly.
RESOMIX_NS = uuid.UUID("5f7e3a2c-9b1d-4e6a-8c0f-2d4b6a8e1f3c")

SEPT_INGEST_LOG_IDS = (18, 19, 20)
PARTNERS = (1, 6)
PARTNERS_ROOT = "/srv/sftp/partners"
# The media server's own map lives in {PARTNERS_ROOT}/.partner_slugs.json on the media box.
PARTNER_SLUGS = {1: "000000000000", 4: "1d0ffc5112e2", 6: "b3a56a4e427d"}

BATCH = 10_000

# --- the output table ------------------------------------------------------------------------------

COLUMNS = [
    # (name, sqlite type, meaning)
    ("track_uuid", "TEXT PRIMARY KEY", "Resomix id, used by production and the media server"),
    ("source", "TEXT NOT NULL", "old_catalogue | ingest_2026_09"),
    # identity
    ("legacy_id", "INTEGER", "old resomix_db tracks.id"),
    ("legacy_uuid", "TEXT", "old resomix_db tracks.uuid (object id); names the legacy preview/peaks/HLS files"),
    ("prod_track_id", "INTEGER", "resomix_prod tracks.id, when in production"),
    ("isrc", "TEXT", "real ISRC: Apple's when matched, else production's unless synthetic (ZZ...)"),
    # the Electrobuzz original
    ("file_path", "TEXT", "path of the original file on the Electrobuzz source (veggera/...)"),
    ("file_size", "INTEGER", "bytes of the original file"),
    # our metadata
    ("title", "TEXT", "title as we hold it"),
    ("artists", "TEXT", "artists, comma-joined"),
    ("mix_name", "TEXT", "production mix_name, when set"),
    ("album", "TEXT", "release title (September ingest: parsed from the release folder)"),
    ("album_artist", "TEXT", "release artist (September ingest only, from the folder)"),
    ("album_cover", "TEXT", "old catalogue cover reference"),
    ("album_release_date", "TEXT", "YYYY-MM-DD"),
    ("label", "TEXT", "record label (September ingest: parsed from the release folder)"),
    ("label_website", "TEXT", ""),
    ("genre", "TEXT", ""),
    ("year", "INTEGER", ""),
    ("duration_sec", "REAL", "our duration, seconds"),
    ("bpm", "INTEGER", ""),
    ("musical_key", "TEXT", ""),
    # Apple Music
    ("apple_status", "TEXT", "matched | rejected | unconfirmed (candidates, no duration to confirm) | no_candidate | not_checked"),
    ("apple_song_id", "TEXT", ""),
    ("apple_isrc", "TEXT", ""),
    ("apple_name", "TEXT", ""),
    ("apple_artist", "TEXT", ""),
    ("apple_album", "TEXT", ""),
    ("apple_genres", "TEXT", "pipe-joined"),
    ("apple_release_date", "TEXT", ""),
    ("apple_duration_ms", "INTEGER", ""),
    ("apple_preview_url", "TEXT", ""),
    ("apple_artwork_url", "TEXT", ""),
    ("apple_deep_link_url", "TEXT", ""),
    ("apple_song_url", "TEXT", ""),
    ("apple_match_score", "REAL", "production apple_music_tracks.match_score"),
    ("apple_review_json", "TEXT", "best candidate Apple returned, kept even when rejected"),
    # production
    ("in_production", "INTEGER NOT NULL", "1 when a resomix_prod track exists for this uuid"),
    ("prod_partner_id", "INTEGER", "1 = live catalogue, 6 = parked September tracks"),
    ("prod_active", "INTEGER", ""),
    ("prod_type", "TEXT", ""),
    ("prod_isrc", "TEXT", "tracks.isrc as stored, synthetic ones included"),
    ("prod_ingest_log_id", "INTEGER", "track_processing_status.ingest_log_id"),
    ("transcode_status", "TEXT", ""),
    ("embedding_status", "TEXT", ""),
    ("peaks_status", "TEXT", ""),
    ("segments_status", "TEXT", ""),
    ("faiss_indexed", "INTEGER", ""),
    ("prod_created_at", "TEXT", ""),
    # media
    ("legacy_preview_path", "TEXT", "old catalogue preview path as stored in resomix_db"),
    ("media_partner_slug", "TEXT", "folder of the partner holding the audio on the media box"),
    ("media_master_path", "TEXT", "absolute path of the master on the media box"),
    ("media_preview_path", "TEXT", "absolute path of the 128 kbps preview on the media box"),
    ("built_at", "TEXT NOT NULL", "when this row was built"),
]
COLUMN_NAMES = [c[0] for c in COLUMNS]


def uuid_for(object_id: str) -> str:
    return str(uuid.uuid5(RESOMIX_NS, object_id))


def log(msg: str) -> None:
    print(f"{datetime.now().strftime('%H:%M:%S')}  {msg}", flush=True)


# --- staging: JSONL ------------------------------------------------------------------------------

def _n(v):
    """Blank text means unknown; store it as NULL so 'how many have a label' counts are honest."""
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def _review(r: dict):
    """The best Apple candidate, kept only when Apple actually returned one."""
    rv = r.get("review")
    return json.dumps(rv, ensure_ascii=False) if rv and rv.get("best_candidate_id") else None


def _apple_status(is_match, review) -> str:
    if is_match == "True":
        return "matched"
    if is_match == "False":
        return "rejected"
    if review and review.get("best_candidate_id"):
        return "unconfirmed"
    return "no_candidate"


def _apple_cols(apple: dict | None) -> tuple:
    a = apple or {}
    genres = a.get("genres")
    if isinstance(genres, list):
        genres = " | ".join(str(g) for g in genres)
    return tuple(_n(v) for v in (
        a.get("song_id"), a.get("isrc"), a.get("name"), a.get("artist"), a.get("album"),
        genres, a.get("release_date"), a.get("duration_ms"), a.get("preview_url"), a.get("artwork_url"),
        a.get("deep_link_url"), a.get("song_url"),
    ))


def _lines(path: Path):
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.endswith("\n"):
                log(f"  {path.name}: ignoring a truncated last line ({n})")
                break
            yield n, json.loads(line)


def stage_old(db: sqlite3.Connection, matches: Path, inputs: Path) -> dict:
    db.execute("""CREATE TABLE stg_legacy_id (legacy_uuid TEXT PRIMARY KEY, legacy_id INTEGER)""")
    rows, n = [], 0
    for n, r in _lines(inputs):
        rows.append((r["uuid"], int(r["id"])))
        if len(rows) >= BATCH:
            db.executemany("INSERT OR IGNORE INTO stg_legacy_id VALUES (?,?)", rows)
            rows.clear()
        if n % 500_000 == 0:
            log(f"  {inputs.name}: {n:,}")
    db.executemany("INSERT OR IGNORE INTO stg_legacy_id VALUES (?,?)", rows)
    log(f"  {inputs.name}: {n:,} old ids")

    db.execute("""CREATE TABLE stg_old (
        track_uuid TEXT PRIMARY KEY, legacy_uuid TEXT, file_path TEXT, apple_status TEXT,
        title TEXT, artists TEXT, album TEXT, album_cover TEXT, album_release_date TEXT, genre TEXT,
        label TEXT, label_website TEXT, duration_sec REAL, year INTEGER, bpm INTEGER, musical_key TEXT,
        file_size INTEGER, preview_path TEXT,
        a_song_id TEXT, a_isrc TEXT, a_name TEXT, a_artist TEXT, a_album TEXT, a_genres TEXT,
        a_release_date TEXT, a_duration_ms INTEGER, a_preview_url TEXT, a_artwork_url TEXT,
        a_deep_link_url TEXT, a_song_url TEXT, review_json TEXT)""")
    mismatched = dupes = 0
    rows, n = [], 0
    for n, r in _lines(matches):
        computed = uuid_for(r["uuid"])
        tu = r.get("track_uuid") or computed
        if tu != computed:
            mismatched += 1
            db.execute("INSERT INTO build_issues VALUES (?,?,?,?)",
                       ("track_uuid_mismatch", tu, None, f"file says {tu}, uuid5 of {r['uuid']} is {computed}"))
        ih = r.get("in_house") or {}
        rows.append((
            tu, r["uuid"], _n(r.get("file_path")), _apple_status(r.get("is_match"), r.get("review")),
            *(_n(ih.get(k)) for k in ("title", "artists", "album", "album_cover", "album_release_date",
                                       "genre", "label", "label_website", "duration_sec", "year", "bpm",
                                       "musical_key", "file_size", "preview_path")),
            *_apple_cols(r.get("apple_music")),
            _review(r),
        ))
        if len(rows) >= BATCH:
            dupes += _insert_counting_dupes(db, "stg_old", rows, 31)
            rows.clear()
        if n % 250_000 == 0:
            log(f"  {matches.name}: {n:,}")
    dupes += _insert_counting_dupes(db, "stg_old", rows, 31)
    log(f"  {matches.name}: {n:,} old catalogue tracks")
    return {"old_rows_read": n, "old_uuid_mismatches": mismatched, "old_duplicate_uuids": dupes}


def stage_sept(db: sqlite3.Connection, matches: Path | None) -> dict:
    db.execute("""CREATE TABLE stg_sept (
        uuid TEXT PRIMARY KEY, apple_status TEXT, album TEXT, album_artist TEXT, label TEXT,
        a_song_id TEXT, a_isrc TEXT, a_name TEXT, a_artist TEXT, a_album TEXT, a_genres TEXT,
        a_release_date TEXT, a_duration_ms INTEGER, a_preview_url TEXT, a_artwork_url TEXT,
        a_deep_link_url TEXT, a_song_url TEXT, review_json TEXT)""")
    if matches is None:
        log("  September Apple results: skipped (--sept-matches '')")
        return {"sept_apple_rows_read": 0}
    rows, n = [], 0
    for n, r in _lines(matches):
        ih = r.get("in_house") or {}
        rows.append((
            r["uuid"], _apple_status(r.get("is_match"), r.get("review")),
            _n(ih.get("album")), _n(ih.get("album_artist")), _n(ih.get("label")),
            *_apple_cols(r.get("apple_music")),
            _review(r),
        ))
        if len(rows) >= BATCH:
            db.executemany(f"INSERT OR IGNORE INTO stg_sept VALUES ({','.join('?' * 18)})", rows)
            rows.clear()
    db.executemany(f"INSERT OR IGNORE INTO stg_sept VALUES ({','.join('?' * 18)})", rows)
    log(f"  {matches.name}: {n:,} September Apple results")
    return {"sept_apple_rows_read": n}


def _insert_counting_dupes(db, table, rows, width) -> int:
    before = db.total_changes
    db.executemany(f"INSERT OR IGNORE INTO {table} VALUES ({','.join('?' * width)})", rows)
    return len(rows) - (db.total_changes - before)


# --- staging: production ---------------------------------------------------------------------------

PROD_SQL = """
SELECT t.id, t.uuid, t.partner_id, t.type, t.is_active, t.isrc, t.title, t.display_artist,
       t.mix_name, t.duration_ms, t.bpm, t.musical_key, t.p_line_year, t.proprietary_id,
       t.source_file_path, t.created_at, g.name AS genre,
       s.ingest_log_id, s.transcode_status, s.embedding_status, s.peaks_status, s.segments_status,
       s.faiss_indexed,
       am.apple_song_id, am.isrc AS apple_isrc, am.name AS apple_name, am.artist AS apple_artist,
       am.album AS apple_album, am.genres AS apple_genres, am.release_date AS apple_release_date,
       am.duration_ms AS apple_duration_ms, am.artwork_url, am.preview_url, am.deep_link_url,
       am.match_score
FROM tracks t
LEFT JOIN genres g ON g.id = t.genre_id
LEFT JOIN track_processing_status s ON s.track_id = t.id
LEFT JOIN apple_music_tracks am ON am.track_id = t.id
WHERE t.type = 'electrobuzz' AND t.partner_id IN ({partners})
"""

AUDIO_SQL = """
SELECT a.track_id, a.asset_class, a.stored_path, a.partner_id, a.file_size_bytes
FROM audio_files a JOIN tracks t ON t.id = a.track_id
WHERE t.type = 'electrobuzz' AND t.partner_id IN ({partners})
  AND a.asset_class IN ('Master', 'StreamingProfile')
ORDER BY a.id
"""


def _connect_prod():
    import pymysql
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env")
    return pymysql.connect(
        host=os.getenv("MARIA_DB_HOST", "127.0.0.1"), port=int(os.getenv("MARIA_DB_PORT", "3306")),
        user=os.getenv("MARIA_DB_USER", ""), password=os.getenv("MARIA_DB_PASS", ""),
        database=os.getenv("MARIA_DB_NAME", "resomix_prod"), charset="utf8mb4",
        cursorclass=pymysql.cursors.SSCursor, read_timeout=3600, write_timeout=60,
    )


def _s(v):
    """MariaDB values to what SQLite stores: dates to ISO text, decimals to float, blanks to NULL."""
    if isinstance(v, str):
        return v.strip() or None
    if v is None or isinstance(v, (int, float)):
        return v
    if hasattr(v, "isoformat"):
        return v.isoformat()
    try:
        return float(v)
    except (TypeError, ValueError):
        return str(v)


def stage_prod(db: sqlite3.Connection, partners: tuple[int, ...]) -> dict:
    db.execute("""CREATE TABLE stg_prod (
        id INTEGER PRIMARY KEY, uuid TEXT, partner_id INTEGER, type TEXT, is_active INTEGER, isrc TEXT,
        title TEXT, display_artist TEXT, mix_name TEXT, duration_ms INTEGER, bpm INTEGER,
        musical_key TEXT, p_line_year INTEGER, proprietary_id TEXT, source_file_path TEXT,
        created_at TEXT, genre TEXT, ingest_log_id INTEGER, transcode_status TEXT,
        embedding_status TEXT, peaks_status TEXT, segments_status TEXT, faiss_indexed INTEGER,
        apple_song_id TEXT, apple_isrc TEXT, apple_name TEXT, apple_artist TEXT, apple_album TEXT,
        apple_genres TEXT, apple_release_date TEXT, apple_duration_ms INTEGER, artwork_url TEXT,
        preview_url TEXT, deep_link_url TEXT, match_score REAL)""")
    db.execute("""CREATE TABLE stg_audio (
        track_id INTEGER, asset_class TEXT, stored_path TEXT, partner_id INTEGER, size INTEGER,
        PRIMARY KEY (track_id, asset_class))""")
    in_list = ",".join(str(int(p)) for p in partners)
    conn = _connect_prod()
    dup_rows = 0
    try:
        with conn.cursor() as cur:
            cur.execute(PROD_SQL.format(partners=in_list))
            n = 0
            while True:
                chunk = cur.fetchmany(BATCH)
                if not chunk:
                    break
                before = db.total_changes
                # One processing-status / Apple row per track is expected; a second one would
                # duplicate the track, so the first wins and the rest are counted.
                db.executemany(f"INSERT OR IGNORE INTO stg_prod VALUES ({','.join('?' * 35)})",
                               [tuple(_s(v) for v in row) for row in chunk])
                dup_rows += len(chunk) - (db.total_changes - before)
                n += len(chunk)
                if n % 500_000 < BATCH:
                    log(f"  production tracks: {n:,}")
            log(f"  production tracks: {n:,} rows read, {dup_rows:,} extra join rows ignored")
        with conn.cursor() as cur:
            cur.execute(AUDIO_SQL.format(partners=in_list))
            m = 0
            while True:
                chunk = cur.fetchmany(BATCH)
                if not chunk:
                    break
                db.executemany("INSERT OR IGNORE INTO stg_audio VALUES (?,?,?,?,?)",
                               [tuple(_s(v) for v in row) for row in chunk])
                m += len(chunk)
            log(f"  production audio files: {m:,}")
    finally:
        conn.close()
    db.execute("CREATE INDEX stg_prod_uuid ON stg_prod(uuid)")
    return {"prod_rows_read": n, "prod_extra_join_rows": dup_rows}


# --- the join --------------------------------------------------------------------------------------

def _slug_case(col: str) -> str:
    whens = " ".join(f"WHEN {pid} THEN '{slug}'" for pid, slug in PARTNER_SLUGS.items())
    return f"CASE {col} {whens} END"


def _media_path(alias: str) -> str:
    return (f"CASE WHEN {alias}.stored_path IS NULL OR {_slug_case(alias + '.partner_id')} IS NULL THEN NULL "
            f"ELSE '{PARTNERS_ROOT}/' || {_slug_case(alias + '.partner_id')} || '/' || {alias}.stored_path END")


def _real_isrc(expr: str) -> str:
    return f"CASE WHEN {expr} IS NULL OR {expr} = '' OR {expr} LIKE 'ZZ%' THEN NULL ELSE {expr} END"


def build_catalogue(db: sqlite3.Connection, sept_logs: tuple[int, ...], built_at: str) -> None:
    db.execute(f"CREATE TABLE catalogue ({', '.join(f'{n} {t}' for n, t, _ in COLUMNS)})")
    cols = ", ".join(COLUMN_NAMES)
    media = f"""
        {_slug_case('COALESCE(ma.partner_id, pv.partner_id)')},
        {_media_path('ma')}, {_media_path('pv')}"""
    prod = """
        CASE WHEN p.id IS NULL THEN 0 ELSE 1 END, p.partner_id, p.is_active, p.type, p.isrc,
        p.ingest_log_id, p.transcode_status, p.embedding_status, p.peaks_status, p.segments_status,
        p.faiss_indexed, p.created_at"""
    audio_joins = """
        LEFT JOIN stg_audio ma ON ma.track_id = p.id AND ma.asset_class = 'Master'
        LEFT JOIN stg_audio pv ON pv.track_id = p.id AND pv.asset_class = 'StreamingProfile'"""

    log("  joining the old catalogue")
    db.execute(f"""
        INSERT INTO catalogue ({cols})
        SELECT o.track_uuid, 'old_catalogue', l.legacy_id, o.legacy_uuid, p.id,
               COALESCE({_real_isrc('o.a_isrc')}, {_real_isrc('p.apple_isrc')}, {_real_isrc('p.isrc')}),
               o.file_path, o.file_size,
               o.title, o.artists, p.mix_name, o.album, NULL, o.album_cover, o.album_release_date,
               o.label, o.label_website, o.genre, o.year, o.duration_sec, o.bpm, o.musical_key,
               o.apple_status,
               COALESCE(o.a_song_id, p.apple_song_id), COALESCE(o.a_isrc, p.apple_isrc),
               COALESCE(o.a_name, p.apple_name), COALESCE(o.a_artist, p.apple_artist),
               COALESCE(o.a_album, p.apple_album), COALESCE(o.a_genres, p.apple_genres),
               COALESCE(o.a_release_date, p.apple_release_date),
               COALESCE(o.a_duration_ms, p.apple_duration_ms), COALESCE(o.a_preview_url, p.preview_url),
               COALESCE(o.a_artwork_url, p.artwork_url), COALESCE(o.a_deep_link_url, p.deep_link_url),
               o.a_song_url, p.match_score, o.review_json,
               {prod},
               o.preview_path, {media},
               '{built_at}'
        FROM stg_old o
        LEFT JOIN stg_legacy_id l ON l.legacy_uuid = o.legacy_uuid
        LEFT JOIN stg_prod p ON p.uuid = o.track_uuid
        {audio_joins}""")

    log("  joining the September 2026 ingest")
    logs = ",".join(str(int(x)) for x in sept_logs)
    db.execute(f"""
        INSERT INTO catalogue ({cols})
        SELECT p.uuid, 'ingest_2026_09', NULL, NULL, p.id,
               COALESCE({_real_isrc('s.a_isrc')}, {_real_isrc('p.apple_isrc')}, {_real_isrc('p.isrc')}),
               p.source_file_path, ma.size,
               p.title, p.display_artist, p.mix_name, s.album, s.album_artist, NULL, NULL,
               s.label, NULL, p.genre, p.p_line_year,
               CASE WHEN p.duration_ms IS NULL THEN NULL ELSE p.duration_ms / 1000.0 END,
               p.bpm, p.musical_key,
               COALESCE(s.apple_status, CASE WHEN p.apple_song_id IS NOT NULL THEN 'matched' ELSE 'not_checked' END),
               COALESCE(s.a_song_id, p.apple_song_id), COALESCE(s.a_isrc, p.apple_isrc),
               COALESCE(s.a_name, p.apple_name), COALESCE(s.a_artist, p.apple_artist),
               COALESCE(s.a_album, p.apple_album), COALESCE(s.a_genres, p.apple_genres),
               COALESCE(s.a_release_date, p.apple_release_date),
               COALESCE(s.a_duration_ms, p.apple_duration_ms), COALESCE(s.a_preview_url, p.preview_url),
               COALESCE(s.a_artwork_url, p.artwork_url), COALESCE(s.a_deep_link_url, p.deep_link_url),
               s.a_song_url, p.match_score, s.review_json,
               {prod},
               NULL, {media},
               '{built_at}'
        FROM stg_prod p
        LEFT JOIN stg_sept s ON s.uuid = p.uuid
        {audio_joins}
        WHERE p.ingest_log_id IN ({logs})
          AND NOT EXISTS (SELECT 1 FROM catalogue c WHERE c.track_uuid = p.uuid)""")

    log("  indexing")
    for col in ("source", "legacy_uuid", "legacy_id", "prod_track_id", "isrc", "apple_song_id",
                "file_path", "in_production", "apple_status"):
        db.execute(f"CREATE INDEX catalogue_{col} ON catalogue({col})")


def record_issues(db: sqlite3.Connection) -> None:
    # Apple accepted it, so it should have been imported, but production has no such track.
    db.execute("""
        INSERT INTO build_issues
        SELECT 'matched_not_in_production', track_uuid, NULL, legacy_uuid
        FROM catalogue WHERE source = 'old_catalogue' AND apple_status = 'matched' AND in_production = 0""")
    # Production Electrobuzz tracks that neither source explains (the pipeline test is expected).
    db.execute("""
        INSERT INTO build_issues
        SELECT CASE WHEN p.ingest_log_id IN (11, 12, 13, 16) THEN 'prod_pipeline_test_excluded'
                    ELSE 'prod_track_not_in_catalogue' END,
               p.uuid, p.id, 'partner ' || p.partner_id || ', ingest log ' || COALESCE(p.ingest_log_id, '-')
        FROM stg_prod p
        WHERE NOT EXISTS (SELECT 1 FROM catalogue c WHERE c.track_uuid = p.uuid)""")
    # September tracks production holds but the Apple run never saw (not embedded at export time).
    db.execute("""
        INSERT INTO build_issues
        SELECT 'sept_not_apple_checked', track_uuid, prod_track_id, embedding_status
        FROM catalogue WHERE source = 'ingest_2026_09' AND apple_status = 'not_checked'""")


# --- report ----------------------------------------------------------------------------------------

def report(db: sqlite3.Connection) -> str:
    q = lambda sql: db.execute(sql).fetchall()
    out = []
    total = q("SELECT COUNT(*) FROM catalogue")[0][0]
    out.append(f"tracks in the master catalogue: {total:,}")
    for src, n, prod, active in q("""SELECT source, COUNT(*), SUM(in_production), SUM(prod_active = 1)
                                     FROM catalogue GROUP BY source ORDER BY source"""):
        out.append(f"  {src:15} {n:>10,}   in production {prod or 0:>10,}   active {active or 0:>10,}")
    out.append("Apple Music:")
    for st, n in q("SELECT apple_status, COUNT(*) FROM catalogue GROUP BY apple_status ORDER BY 2 DESC"):
        out.append(f"  {st:15} {n:>10,}")
    out.append("production partner of the tracks in production:")
    for pid, n in q("SELECT prod_partner_id, COUNT(*) FROM catalogue WHERE in_production = 1 GROUP BY 1"):
        out.append(f"  partner {pid}       {n:>10,}")
    filled = q("""SELECT SUM(file_path IS NOT NULL), SUM(duration_sec IS NOT NULL), SUM(isrc IS NOT NULL),
                         SUM(label IS NOT NULL), SUM(media_preview_path IS NOT NULL),
                         SUM(legacy_preview_path IS NOT NULL) FROM catalogue""")[0]
    labels = ("file path", "duration", "real ISRC", "label", "media preview", "legacy preview")
    out.append("filled in: " + ", ".join(f"{l} {v or 0:,}" for l, v in zip(labels, filled)))
    out.append("issues (see table build_issues):")
    rows = q("SELECT kind, COUNT(*) FROM build_issues GROUP BY kind ORDER BY kind")
    for kind, n in rows or [("none", 0)]:
        out.append(f"  {kind:30} {n:>8,}")
    return "\n".join(out)


# --- main ------------------------------------------------------------------------------------------

def _file_info(path: Path | None) -> dict:
    if path is None:
        return {}
    st = path.stat()
    return {"path": str(path), "bytes": st.st_size,
            "modified": datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat()}


def build(args) -> int:
    out = Path(args.out).expanduser().resolve()
    old_matches = Path(args.old_matches)
    old_input = Path(args.old_input)
    sept = Path(args.sept_matches) if args.sept_matches else None
    for p in (old_matches, old_input) + ((sept,) if sept else ()):
        if not p.exists():
            print(f"missing input: {p}", file=sys.stderr)
            return 2
    if out.exists() and not args.force:
        print(f"{out} exists; pass --force to rebuild it", file=sys.stderr)
        return 2

    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(out.name + ".building")
    tmp.unlink(missing_ok=True)
    db = sqlite3.connect(tmp)
    # A build is all-or-nothing and can be repeated, so durability during it buys nothing.
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("PRAGMA synchronous=OFF")
    db.execute("PRAGMA temp_store=FILE")
    db.execute("CREATE TABLE build_issues (kind TEXT, track_uuid TEXT, prod_track_id INTEGER, detail TEXT)")
    db.execute("CREATE TABLE build_meta (key TEXT PRIMARY KEY, value TEXT)")

    started = time.monotonic()
    built_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    sept_logs = tuple(args.sept_ingest_logs)
    partners = tuple(args.partners)
    counts = {}
    log("1/4 old catalogue files")
    counts.update(stage_old(db, old_matches, old_input))
    log("2/4 September Apple results")
    counts.update(stage_sept(db, sept))
    log("3/4 production (read only)")
    counts.update(stage_prod(db, partners))
    log("4/4 building the catalogue")
    build_catalogue(db, sept_logs, built_at)
    record_issues(db)

    if not args.keep_staging:
        for t in ("stg_legacy_id", "stg_old", "stg_sept", "stg_prod", "stg_audio"):
            db.execute(f"DROP TABLE {t}")
    meta = {
        "built_at": built_at,
        "script": "scripts/catalogue/build_master_catalogue.py",
        "inputs": {"old_matches": _file_info(old_matches), "old_input": _file_info(old_input),
                   "sept_matches": _file_info(sept),
                   "production": {"database": os.getenv("MARIA_DB_NAME"), "partners": partners,
                                  "sept_ingest_logs": sept_logs}},
        "partner_slugs": PARTNER_SLUGS,
        "counts": counts,
        "columns": {n: d for n, _, d in COLUMNS},
        "sqlite": sqlite3.sqlite_version,
    }
    db.executemany("INSERT OR REPLACE INTO build_meta VALUES (?, ?)",
                   [(k, json.dumps(v, ensure_ascii=False, default=str)) for k, v in meta.items()])
    text = report(db)
    db.execute("INSERT OR REPLACE INTO build_meta VALUES ('report', ?)", (json.dumps(text),))
    db.commit()
    log("compacting")
    db.execute("VACUUM")
    db.close()
    os.replace(tmp, out)
    log(f"done in {(time.monotonic() - started) / 60:.1f} min -> {out} ({out.stat().st_size / 1e9:.2f} GB)")
    print("\n" + text)
    return 0


def show_report(args) -> int:
    out = Path(args.out).expanduser()
    if not out.exists():
        print(f"{out} does not exist", file=sys.stderr)
        return 2
    db = sqlite3.connect(f"file:{out}?mode=ro", uri=True)
    built = db.execute("SELECT value FROM build_meta WHERE key = 'built_at'").fetchone()
    print(f"built at {json.loads(built[0]) if built else '?'}")
    print(report(db))
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("command", choices=["build", "report"])
    p.add_argument("--out", default="~/usman/catalogue/master_catalogue.sqlite")
    p.add_argument("--old-matches", default=str(APPLE_DIR / "apple_matches.migrate.jsonl"))
    p.add_argument("--old-input", default=str(APPLE_DIR / "tracks_input.jsonl"))
    p.add_argument("--sept-matches", default=str(APPLE_DIR / "apple_matches.partner6.jsonl"),
                   help="'' to build without the September Apple results")
    p.add_argument("--sept-ingest-logs", type=lambda s: [int(x) for x in s.split(",") if x.strip()],
                   default=list(SEPT_INGEST_LOG_IDS))
    p.add_argument("--partners", type=lambda s: [int(x) for x in s.split(",") if x.strip()],
                   default=list(PARTNERS))
    p.add_argument("--keep-staging", action="store_true", help="keep the stg_* tables for debugging")
    p.add_argument("--force", action="store_true", help="replace an existing output file")
    args = p.parse_args()
    return build(args) if args.command == "build" else show_report(args)


if __name__ == "__main__":
    sys.exit(main())
