"""
Robust one-shot finalize for a completed-on-Hetzner EMBEDDINGS job.
==================================================================

Counterpart to ``finalize_ingest_log.py`` but for the embeddings stage.

Why this exists
---------------
When the Hetzner embeddings job finishes, Alwyzon is supposed to persist per-track
``track_processing_status`` rows via ``apply_embeddings_result``. For a large batch
that path is unsafe for the same reasons the ingestion persist was, only heavier:

  * It loops EVERY result doing a SELECT + UPDATE **plus** artifact registration
    (~4 more queries each) — ~290k ops for ~48k tracks — in ONE transaction.
  * It runs inside the admin panel's status poll, so the moment Hetzner reports
    ``completed`` every poll restarts that monster → they overlap and never commit.
  * The log→READY advance is gated by ``if log.status != "COMPLETED"``, but after the
    ingestion finalize the log is already COMPLETED, so the batch would never reach
    READY anyway.

This script instead:
  * fetches Hetzner's completed snapshot once,
  * applies the per-track status with a **bulk UPDATE per chunk** (≈48 statements,
    not 290k), committed per chunk → fast, lock-light, resumable,
  * marks the PartnerProcessingJob terminal (completed | partial | failed),
  * advances the IngestLog stage to READY unconditionally.

It does NOT touch live server code. Run it AFTER the Hetzner embeddings job reports
``completed`` (watch /process/embeddings/status or the media job json), and keep the
admin processing pages CLOSED while the job runs so the polled path doesn't fire.

Usage
-----
    python scripts/finalize_embeddings_job.py <job_id> [chunk_size]
    python scripts/finalize_embeddings_job.py --partner-id 1     # auto-pick latest
"""

import argparse
import asyncio
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, text, bindparam, desc

from database.connection import AsyncSessionLocal
from app.core.context import set_admin_context, set_current_partner_id
from app.models.partner_processing_job import PartnerProcessingJob
from app.models.b2b import IngestLog
from app.services.ingestion_stages import Stage, advance_stage
from app.services.hetzner_service import HetznerService


_BULK_OK = text(
    "UPDATE track_processing_status tps "
    "JOIN tracks t ON t.id = tps.track_id "
    "SET tps.embedding_status='completed', tps.embedding_completed_at=:now, "
    "    tps.embedding_error=NULL, tps.faiss_indexed=1, tps.faiss_indexed_at=:now "
    "WHERE tps.partner_id=:pid AND t.uuid IN :uuids"
).bindparams(bindparam("uuids", expanding=True))

_ONE_FAIL = text(
    "UPDATE track_processing_status tps "
    "JOIN tracks t ON t.id = tps.track_id "
    "SET tps.embedding_status='failed', tps.embedding_error=:msg "
    "WHERE tps.partner_id=:pid AND t.uuid=:uuid"
)


async def main(job_id, partner_id_arg, chunk_size: int) -> int:
    set_admin_context(True)
    hetzner = HetznerService()

    # --- resolve the job -----------------------------------------------------
    async with AsyncSessionLocal() as db:
        if job_id is not None:
            job = await db.get(PartnerProcessingJob, job_id)
        else:
            job = (await db.execute(
                select(PartnerProcessingJob)
                .where(PartnerProcessingJob.partner_id == partner_id_arg,
                       PartnerProcessingJob.job_type == "embeddings")
                .order_by(desc(PartnerProcessingJob.id)).limit(1)
            )).scalar_one_or_none()
        if job is None:
            print("ERROR: embeddings job not found.")
            return 2
        job_id = job.id
        partner_id = job.partner_id
        ingest_log_id = job.ingest_log_id
        set_current_partner_id(partner_id)
        print(f"job {job_id}: partner={partner_id} type={job.job_type} status={job.status} "
              f"ingest_log_id={ingest_log_id} {job.processed_tracks}/{job.total_tracks}")

    # --- fetch Hetzner snapshot ---------------------------------------------
    print("Fetching embeddings job status from Hetzner ...")
    remote = await hetzner.get_embeddings_status(partner_id, job_id)
    if not remote.get("success"):
        print(f"ERROR: could not fetch media status: {remote.get('error')} {remote.get('detail','')}")
        return 3
    state = remote["data"]
    rstatus = (state.get("status") or "").lower()
    results = state.get("results") or []
    print(f"Media snapshot: status={rstatus} total={state.get('total')} "
          f"succeeded={state.get('succeeded')} failed={state.get('failed')} results={len(results)}")
    if rstatus not in ("completed", "failed"):
        print(f"Embeddings job is still '{rstatus}' (not terminal). Wait for it to finish, then re-run.")
        return 0
    if not results:
        print("No per-track results in snapshot. Nothing to persist.")
        return 0

    ok_uuids = [r.get("track_uuid") for r in results if r.get("status") == "ok" and r.get("track_uuid")]
    failures = [(r.get("track_uuid"), r.get("message") or "Unknown embedding error")
                for r in results if r.get("status") != "ok" and r.get("track_uuid")]
    print(f"ok={len(ok_uuids)} failed={len(failures)}")

    now = datetime.utcnow()
    updated = 0

    # --- bulk-update OK tracks in chunks ------------------------------------
    for start in range(0, len(ok_uuids), chunk_size):
        chunk = ok_uuids[start:start + chunk_size]
        async with AsyncSessionLocal() as db:
            set_admin_context(True); set_current_partner_id(partner_id)
            res = await db.execute(_BULK_OK, {"now": now, "pid": partner_id, "uuids": chunk})
            await db.commit()
            updated += res.rowcount or 0
        print(f"  ...{min(start + chunk_size, len(ok_uuids))}/{len(ok_uuids)} ok-updated (rows so far: {updated})")

    # --- failed tracks (few) -------------------------------------------------
    if failures:
        async with AsyncSessionLocal() as db:
            set_admin_context(True); set_current_partner_id(partner_id)
            for uuid, msg in failures:
                await db.execute(_ONE_FAIL, {"msg": msg[:1000], "pid": partner_id, "uuid": uuid})
            await db.commit()
        print(f"  marked {len(failures)} track(s) failed")

    # --- finalize the job + advance the ingest log --------------------------
    async with AsyncSessionLocal() as db:
        set_admin_context(True); set_current_partner_id(partner_id)
        job = await db.get(PartnerProcessingJob, job_id)
        job.processed_tracks = len(ok_uuids)
        job.failed_tracks = len(failures)
        if rstatus == "failed":
            job.status = "failed"
        elif failures and ok_uuids:
            job.status = "partial"
        elif not ok_uuids:
            job.status = "failed"
        else:
            job.status = "completed"
        job.completed_at = datetime.utcnow()

        if ingest_log_id and job.status in ("completed", "partial"):
            log = await db.get(IngestLog, ingest_log_id)
            if log:
                for st in (Stage.EMBEDDING, Stage.INDEXED, Stage.FINALIZING, Stage.READY):
                    advance_stage(log, st)
                log.status = "COMPLETED"
                if log.completed_at is None:
                    log.completed_at = datetime.utcnow()
        await db.commit()
        await db.refresh(job)

    print("\n========================================================")
    print(f"DONE. job {job_id}: status={job.status} ok={len(ok_uuids)} failed={len(failures)} "
          f"rows_updated={updated}")
    if ingest_log_id:
        print(f"ingest_log {ingest_log_id} advanced to READY (status COMPLETED).")
    if failures:
        print("First failures:")
        for uuid, msg in failures[:10]:
            print(f"  - {uuid}: {msg[:140]}")
    print("========================================================")
    return 0 if job.status == "completed" else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Finalize a completed Hetzner embeddings job into the DB.")
    ap.add_argument("job_id", nargs="?", type=int, default=None, help="PartnerProcessingJob id (embeddings)")
    ap.add_argument("--partner-id", type=int, default=None, help="Auto-pick the latest embeddings job for this partner")
    ap.add_argument("--chunk-size", type=int, default=1000)
    args = ap.parse_args()
    if args.job_id is None and args.partner_id is None:
        print("Usage: python scripts/finalize_embeddings_job.py <job_id> [--chunk-size N]")
        print("   or: python scripts/finalize_embeddings_job.py --partner-id 1")
        sys.exit(64)
    sys.exit(asyncio.run(main(args.job_id, args.partner_id, args.chunk_size)))
