"""
Select a diverse baseline of tracks from the DB and write them (WITH metadata) to JSON.

Standalone: reads DB creds from scripts/.env (one level up). Streams every file_path
(server-side cursor, so 2.3M rows never load into memory), groups them by structural filename
pattern per target folder, picks 25 structurally-unique tracks per folder, then pulls each
selected track's metadata (title/artists/duration/genre/album) and writes a rich JSON list.
That JSON is the ONLY input the Apple Music matcher needs (it makes no DB calls).
"""
import os
import re
import json
import random

import pymysql
from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SCRIPT_DIR, "..", ".env"))

DB_HOST = os.getenv("RESOMIX_DB_HOST", "localhost")
DB_PORT = int(os.getenv("RESOMIX_DB_PORT", "3306"))
DB_USER = os.getenv("RESOMIX_DB_USER", "")
DB_PASSWORD = os.getenv("RESOMIX_DB_PASSWORD", "")
DB_NAME = os.getenv("RESOMIX_DB_NAME", "resomix_db")

OUTPUT_FILE = os.path.join(SCRIPT_DIR, "apple_music_tracks_selection.json")
PER_PATH = 25

PATHS = [
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/Dj_Chart",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/Electrobuzz_Music",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/LOSSLESS",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BUZZ_PLAYLIST",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/EXCLUSIVES/FRESH_Exclusives_(bonus_section)/BONUS_SECTION",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/EXCLUSIVES/Label_Discography_(bonus_section)",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/POPULAR/Shops_Section",
    "veggera/public_html/feelmusic_premium/PHONOTRAX/BASIC/Charts",
    "veggera/public_html/feelmusic_premium/PHONOTRAX/BASIC/Essential_House",
]

TRACK_METADATA_QUERY = """
    SELECT
        t.title, t.duration_sec, t.year,
        g.name AS genre,
        GROUP_CONCAT(DISTINCT a.name ORDER BY ta.id SEPARATOR ', ') AS artists,
        (SELECT r.title FROM release_tracks rt JOIN releases r ON rt.release_id = r.id
         WHERE rt.track_id = t.id LIMIT 1) AS album
    FROM tracks t
    LEFT JOIN genres g ON t.genre_id = g.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists a ON ta.artist_id = a.id
    WHERE t.file_path = %s
    GROUP BY t.id
"""


def connect(server_side=False):
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD, database=DB_NAME,
        cursorclass=pymysql.cursors.SSDictCursor if server_side else pymysql.cursors.DictCursor,
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


def get_format_pattern(filename):
    """Abstract a filename, e.g. '01. Artist - Title (Mix)' -> 'NN. A A - A A (A)'."""
    name = filename.rsplit('.', 1)[0]
    name = re.sub(r'[a-zA-Z]+', 'A', name)
    name = re.sub(r'[0-9]+', 'N', name)
    return name


def select_diverse_paths():
    collections = {p: {} for p in PATHS}
    print("Streaming file paths from DB (server-side cursor)...")
    conn = connect(server_side=True)
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT file_path FROM tracks")
            count = 0
            while True:
                row = cursor.fetchone()
                if not row:
                    break
                count += 1
                if count % 100000 == 0:
                    print(f"  Processed {count} rows...")
                full_path = row['file_path']
                for p in PATHS:
                    if full_path.startswith(p):
                        filename = full_path.split('/')[-1]
                        if filename.startswith("._"):  # ignore AppleDouble sidecar files
                            break
                        collections[p].setdefault(get_format_pattern(filename), []).append(full_path)
                        break
    finally:
        conn.close()

    print("Selecting structurally-diverse tracks...")
    selection = []
    for p in PATHS:
        patterns = list(collections[p].keys())
        random.shuffle(patterns)
        picked = []
        for pat in patterns:
            picked.append(random.choice(collections[p][pat]))
            if len(picked) == PER_PATH:
                break
        if len(picked) < PER_PATH:
            remaining = [t for pat in patterns for t in collections[p][pat] if t not in picked]
            random.shuffle(remaining)
            picked.extend(remaining[:PER_PATH - len(picked)])
        selection.extend(picked)
    print(f"Selected {len(selection)} paths.")
    return selection


def main():
    paths = select_diverse_paths()
    print("Fetching metadata for the selection...")
    records = []
    conn = connect(server_side=False)
    try:
        with conn.cursor() as cursor:
            for i, path in enumerate(paths, 1):
                cursor.execute(TRACK_METADATA_QUERY, (path,))
                records.append(build_record(path, cursor.fetchone()))
                if i % 25 == 0:
                    print(f"  Enriched {i}/{len(paths)}...")
    finally:
        conn.close()

    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        json.dump(records, out, indent=4, ensure_ascii=False)
    print(f"Output saved to {OUTPUT_FILE}. Run: python scripts/apple_music/apple_music_test.py")


if __name__ == '__main__':
    main()
