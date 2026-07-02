"""
Export tracks from the DB to a streamable JSONL file — the INPUT for run_apple_matching.py.

One line per track: {id, uuid, file_path, title, artists, duration_sec}. This is the ONLY step that
touches the database; the matcher then runs purely off this file (no DB coupling, no 2.35M rows in
memory). Streams with a server-side cursor and writes incrementally, so it scales to the full
catalogue and is resumable (it continues after the largest id already written).

Staging: set LIMIT = 10000 for the first run. Full run: set LIMIT = None.

Requires: pip install pymysql python-dotenv
"""
import os
import json

import pymysql
from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SCRIPT_DIR, "..", ".env"))

DB_HOST = os.getenv("RESOMIX_DB_HOST", "localhost")
DB_PORT = int(os.getenv("RESOMIX_DB_PORT", "3306"))
DB_USER = os.getenv("RESOMIX_DB_USER", "")
DB_PASSWORD = os.getenv("RESOMIX_DB_PASSWORD", "")
DB_NAME = os.getenv("RESOMIX_DB_NAME", "resomix_db")

OUTPUT_JSONL = os.path.join(SCRIPT_DIR, "tracks_input.jsonl")
LIMIT = None           # full 2.35M run (was 10000 for staging)
PROGRESS_EVERY = 5000

QUERY = """
    SELECT t.id, t.uuid, t.file_path, t.title, t.year, t.duration_sec, t.bpm, t.musical_key,
           t.file_size, t.preview_path, t.type,
           alb.title AS album, alb.cover_image AS album_cover, alb.release_date AS album_release_date,
           g.name AS genre,
           l.name AS label, l.website AS label_website,
           GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', ') AS artists
    FROM tracks t
    LEFT JOIN albums alb ON t.album_id = alb.id
    LEFT JOIN genres g   ON t.genre_id = g.id
    LEFT JOIN labels l   ON t.label_id = l.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists a  ON ta.artist_id = a.id
    {where}
    GROUP BY t.id
    ORDER BY t.id
    {limit}
"""


def _num(v):
    return int(v) if v is not None else None


def connect():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD, database=DB_NAME,
        cursorclass=pymysql.cursors.SSDictCursor,   # server-side streaming cursor
    )


def last_written_id_and_count(path):
    """Resume support: return (max_id_written, line_count) from an existing output file, tolerating
    a truncated final line."""
    if not os.path.exists(path):
        return 0, 0
    max_id, count = 0, 0
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.endswith("\n"):
                break  # partial final line — ignore
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            max_id = max(max_id, int(rec.get("id") or 0))
            count += 1
    return max_id, count


def main():
    start_after, already = last_written_id_and_count(OUTPUT_JSONL)
    if already:
        print(f"Resuming export: {already} rows already written (after id {start_after}).")

    remaining = None if LIMIT is None else max(0, LIMIT - already)
    if remaining == 0:
        print(f"Target LIMIT={LIMIT} already met ({already} rows). Nothing to do.")
        return

    where = "WHERE t.id > %s" if start_after else ""
    limit = "" if remaining is None else f"LIMIT {remaining}"
    sql = QUERY.format(where=where, limit=limit)
    params = (start_after,) if start_after else ()

    conn = connect()
    written = 0
    try:
        with conn.cursor() as cur, open(OUTPUT_JSONL, "a", encoding="utf-8") as out:
            cur.execute(sql, params)
            while True:
                row = cur.fetchone()
                if row is None:
                    break
                dur = row.get("duration_sec")
                rec = {
                    "id": int(row["id"]),
                    "uuid": row.get("uuid") or "",
                    "file_path": row.get("file_path") or "",
                    # in-house metadata, straight from our DB
                    "title": row.get("title") or "",
                    "artists": row.get("artists") or "",
                    "album": row.get("album"),
                    "album_cover": row.get("album_cover"),
                    "album_release_date": row.get("album_release_date"),   # DATE -> str via default=
                    "genre": row.get("genre"),
                    "label": row.get("label"),
                    "label_website": row.get("label_website"),
                    "duration_sec": float(dur) if dur is not None else None,
                    "year": _num(row.get("year")),
                    "bpm": _num(row.get("bpm")),
                    "musical_key": row.get("musical_key"),
                    "file_size": _num(row.get("file_size")),
                    "preview_path": row.get("preview_path"),
                    "type": row.get("type"),
                }
                out.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")
                written += 1
                if written % PROGRESS_EVERY == 0:
                    out.flush()
                    print(f"  exported {already + written} rows (id {rec['id']})...")
    finally:
        conn.close()

    print(f"Done. Exported {written} new rows -> {OUTPUT_JSONL} (total {already + written}).")


if __name__ == "__main__":
    main()
