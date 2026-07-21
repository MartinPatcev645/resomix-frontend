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
     Core connection — bypasses the ORM tenancy failsafe and is memory-flat),
     LEFT JOINed to `apple_music_tracks`: the indexed title/artist are the
     DISPLAY names (Apple `name`/`artist` win whenever the track plays from an
     Apple preview, in-house otherwise — the same merge policy the playlist
     responses use, see PLAYBACK_APPLE_MUSIC_PLAN.md §6). Differing in-house
     spellings are kept as recall terms in `all_text`.
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
    resolve_display_names,
    swap_alias,
)

# Electrobuzz catalogue filter — the only rows that belong in public search.
# apple_music_tracks joins 1:1 (unique track_id), so no row multiplication; the Apple
# name/artist become the indexed display fields whenever the track plays from an Apple
# preview (same policy as the playlist responses — see resolve_display_names).
ROW_QUERY = text(
    """
    SELECT t.id, t.uuid, t.title, t.display_artist, t.type,
           amt.name        AS apple_name,
           amt.artist      AS apple_artist,
           amt.preview_url AS apple_preview
    FROM tracks t
    LEFT JOIN apple_music_tracks amt ON amt.track_id = t.id
    WHERE t.type = 'electrobuzz'
      AND t.is_active = 1
      AND t.partner_id = 1
      AND t.id > :last_id
    ORDER BY t.id
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
    """Wrap a track row as an ES bulk index action (doc _id = uuid).

    The indexed title/artist are the DISPLAY names (Apple-first, same policy as the playlist
    responses). When Apple wins and the in-house spelling differs, the in-house title/artist are
    kept as extra recall terms in ``all_text`` so old spellings still match.
    """
    title, display_artist = resolve_display_names(
        row["title"], row.get("display_artist"),
        row.get("apple_name"), row.get("apple_artist"), row.get("apple_preview"),
    )
    extra_parts = []
    if title != row["title"] and row["title"]:
        extra_parts.append(row["title"])
    if display_artist != row.get("display_artist") and row.get("display_artist"):
        extra_parts.append(row["display_artist"])
    doc = build_track_doc(
        uuid=row["uuid"],
        title=title,
        display_artist=display_artist,
        track_type=row.get("type") or "electrobuzz",
        extra_text=" ".join(extra_parts) or None,
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


def _get_writer_client():
    """Elasticsearch client for the rebuild (needs write/manage on tracks_search*).

    Uses the dedicated least-privilege writer creds (ES_WRITE_USERNAME /
    ES_WRITE_PASSWORD) when set, so the internet-facing API can keep read-only creds
    (ES_USERNAME/ES_PASSWORD). Falls back to the default client when they're unset.
    """
    import os
    from dotenv import load_dotenv
    load_dotenv()
    from app.core.config import settings
    from app.utils.elasticsearch_utils import get_es_client

    wu, wp = os.getenv("ES_WRITE_USERNAME"), os.getenv("ES_WRITE_PASSWORD")
    if wu and wp:
        from elasticsearch import Elasticsearch
        kwargs = {"basic_auth": (wu, wp), "verify_certs": settings.es_verify_certs,
                  "ssl_show_warn": False}
        if settings.es_verify_certs and settings.es_ca_certs:
            kwargs["ca_certs"] = settings.es_ca_certs
        _log(f"using writer user '{wu}'")
        return Elasticsearch(settings.es_url, request_timeout=settings.es_request_timeout, **kwargs)
    _log("ES_WRITE_* not set; using default ES creds")
    return get_es_client()


def run(limit: Optional[int], batch: int, dry_run: bool, no_swap: bool,
        keep_old: bool) -> int:
    _quiet_transport_logs()
    from database.connection import engine  # lazy so --help works without a live DB

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

    es = _get_writer_client()
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
