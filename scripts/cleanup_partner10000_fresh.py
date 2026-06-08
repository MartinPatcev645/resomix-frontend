"""
Fresh-start wipe for partner 10000.
===================================

Removes everything the SFTP ingestion + embeddings pipeline has written for
partner 10000 so a brand-new ingestion → embeddings run starts from a clean slate:

  - document_files           (embedding artifacts)        — blocks ingest_logs
  - image_files              (none expected, safety)       — blocks ingest_logs
  - messages                 (none expected, safety)       — blocks ingest_logs
  - audio_files                                            — blocks ingest_logs
  - track_processing_status  (per-track pipeline state)
  - tracks                   (cascades release/rating/contributor/etc.)
  - partner_processing_jobs  (the embeddings job rows)
  - ingest_logs              (cascades ingestion_errors)

KEPT on purpose:
  - the partners row and its parties row (PARTNER-10000) — reused by re-ingestion.
  - the partner's uploaded audio files on disk (NOT touched).

All deletes are scoped to partner_id=10000 and run in a single transaction:
if anything unexpected blocks a delete, nothing is committed.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, delete, func

from database.connection import AsyncSessionLocal
from app.core.context import set_admin_context, set_current_partner_id
from app.models.track import Track
from app.models.audio_file import AudioFile
from app.models.track_processing_status import TrackProcessingStatus
from app.models.document_file import DocumentFile
from app.models.image_file import ImageFile
from app.models.message import Message
from app.models.partner_processing_job import PartnerProcessingJob
from app.models.b2b import IngestLog, IngestionError

PARTNER_ID = 10000


async def _count(db, model, *where):
    stmt = select(func.count()).select_from(model)
    for w in where:
        stmt = stmt.where(w)
    return (await db.execute(stmt)).scalar_one()


async def main():
    set_admin_context(True)
    set_current_partner_id(PARTNER_ID)

    async with AsyncSessionLocal() as db:
        log_ids = (
            await db.execute(select(IngestLog.id).where(IngestLog.partner_id == PARTNER_ID))
        ).scalars().all()

        # ---- Before counts -------------------------------------------------
        before = {
            "document_files": await _count(db, DocumentFile, DocumentFile.partner_id == PARTNER_ID),
            "image_files": await _count(db, ImageFile, ImageFile.partner_id == PARTNER_ID),
            "messages": await _count(db, Message, Message.partner_id == PARTNER_ID),
            "audio_files": await _count(db, AudioFile, AudioFile.partner_id == PARTNER_ID),
            "track_processing_status": await _count(db, TrackProcessingStatus, TrackProcessingStatus.partner_id == PARTNER_ID),
            "tracks": await _count(db, Track, Track.partner_id == PARTNER_ID),
            "partner_processing_jobs": await _count(db, PartnerProcessingJob, PartnerProcessingJob.partner_id == PARTNER_ID),
            "ingestion_errors": (
                await _count(db, IngestionError, IngestionError.ingest_log_id.in_(log_ids)) if log_ids else 0
            ),
            "ingest_logs": await _count(db, IngestLog, IngestLog.partner_id == PARTNER_ID),
        }
        print("BEFORE:", before)

        # ---- Deletes (FK-safe order, single transaction) -------------------
        results = {}
        results["document_files"] = (
            await db.execute(delete(DocumentFile).where(DocumentFile.partner_id == PARTNER_ID))
        ).rowcount
        results["image_files"] = (
            await db.execute(delete(ImageFile).where(ImageFile.partner_id == PARTNER_ID))
        ).rowcount
        results["messages"] = (
            await db.execute(delete(Message).where(Message.partner_id == PARTNER_ID))
        ).rowcount
        results["audio_files"] = (
            await db.execute(delete(AudioFile).where(AudioFile.partner_id == PARTNER_ID))
        ).rowcount
        results["track_processing_status"] = (
            await db.execute(delete(TrackProcessingStatus).where(TrackProcessingStatus.partner_id == PARTNER_ID))
        ).rowcount
        results["tracks"] = (
            await db.execute(delete(Track).where(Track.partner_id == PARTNER_ID))
        ).rowcount
        results["partner_processing_jobs"] = (
            await db.execute(delete(PartnerProcessingJob).where(PartnerProcessingJob.partner_id == PARTNER_ID))
        ).rowcount
        # ingestion_errors cascade-delete on ingest_logs, but clear explicitly for a clean count.
        if log_ids:
            results["ingestion_errors"] = (
                await db.execute(delete(IngestionError).where(IngestionError.ingest_log_id.in_(log_ids)))
            ).rowcount
        else:
            results["ingestion_errors"] = 0
        results["ingest_logs"] = (
            await db.execute(delete(IngestLog).where(IngestLog.partner_id == PARTNER_ID))
        ).rowcount

        await db.commit()
        print("DELETED:", results)

        # ---- After counts --------------------------------------------------
        after = {
            "document_files": await _count(db, DocumentFile, DocumentFile.partner_id == PARTNER_ID),
            "audio_files": await _count(db, AudioFile, AudioFile.partner_id == PARTNER_ID),
            "track_processing_status": await _count(db, TrackProcessingStatus, TrackProcessingStatus.partner_id == PARTNER_ID),
            "tracks": await _count(db, Track, Track.partner_id == PARTNER_ID),
            "partner_processing_jobs": await _count(db, PartnerProcessingJob, PartnerProcessingJob.partner_id == PARTNER_ID),
            "ingest_logs": await _count(db, IngestLog, IngestLog.partner_id == PARTNER_ID),
        }
        print("AFTER:", after)
        print("Done. (Partner row, party row, and uploaded files on disk were NOT touched.)")


if __name__ == "__main__":
    asyncio.run(main())
