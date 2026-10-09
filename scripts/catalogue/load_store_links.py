#!/usr/bin/env python3
"""
Load outside store links (Traxsource now, Bandcamp later) into `track_store_links`.

The links come from the store matchers in the dj-sites-scraper repo, which keep the full store data
and the evidence for every match in their own SQLite files on Alwyzon. They hand over only what the
app shows, a gzipped TSV of `track_uuid<TAB>url` for the matched tracks:

    python match_traxsource.py export        # in dj-sites-scraper, writes traxsource_links.tsv.gz

This script maps each track_uuid to the track in the database it is pointed at (MARIA_DB_* in
.env, so staging or production), then upserts the store's column. Only catalogue tracks
(type 'electrobuzz') are linked; uuids the database does not have are counted and skipped, which is
normal (the master catalogue also holds tracks that never reached production).

USAGE (repo root, venv active)

    python scripts/catalogue/load_store_links.py traxsource ~/usman/catalogue/traxsource_links.tsv.gz           # dry run: counts only
    python scripts/catalogue/load_store_links.py traxsource ~/usman/catalogue/traxsource_links.tsv.gz --apply
    python scripts/catalogue/load_store_links.py traxsource links.tsv.gz --apply --clear-missing

--clear-missing empties this store's link on every track that is not in the file (for a re-run
after a re-match, so a link the matcher no longer stands behind disappears), then deletes rows left
with no link at all. Without it, links are only added or changed.

Needs the `track_store_links` table (alembic upgrade head). About 2M links load in a few minutes.
"""
from __future__ import annotations

import argparse
import gzip
import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

STORES = {
    # store -> (column, what every URL must start with)
    "traxsource": ("traxsource_url", ("https://www.traxsource.com/track/",)),
    "bandcamp": ("bandcamp_url", ("https://",)),   # artist and label pages can sit on custom domains
}
LOOKUP_CHUNK = 5000
WRITE_CHUNK = 2000


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _connect():
    import pymysql
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env")
    return pymysql.connect(
        host=os.getenv("MARIA_DB_HOST", "127.0.0.1"), port=int(os.getenv("MARIA_DB_PORT", "3306")),
        user=os.getenv("MARIA_DB_USER", ""), password=os.getenv("MARIA_DB_PASS", ""),
        database=os.getenv("MARIA_DB_NAME", "resomix_prod"), charset="utf8mb4",
        read_timeout=600, write_timeout=600,
    )


def read_links(path: Path, prefixes: tuple[str, ...]) -> tuple[dict[str, str], int]:
    """{track_uuid: url} from the TSV, and how many lines were rejected (bad URL or shape)."""
    links: dict[str, str] = {}
    bad = 0
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        if header[:2] != ["track_uuid", "url"]:
            raise SystemExit(f"{path}: expected a 'track_uuid<TAB>url' header, got {header}")
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 2 or len(parts[0]) != 36 or not parts[1].startswith(prefixes) or len(parts[1]) > 500:
                bad += 1
                continue
            links[parts[0]] = parts[1]
    return links, bad


def resolve_track_ids(cur, uuids: list[str]) -> dict[str, int]:
    """{track_uuid: tracks.id} for the catalogue tracks the database has."""
    out: dict[str, int] = {}
    for i in range(0, len(uuids), LOOKUP_CHUNK):
        chunk = uuids[i:i + LOOKUP_CHUNK]
        cur.execute(
            f"SELECT uuid, id FROM tracks WHERE type = 'electrobuzz' AND uuid IN ({','.join(['%s'] * len(chunk))})",
            chunk,
        )
        out.update({u: int(t) for u, t in cur.fetchall()})
    return out


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("store", choices=sorted(STORES))
    p.add_argument("links", type=Path, help="TSV (or .tsv.gz) with a 'track_uuid<TAB>url' header")
    p.add_argument("--apply", action="store_true", help="write to the database (default: dry run, counts only)")
    p.add_argument("--clear-missing", action="store_true",
                   help="also empty this store's link on tracks that are not in the file")
    args = p.parse_args()
    column, prefixes = STORES[args.store]

    links, bad = read_links(args.links.expanduser(), prefixes)
    log(f"{args.links}: {len(links):,} links, {bad:,} lines rejected")

    conn = _connect()
    cur = conn.cursor()
    cur.execute("SELECT DATABASE(), @@hostname")
    db_name, db_host = cur.fetchone()
    log(f"database {db_name} on {db_host}{'' if args.apply else ' (dry run, nothing is written)'}")

    cur.execute("SHOW TABLES LIKE 'track_store_links'")
    if not cur.fetchone():
        raise SystemExit("track_store_links does not exist here yet: run `alembic upgrade head` first")

    ids = resolve_track_ids(cur, list(links))
    log(f"{len(ids):,} of them are catalogue tracks in this database, {len(links) - len(ids):,} are not")

    cur.execute(f"SELECT COUNT(*) FROM track_store_links WHERE {column} IS NOT NULL")
    before = cur.fetchone()[0]
    log(f"{column} is set on {before:,} tracks now")

    if not args.apply:
        log("dry run finished; add --apply to write")
        return 0

    rows = [(tid, links[u]) for u, tid in ids.items()]
    sql = (f"INSERT INTO track_store_links (track_id, {column}) VALUES (%s, %s) "
           f"ON DUPLICATE KEY UPDATE {column} = VALUES({column})")
    for i in range(0, len(rows), WRITE_CHUNK):
        cur.executemany(sql, rows[i:i + WRITE_CHUNK])
        conn.commit()
        if (i // WRITE_CHUNK) % 100 == 0:
            log(f"  {min(i + WRITE_CHUNK, len(rows)):,} / {len(rows):,}")

    if args.clear_missing:
        cur.execute("CREATE TEMPORARY TABLE loaded_ids (track_id INT UNSIGNED PRIMARY KEY)")
        tids = [(tid,) for tid in ids.values()]
        for i in range(0, len(tids), WRITE_CHUNK):
            cur.executemany("INSERT INTO loaded_ids VALUES (%s)", tids[i:i + WRITE_CHUNK])
        cur.execute(f"""UPDATE track_store_links s LEFT JOIN loaded_ids l ON l.track_id = s.track_id
                        SET s.{column} = NULL WHERE s.{column} IS NOT NULL AND l.track_id IS NULL""")
        log(f"cleared {cur.rowcount:,} links no longer in the file")
        cur.execute("DELETE FROM track_store_links WHERE traxsource_url IS NULL AND bandcamp_url IS NULL")
        log(f"deleted {cur.rowcount:,} rows left with no link")
        conn.commit()

    cur.execute(f"SELECT COUNT(*) FROM track_store_links WHERE {column} IS NOT NULL")
    log(f"done: {column} is set on {cur.fetchone()[0]:,} tracks (was {before:,})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
