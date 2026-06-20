#!/usr/bin/env python3
"""
Open-tracks migration — Script 2 of 3: build the old→new uuid map (Alwyzon).
=============================================================================

After ingestion has run, every open track has a BRAND-NEW uuid in the DB. The old
embeddings on disk are named by the OLD uuid. To reuse them we need a map
``{old_uuid: new_uuid}``.

The link between the two is the **audio filename** (unique per track):
  • the old catalog json maps  old_uuid  → filename
  • the new DB maps             filename  → new_uuid   (Track ↔ AudioFile)

The join is **case-insensitive** on purpose: Script 1 lowercases the file
extension on upload (FOO.MP3 → FOO.mp3), so the DB filename won't byte-match the
old catalog's ``FOO.MP3``.

Reads the DB with raw SQL (the ORM is wrapped by the multi-tenancy guard, which
would reject a partner-scoped query without an active partner context). Quick to
run; not resumable because it doesn't need to be.

Usage
-----
    python scripts/build_uuid_map.py \
        --catalog /path/to/open_tracks.json \
        --partner-id 1 \
        --out uuid_map.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text


def _engine():
    user = os.getenv("MARIA_DB_USER", "resomix")
    pw = os.getenv("MARIA_DB_PASS", "")
    host = os.getenv("MARIA_DB_HOST", "127.0.0.1")
    port = os.getenv("MARIA_DB_PORT", "3306")
    db = os.getenv("MARIA_DB_NAME", "resomix_db")
    return create_engine(f"mysql+pymysql://{user}:{pw}@{host}:{port}/{db}", pool_pre_ping=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Build old→new uuid map from the DB + old catalog.")
    ap.add_argument("--catalog", required=True, help="Old open_tracks.json (has old uuid + filename)")
    ap.add_argument("--partner-id", type=int, default=1)
    ap.add_argument("--out", default="uuid_map.json")
    args = ap.parse_args()

    catalog_path = Path(args.catalog).expanduser()
    if not catalog_path.is_file():
        raise SystemExit(f"Catalog not found: {catalog_path}")

    # 1. new DB: filename(lower) → new_uuid
    eng = _engine()
    new_by_fn: dict[str, str] = {}
    dupe_fn = 0
    with eng.connect() as conn:
        rows = conn.execute(
            text("SELECT t.uuid AS new_uuid, af.original_filename AS fn "
                 "FROM tracks t JOIN audio_files af ON af.track_id = t.id "
                 "WHERE af.partner_id = :pid AND af.original_filename IS NOT NULL"),
            {"pid": args.partner_id},
        )
        for new_uuid, fn in rows:
            key = (fn or "").strip().lower()
            if not key:
                continue
            if key in new_by_fn:
                dupe_fn += 1
            new_by_fn[key] = new_uuid
    print(f"DB: {len(new_by_fn)} ingested track(s) for partner {args.partner_id}"
          + (f"  (⚠ {dupe_fn} duplicate filename(s))" if dupe_fn else ""))

    # 2. old catalog: old_uuid → filename ; join on lower(filename)
    with open(catalog_path, encoding="utf-8") as f:
        catalog = json.load(f)

    mapping: dict[str, str] = {}
    matched = unmatched = no_fn = 0
    unmatched_examples: list[str] = []
    for entry in catalog:
        old_uuid = entry.get("uuid")
        fn = (entry.get("filename") or "").strip()
        if not old_uuid or not fn:
            no_fn += 1
            continue
        new_uuid = new_by_fn.get(fn.lower())
        if new_uuid:
            mapping[old_uuid] = new_uuid
            matched += 1
        else:
            unmatched += 1
            if len(unmatched_examples) < 10:
                unmatched_examples.append(fn)

    # new tracks that have no old counterpart (will be embedded fresh later)
    mapped_new = set(mapping.values())
    new_without_old = sum(1 for u in new_by_fn.values() if u not in mapped_new)

    out = Path(args.out).expanduser()
    out.write_text(json.dumps(mapping, indent=0), encoding="utf-8")

    print(f"\nCatalog entries:        {len(catalog)}")
    print(f"Matched (old→new):      {matched}")
    print(f"Unmatched old tracks:   {unmatched}   (not ingested or filename mismatch)")
    print(f"Catalog rows w/o file:  {no_fn}")
    print(f"New tracks w/o old:     {new_without_old}   (will be embedded fresh in the embedding job)")
    if unmatched_examples:
        print("\nUnmatched examples (old catalog filenames not found in DB):")
        for e in unmatched_examples:
            print(f"  - {e}")
    print(f"\nWrote map: {out}  ({len(mapping)} pairs)")
    print("Next: copy this file to Hetzner and run Script 3 (migrate_embeddings.py).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
