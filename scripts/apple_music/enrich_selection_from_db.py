"""
Enrich the EXISTING selection JSON with DB metadata — without changing the selection.

Standalone: reads DB creds from scripts/.env (one level up). Backs up the current
apple_music_tracks_selection.json (timestamped .bak), reads it (accepts a list of path strings
or already-enriched records), pulls title/artists/duration/genre/album from the DB per path, and
writes the enriched JSON back — preserving the exact set of tracks. After this the matcher runs
DB-free from the JSON.
"""
import os
import json
import shutil
import datetime

import pymysql
from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SCRIPT_DIR, "..", ".env"))

DB_HOST = os.getenv("RESOMIX_DB_HOST", "localhost")
DB_PORT = int(os.getenv("RESOMIX_DB_PORT", "3306"))
DB_USER = os.getenv("RESOMIX_DB_USER", "")
DB_PASSWORD = os.getenv("RESOMIX_DB_PASSWORD", "")
DB_NAME = os.getenv("RESOMIX_DB_NAME", "resomix_db")

JSON_FILE = os.path.join(SCRIPT_DIR, "apple_music_tracks_selection.json")

TRACK_METADATA_QUERY = """
    SELECT
        t.title, t.duration_sec, t.year,
        g.name AS genre,
        GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', ') AS artists,
        alb.title AS album
    FROM tracks t
    LEFT JOIN genres g ON t.genre_id = g.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists a ON ta.artist_id = a.id
    LEFT JOIN albums alb ON t.album_id = alb.id
    WHERE t.file_path = %s
    GROUP BY t.id
"""


def connect():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD, database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor,
    )


def build_record(file_path, meta):
    meta = meta or {}
    dur = meta.get("duration_sec")
    return {
        "file_path": file_path,
        "title": meta.get("title") or "",
        "artists": meta.get("artists") or "",
        "duration_sec": float(dur) if dur is not None else None,
        "genre": meta.get("genre") or "",
        "album": meta.get("album") or "",
        "year": meta.get("year"),
        "in_db": bool(meta),
    }


def load_paths(json_file):
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    paths = []
    for item in data:
        if isinstance(item, str):
            paths.append(item)
        elif isinstance(item, dict) and item.get("file_path"):
            paths.append(item["file_path"])
    return paths


def main():
    if not os.path.exists(JSON_FILE):
        print(f"ERROR: {JSON_FILE} not found.")
        return

    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"{JSON_FILE}.{stamp}.bak"
    shutil.copy2(JSON_FILE, backup)
    print(f"Backed up existing JSON -> {backup}")

    paths = load_paths(JSON_FILE)
    print(f"Loaded {len(paths)} paths.")

    records = []
    conn = connect()
    try:
        with conn.cursor() as cursor:
            for i, path in enumerate(paths, 1):
                cursor.execute(TRACK_METADATA_QUERY, (path,))
                records.append(build_record(path, cursor.fetchone()))
                if i % 25 == 0:
                    print(f"  Enriched {i}/{len(paths)}...")
    finally:
        conn.close()

    missing = sum(1 for r in records if not r["in_db"])
    no_dur = sum(1 for r in records if r["duration_sec"] is None)
    print(f"Enriched {len(records)} records — not in DB: {missing}, missing duration: {no_dur}.")

    with open(JSON_FILE, "w", encoding="utf-8") as out:
        json.dump(records, out, indent=4, ensure_ascii=False)
    print(f"Wrote enriched JSON -> {JSON_FILE}. Run: python scripts/apple_music/apple_music_test.py")


if __name__ == "__main__":
    main()
