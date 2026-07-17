#!/usr/bin/env python3
"""
Elasticsearch Reindex — Electrobuzz Catalogue
=============================================

Full, zero-downtime rebuild of the track search index from MariaDB.

Why full-rebuild-every-run (instead of an incremental cursor):
  * The public catalogue is ~2M rows / < 1 GB — a complete rebuild takes only a
    few minutes and is *always correct*: it naturally reflects new ingests, edited
    titles/artists, and retired (is_active=0) tracks with zero drift or delete
    bookkeeping. A 15-day cadence makes the cost negligible.

What it does:
  1. Create a fresh, time-stamped index (`tracks_search_v<stamp>`) with strict
     mappings, 1 shard / 0 replicas, and refresh disabled for a fast load.
  2. Stream electrobuzz + active + partner-1 rows via keyset pagination (raw SQL,
     Core connection — bypasses the ORM tenancy failsafe and is memory-flat).
  3. Bulk-index them.
  4. Re-enable refresh, then atomically repoint the `tracks_search` alias to the
     new index and delete the old one(s).

Only reads the DB and writes ES. Safe to re-run; a failed run leaves the live
alias untouched (it only swaps at the very end).

Usage:
    python -m scripts.es_reindex_tracks                 # full rebuild + swap
    python -m scripts.es_reindex_tracks --limit 500     # small test load
    python -m scripts.es_reindex_tracks --dry-run       # build docs, index nothing
    python -m scripts.es_reindex_tracks --no-swap       # load new index, keep alias
    python -m scripts.es_reindex_tracks --keep-old      # don't delete old indices

Init Date: July 17, 2026
Author: Muhammad Usman Naeem
"""

from __future__ import annotations

import argparse
import sys
import time
from typing import Any, Dict, Iterator, List, Optional

from sqlalchemy import text

from app.utils.es_index import (
    ALIAS,
    INDEX_PREFIX,
    build_track_doc,
    index_body,
    new_index_name,
    swap_alias,
)

# Electrobuzz catalogue filter — the only rows that belong in public search.
ROW_QUERY = text(
    """
    SELECT id, uuid, title, display_artist, type
    FROM tracks
    WHERE type = 'electrobuzz'
      AND is_active = 1
      AND partner_id = 1
      AND id > :last_id
    ORDER BY id
    LIMIT :batch
    """
)

COUNT_QUERY = text(
    "SELECT COUNT(*) FROM tracks "
    "WHERE type='electrobuzz' AND is_active=1 AND partner_id=1"
)


def _log(msg: str) -> None:
    print(f"[es-reindex] {msg}", flush=True)


def iter_rows(engine, batch: int, limit: Optional[int]) -> Iterator[Dict[str, Any]]:
    """Yield electrobuzz rows in id order via keyset pagination (flat memory)."""
    last_id = 0
    seen = 0
    while True:
        take = batch if limit is None else min(batch, limit - seen)
        if take <= 0:
            return
        with engine.connect() as conn:
            rows = conn.execute(
                ROW_QUERY, {"last_id": last_id, "batch": take}
            ).mappings().all()
        if not rows:
            return
        for r in rows:
            yield dict(r)
            last_id = r["id"]
        seen += len(rows)
        if len(rows) < take:
            return


def build_action(index_name: str, row: Dict[str, Any]) -> Dict[str, Any]:
    """Wrap a track row as an ES bulk index action (doc _id = uuid)."""
    doc = build_track_doc(
        uuid=row["uuid"],
        title=row["title"],
        display_artist=row.get("display_artist"),
        track_type=row.get("type") or "electrobuzz",
    )
    return {"_index": index_name, "_id": doc["uuid"], "_source": doc}


def _quiet_transport_logs() -> None:
    """Silence per-request INFO spam + the self-signed TLS warning (verify off)."""
    import logging
    logging.getLogger("elastic_transport").setLevel(logging.WARNING)
    try:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except Exception:
        pass


def run(limit: Optional[int], batch: int, dry_run: bool, no_swap: bool,
        keep_old: bool) -> int:
    _quiet_transport_logs()
    # Lazy imports so --help works without a live ES/DB.
    from app.utils.elasticsearch_utils import get_es_client
    from database.connection import engine

    with engine.connect() as conn:
        total = conn.execute(COUNT_QUERY).scalar() or 0
    target = total if limit is None else min(total, limit)
    _log(f"electrobuzz-active rows in DB: {total:,} | indexing target: {target:,}")

    if dry_run:
        n = 0
        sample: List[Dict[str, Any]] = []
        for row in iter_rows(engine, batch, limit):
            if n < 3:
                sample.append(build_action("DRYRUN", row)["_source"])
            n += 1
        _log(f"DRY RUN — built {n:,} docs, indexed 0. Sample docs:")
        import json
        for d in sample:
            _log("  " + json.dumps(d, ensure_ascii=False))
        return 0

    es = get_es_client()
    if not es.ping():
        _log("ERROR: cannot reach Elasticsearch (ping failed). Check ES_URL/creds.")
        return 2

    index_name = new_index_name()
    _log(f"creating index {index_name} (refresh disabled for bulk load)")
    es.indices.create(index=index_name, body=index_body(refresh_interval="-1"))

    started = time.perf_counter()
    indexed = 0
    errors = 0
    try:
        actions = (build_action(index_name, row) for row in iter_rows(engine, batch, limit))
        for ok, item in _streaming(es, actions, batch):
            if ok:
                indexed += 1
            else:
                errors += 1
                if errors <= 5:
                    _log(f"  bulk error: {item}")
            if indexed and indexed % 50000 == 0:
                rate = indexed / (time.perf_counter() - started)
                _log(f"  indexed {indexed:,}/{target:,} ({rate:,.0f} docs/s)")
    except Exception as e:  # noqa: BLE001 — surface, then clean up the half-built index
        _log(f"ERROR during bulk load: {type(e).__name__}: {e}")
        _log(f"deleting half-built index {index_name}")
        es.indices.delete(index=index_name, ignore_unavailable=True)
        return 3

    took = time.perf_counter() - started
    _log(f"bulk load done: {indexed:,} indexed, {errors:,} errors in {took:,.1f}s")

    # Re-enable refresh and make everything searchable.
    es.indices.put_settings(index=index_name, body={"index": {"refresh_interval": "30s"}})
    es.indices.refresh(index=index_name)
    count = es.count(index=index_name)["count"]
    _log(f"index {index_name} now holds {count:,} docs")

    if errors or count == 0:
        _log("WARNING: errors during load or empty index — NOT swapping the alias.")
        _log(f"Inspect {index_name} and re-run. Live search is unchanged.")
        return 4

    if no_swap:
        _log(f"--no-swap: leaving alias '{ALIAS}' untouched. New index: {index_name}")
        return 0

    _log(f"swapping alias '{ALIAS}' -> {index_name}")
    old = swap_alias(es, ALIAS, index_name)
    _log(f"alias now points at {index_name}. Previous indices: {old or 'none'}")

    if old and not keep_old:
        for idx in old:
            if idx.startswith(INDEX_PREFIX) or idx.startswith("tracks-"):
                _log(f"deleting old index {idx}")
                es.indices.delete(index=idx, ignore_unavailable=True)
    return 0


def _streaming(es, actions, batch):
    """Thin wrapper over helpers.streaming_bulk yielding (ok, info) per doc."""
    from elasticsearch.helpers import streaming_bulk
    for ok, info in streaming_bulk(
        es, actions, chunk_size=batch, raise_on_error=False, raise_on_exception=False
    ):
        yield ok, info


def main() -> int:
    p = argparse.ArgumentParser(description="Rebuild the electrobuzz ES search index.")
    p.add_argument("--limit", type=int, default=None, help="cap rows (testing)")
    p.add_argument("--batch-size", type=int, default=2000, help="bulk/page size")
    p.add_argument("--dry-run", action="store_true", help="build docs, index nothing")
    p.add_argument("--no-swap", action="store_true", help="load new index but keep alias")
    p.add_argument("--keep-old", action="store_true", help="do not delete old indices")
    args = p.parse_args()
    return run(args.limit, args.batch_size, args.dry_run, args.no_swap, args.keep_old)


if __name__ == "__main__":
    sys.exit(main())
