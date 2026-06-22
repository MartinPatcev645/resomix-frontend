"""
Robust one-shot finalize for a completed-on-Hetzner ingestion log.
==================================================================

Why this exists
---------------
When Hetzner finishes a batch it writes ``status: completed`` + the validated
``records`` into its job-state JSON. Alwyzon is supposed to persist
Track/AudioFile/TrackProcessingStatus rows when its status poll sees that
snapshot (``apply_ingestion_result``). For a large batch that path fails:

  1. It does the *entire* batch in ONE transaction. For ~48k records that is
     ~240k round-trips on a single connection — heavy, lock-holding, fragile.
  2. The bigger problem: it sets ``audio_files.stored_path = <original filename>``,
     but there is a UNIQUE constraint ``uq_audio_path(partner_id, stored_path)``.
     Real catalogs have duplicate base filenames across albums (``01. ....mp3``,
     ``02. ....mp3`` …). The 2nd same-named row raises IntegrityError, the whole
     transaction aborts, and the async session can't recover (MissingGreenlet
     cascade). Net result: 0 rows committed, log stuck PROCESSING forever.

This script persists the SAME data correctly:

  * ``stored_path`` is the **uuid-keyed** path (``internal/raw/<uuid><ext>``) — the
    file physically lives at ``raw/<uuid>.mp3`` on Hetzner and the v2 pipeline
    keys embeddings + similarity by uuid, so this is both unique and correct.
    The human filename is preserved in ``original_filename``.
  * Inserts are committed in **chunks** (default 1000), so it's not one giant
    transaction.
  * It is **resumable / idempotent**: tracks whose uuid already exists are
    skipped, so a re-run continues where it stopped (no duplicates).
  * On a chunk failure it falls back to per-record inserts to isolate and report
    the offending row instead of losing the whole chunk.
  * At the end it marks the ingest log COMPLETED / stage INGESTED with the real
    track_count — after which the admin poll short-circuits (terminal log) and
    stops hammering the media server.

It does NOT modify any code the live web server runs; it's a standalone fixer.

Usage
-----
    python scripts/finalize_ingest_log.py <ingest_log_id> [chunk_size]
    python scripts/finalize_ingest_log.py 7
    python scripts/finalize_ingest_log.py 7 500
"""

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime

from sqlalchemy import select, text, func

from database.connection import AsyncSessionLocal
from app.core.context import set_admin_context, set_current_partner_id
from app.models.b2b import IngestLog
from app.models.track import Track
from app.models.audio_file import AudioFile
from app.models.track_processing_status import TrackProcessingStatus
from app.services.ingestion_stages import Stage, advance_stage
from app.services.hetzner_service import HetznerService


# Process-wide genre cache: lowercased name -> genres.id (avoids re-resolving).
_GENRE_CACHE: dict[str, int] = {}


async def _resolve_genre_id(db, name):
    """Mirror of apply_ingestion_result._resolve_genre_id (INSERT IGNORE + SELECT)."""
    if not name or not str(name).strip():
        return None
    key = str(name).strip().lower()
    if key in _GENRE_CACHE:
        return _GENRE_CACHE[key]
    clean = str(name).strip()[:80]
    await db.execute(text("INSERT IGNORE INTO genres (name) VALUES (:name)"), {"name": clean})
    row = (await db.execute(text("SELECT id FROM genres WHERE name = :name"), {"name": clean})).first()
    gid = row[0] if row else None
    if gid:
        _GENRE_CACHE[key] = gid
    return gid


def _stored_path_for(uuid_val: str, audio_fn: str) -> str:
    """Unique, uuid-keyed stored path. The physical file is raw/<uuid>.mp3 on
    Hetzner; the original (possibly duplicate) filename is kept separately."""
    ext = os.path.splitext(audio_fn or "")[1].lower()
    return f"internal/raw/{uuid_val}{ext}"


async def _persist_one(db, rec, party_id, partner_id, env):
    """Insert Track + AudioFile + TrackProcessingStatus for one record.

    Mirrors apply_ingestion_result's field mapping exactly, except stored_path is
    uuid-keyed. Caller manages the transaction (commit/rollback).
    """
    import uuid as _uuid

    genre_id_val = await _resolve_genre_id(db, rec.get("genre"))
    sub_genre_id_val = await _resolve_genre_id(db, rec.get("sub_genre"))
    audio_fn = rec.get("audio_filename")
    track_uuid = rec.get("track_uuid") or str(_uuid.uuid4())

    new_track = Track(
        uuid=track_uuid,
        isrc=(rec.get("isrc") or "").upper(),
        title=rec.get("title"),
        version_title=rec.get("version_title"),
        display_artist=rec.get("display_artist"),
        partner_id=partner_id,
        duration_ms=rec.get("duration_ms"),
        bpm=rec.get("bpm"),
        musical_key=rec.get("musical_key"),
        genre_id=genre_id_val,
        sub_genre_id=sub_genre_id_val,
        mix_name=rec.get("mix_name") or "Original Mix",
        parental_warning=rec.get("parental_warning") or "NotExplicit",
        is_explicit=bool(rec.get("is_explicit")),
        is_instrumental=bool(rec.get("is_instrumental")),
        audio_language=rec.get("audio_language") or "xx",
        language_of_lyrics=rec.get("language_of_lyrics"),
        p_line_year=rec.get("p_line_year"),
        p_line_text=rec.get("p_line_text"),
        ingestion_source="csv",
        track_type="electrobuzz",
    )
    db.add(new_track)
    await db.flush()  # populate track.id

    mime = (
        "audio/wav" if str(audio_fn).endswith(".wav")
        else "audio/mpeg" if str(audio_fn).endswith(".mp3")
        else "audio/flac"
    )
    db.add(AudioFile(
        party_id=party_id,
        ingest_log_id=rec["_log_id"],
        track_id=new_track.id,
        partner_id=partner_id,
        asset_class="Master",
        asset_subtype="master",
        original_filename=audio_fn,
        stored_path=_stored_path_for(track_uuid, audio_fn),
        file_size_bytes=rec.get("file_size_bytes") or 0,
        mime_type=mime,
    ))
    db.add(TrackProcessingStatus(
        track_id=new_track.id,
        partner_id=partner_id,
        ingest_log_id=rec["_log_id"],
        audio_filename=audio_fn,
        sftp_env=env,
    ))
    return track_uuid


async def main(log_id: int, chunk_size: int) -> int:
    set_admin_context(True)
    hetzner = HetznerService()

    # --- load log + fetch media snapshot -----------------------------------
    async with AsyncSessionLocal() as db:
        log = await db.get(IngestLog, log_id)
        if log is None:
            print(f"ERROR: ingest_log {log_id} not found.")
            return 2
        partner_id = log.partner_id
        party_id = log.party_id
        env = "live"
        set_current_partner_id(partner_id)
        print(f"ingest_log {log.id}: partner={partner_id} party={party_id} "
              f"status={log.status} stage={log.stage} track_count={log.track_count}")

    print("Fetching completed job snapshot from Hetzner ...")
    remote = await hetzner.get_ingestion_status(partner_id, log_id)
    if not remote.get("success"):
        print(f"ERROR: could not fetch media status: {remote.get('error')} "
              f"{remote.get('detail', '')}")
        return 3
    state = remote["data"]
    rstatus = (state.get("status") or "").lower()
    records = state.get("records") or []
    print(f"Media snapshot: status={rstatus} records={len(records)} "
          f"processing_dir={state.get('processing_dir')}")
    if rstatus != "completed":
        print(f"Media job is '{rstatus}', not 'completed'. Nothing to persist.")
        return 0
    if not records:
        print("No records in snapshot. Nothing to persist.")
        return 0

    # Report duplicate base filenames (informational — handled by uuid stored_path).
    from collections import Counter
    fn_counts = Counter((r.get("audio_filename") or "") for r in records)
    dup_files = {fn: c for fn, c in fn_counts.items() if c > 1}
    if dup_files:
        dup_records = sum(c for c in dup_files.values())
        print(f"NOTE: {len(dup_files)} filename(s) repeat across {dup_records} records "
              f"(kept as distinct uuid-keyed tracks). e.g. "
              f"{next(iter(dup_files))!r} x{dup_files[next(iter(dup_files))]}")

    # Stamp the per-record log id so _persist_one can fill FKs.
    for r in records:
        r["_log_id"] = log_id

    # --- resumability: which uuids already exist? --------------------------
    async with AsyncSessionLocal() as db:
        existing = set((await db.execute(
            select(Track.uuid).where(Track.partner_id == partner_id)
        )).scalars().all())
    todo = [r for r in records if (r.get("track_uuid") or "") not in existing]
    print(f"Already in DB: {len(existing)} | to insert: {len(todo)}")

    inserted = 0
    failures: list[tuple[str, str]] = []

    # --- chunked insert -----------------------------------------------------
    for start in range(0, len(todo), chunk_size):
        chunk = todo[start:start + chunk_size]
        try:
            async with AsyncSessionLocal() as db:
                set_admin_context(True)
                set_current_partner_id(partner_id)
                for rec in chunk:
                    await _persist_one(db, rec, party_id, partner_id, env)
                await db.commit()
            inserted += len(chunk)
        except Exception as exc:
            # Chunk failed — isolate per record so one bad row doesn't lose the rest.
            print(f"  chunk @{start} failed ({type(exc).__name__}: {str(exc)[:120]}); "
                  f"retrying row-by-row ...")
            for rec in chunk:
                try:
                    async with AsyncSessionLocal() as db:
                        set_admin_context(True)
                        set_current_partner_id(partner_id)
                        await _persist_one(db, rec, party_id, partner_id, env)
                        await db.commit()
                    inserted += 1
                except Exception as exc2:
                    failures.append((rec.get("audio_filename") or rec.get("track_uuid") or "?",
                                     f"{type(exc2).__name__}: {str(exc2)[:160]}"))
        done = start + len(chunk)
        print(f"  ... {done}/{len(todo)} processed (inserted so far: {inserted})")

    # --- final track count + terminal log update ---------------------------
    async with AsyncSessionLocal() as db:
        set_admin_context(True)
        set_current_partner_id(partner_id)
        total_tracks = (await db.execute(
            select(func.count()).select_from(Track).where(Track.partner_id == partner_id)
        )).scalar() or 0

        log = await db.get(IngestLog, log_id)
        log.track_count = int(total_tracks)
        if not failures:
            log.status = "COMPLETED"
            advance_stage(log, Stage.INGESTED)
            log.completed_at = datetime.utcnow()
        else:
            # Most rows in, but some failed — leave status PROCESSING so it's visible;
            # surface the count in error_message (does not block; admin can review).
            log.error_message = f"{len(failures)} record(s) failed to persist (see script output)."
        await db.commit()
        await db.refresh(log)
        print("\n========================================================")
        print(f"DONE. ingest_log {log.id}: status={log.status} stage={log.stage} "
              f"track_count={log.track_count}")
        print(f"Inserted this run: {inserted} | failures: {len(failures)}")
        if failures:
            print("First failures:")
            for fn, err in failures[:10]:
                print(f"  - {fn}: {err}")
        print("========================================================")
    return 0 if not failures else 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/finalize_ingest_log.py <ingest_log_id> [chunk_size]")
        sys.exit(64)
    _log_id = int(sys.argv[1])
    _chunk = int(sys.argv[2]) if len(sys.argv) > 2 else 1000
    sys.exit(asyncio.run(main(_log_id, _chunk)))
