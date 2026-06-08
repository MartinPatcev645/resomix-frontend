"""
One-off targeted cleanup: remove partner 10000's orphaned tracks from
ingest_log_id=18 so a clean re-ingestion (with the new raw-store promotion +
matching uuids) can run without ISRC duplicates.

DB-ONLY. This deletes:
  - track_processing_status rows (ingest_log_id=18, partner_id=10000)
  - audio_files rows           (ingest_log_id=18, partner_id=10000)
  - tracks rows                (the track_ids referenced above, partner_id=10000)

It does NOT touch any uploaded audio files on disk.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, delete

from database.connection import AsyncSessionLocal
from app.core.context import set_admin_context, set_current_partner_id
from app.models.track import Track
from app.models.audio_file import AudioFile
from app.models.track_processing_status import TrackProcessingStatus

JOB_ID = 18
PARTNER_ID = 10000


async def main():
    # Satisfy the multi-tenancy guard so the queries/deletes are scoped + allowed.
    set_admin_context(True)
    set_current_partner_id(PARTNER_ID)

    async with AsyncSessionLocal() as db:
        # 1) Collect the track_ids belonging to this job for this partner, from
        #    both child tables (either may reference a given track).
        tps_track_ids = set(
            (
                await db.execute(
                    select(TrackProcessingStatus.track_id).where(
                        TrackProcessingStatus.ingest_log_id == JOB_ID,
                        TrackProcessingStatus.partner_id == PARTNER_ID,
                    )
                )
            )
            .scalars()
            .all()
        )
        af_track_ids = set(
            (
                await db.execute(
                    select(AudioFile.track_id).where(
                        AudioFile.ingest_log_id == JOB_ID,
                        AudioFile.partner_id == PARTNER_ID,
                    )
                )
            )
            .scalars()
            .all()
        )
        track_ids = sorted(tps_track_ids | af_track_ids)

        print(f"tps_track_ids={len(tps_track_ids)} af_track_ids={len(af_track_ids)} "
              f"union={len(track_ids)}")

        if not track_ids:
            print("Nothing to delete. Exiting.")
            return

        # Safety: confirm all target tracks really belong to this partner.
        owners = (
            await db.execute(
                select(Track.id, Track.partner_id).where(Track.id.in_(track_ids))
            )
        ).all()
        foreign = [tid for (tid, pid) in owners if pid != PARTNER_ID]
        if foreign:
            raise SystemExit(
                f"ABORT: {len(foreign)} track(s) are not owned by partner "
                f"{PARTNER_ID}: {foreign[:10]}"
            )

        # 2) Delete in FK-safe order: children first, then tracks.
        tps_deleted = (
            await db.execute(
                delete(TrackProcessingStatus).where(
                    TrackProcessingStatus.ingest_log_id == JOB_ID,
                    TrackProcessingStatus.partner_id == PARTNER_ID,
                )
            )
        ).rowcount

        af_deleted = (
            await db.execute(
                delete(AudioFile).where(
                    AudioFile.ingest_log_id == JOB_ID,
                    AudioFile.partner_id == PARTNER_ID,
                )
            )
        ).rowcount

        tracks_deleted = (
            await db.execute(
                delete(Track).where(
                    Track.id.in_(track_ids),
                    Track.partner_id == PARTNER_ID,
                )
            )
        ).rowcount

        await db.commit()

        print(
            f"Deleted: track_processing_status={tps_deleted} "
            f"audio_files={af_deleted} tracks={tracks_deleted}"
        )
        print("Done. (No files on disk were touched.)")


if __name__ == "__main__":
    asyncio.run(main())
