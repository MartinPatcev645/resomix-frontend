"""
Bandcamp service
================

Database side of the Bandcamp collection import: connection + job bookkeeping for the API, and
``run_bandcamp_sync`` which the Celery worker runs. All Bandcamp HTTP goes through
``app.services.bandcamp_client`` (unofficial public pages — see the note there).

Sync behaviour:
  * newest-first pages are upserted on ``(user_id, source, external_id)``, so re-running is safe;
  * whether the next sync is incremental is decided in ``connect``, while the previous connection
    status is still visible, and stored on the job. A completed sync then stops at the first page
    that adds nothing new. A failed sync with no bookmark does a full pass again;
  * hitting the request cap saves the next ``older_than_token`` and ends the job as partial.
    The following sync resumes from that token instead of starting over at the newest item;
  * a page that fails marks the job failed but keeps every row already imported;
  * the job re-checks it is still current before each page, so a disconnect or a username change
    stops an in-flight sync instead of letting it write stale rows.

Albums are imported and listed, but not matched to catalogue tracks. Expanding an album would
cost one Bandcamp request per album, and ``track_store_links`` does not yet store Bandcamp ids.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Callable, List, Optional, Tuple

from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bandcamp import (
    CONNECTION_FAILED,
    CONNECTION_PARTIAL,
    CONNECTION_PENDING,
    CONNECTION_READY,
    CONNECTION_SYNCING,
    BandcampConnection,
)
from app.models.music_collection import (
    COLLECTION_SOURCE_BANDCAMP,
    SYNC_ACTIVE,
    SYNC_DONE,
    SYNC_FAILED,
    SYNC_PARTIAL,
    SYNC_QUEUED,
    SYNC_RUNNING,
    SyncJob,
    UserMusicCollectionItem,
)
from app.services.bandcamp_client import (
    BandcampClient,
    BandcampError,
    BandcampItem,
    BandcampRequestCapReached,
    normalize_username,
)
from app.services.track_resolver import TrackResolver
from database.connection import AsyncSessionLocal

logger = logging.getLogger(__name__)

_GENERIC_FAILURE = "The Bandcamp import failed. Please try again later."
_SUPERSEDED = "Replaced by a newer Bandcamp sync."


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class BandcampService:
    """Connection, job and collection queries used by the API."""

    def __init__(self, client_factory: Callable[[], BandcampClient] = BandcampClient) -> None:
        self.client_factory = client_factory

    async def get_connection(self, db: AsyncSession, user_id: int) -> Optional[BandcampConnection]:
        return (
            await db.execute(select(BandcampConnection).where(BandcampConnection.user_id == user_id))
        ).scalar_one_or_none()

    async def get_connection_state(self, db: AsyncSession, user_id: int) -> dict:
        """What the client needs on page load. ``status`` is ``none`` when nothing is connected."""
        connection = await self.get_connection(db, user_id)
        if connection is None:
            return {
                "connected": False,
                "username": None,
                "status": "none",
                "last_synced_at": None,
                "active_job_id": None,
                "item_count": 0,
                "matched_count": 0,
                "error_message": None,
            }
        active = await self._active_job(db, user_id)
        item_count, matched_count = await self._collection_counts(db, user_id)
        return {
            "connected": True,
            "username": connection.bandcamp_username,
            "status": connection.status,
            "last_synced_at": connection.last_synced_at.isoformat() if connection.last_synced_at else None,
            "active_job_id": active.id if active is not None else None,
            "item_count": item_count,
            "matched_count": matched_count,
            "error_message": connection.error_message,
        }

    async def connect(self, db: AsyncSession, user_id: int, raw_username: str) -> Tuple[SyncJob, bool]:
        """Verify the public username, upsert the connection and return ``(job, created)``.

        An active job for the same username is returned as-is (``created=False``) so a double
        click never enqueues two syncs. Linking a different username drops the old collection.

        Incremental vs resume is decided here, before ``status`` becomes ``pending``.
        ``ValueError`` is an invalid username. Bandcamp failures propagate as ``BandcampError``.
        """
        username = normalize_username(raw_username)
        async with self.client_factory() as client:
            await client.get_fan(username)

        connection = await self.get_connection(db, user_id)
        active = await self._active_job(db, user_id)

        if connection is not None and connection.bandcamp_username == username and active is not None:
            return active, False

        if active is not None:
            active.status = SYNC_FAILED
            active.error = _SUPERSEDED

        incremental = False
        resume_token = None
        if connection is not None and connection.bandcamp_username == username:
            if connection.resume_token:
                resume_token = connection.resume_token
            elif connection.status == CONNECTION_READY and connection.last_synced_at is not None:
                incremental = True

        if connection is None:
            connection = BandcampConnection(user_id=user_id, bandcamp_username=username)
            db.add(connection)
        elif connection.bandcamp_username != username:
            await self._delete_items(db, user_id)
            connection.bandcamp_username = username
            connection.last_synced_at = None
            connection.resume_token = None
        connection.status = CONNECTION_PENDING
        connection.error_message = None

        job = SyncJob(
            id=str(uuid.uuid4()),
            user_id=user_id,
            source=COLLECTION_SOURCE_BANDCAMP,
            status=SYNC_QUEUED,
            incremental=incremental,
            resume_token=resume_token,
        )
        db.add(job)
        await db.commit()
        return job, True

    async def get_job(self, db: AsyncSession, user_id: int, job_id: str) -> Optional[SyncJob]:
        return (
            await db.execute(select(SyncJob).where(SyncJob.id == job_id, SyncJob.user_id == user_id))
        ).scalar_one_or_none()

    async def mark_job_failed(self, db: AsyncSession, job: SyncJob, error: str) -> None:
        job.status = SYNC_FAILED
        job.error = error
        connection = await self.get_connection(db, job.user_id)
        if connection is not None:
            connection.status = CONNECTION_FAILED
            connection.error_message = error
        await db.commit()

    async def list_collection(
        self,
        db: AsyncSession,
        user_id: int,
        *,
        page: int,
        page_size: int,
        q: Optional[str],
        matched: bool = False,
    ) -> Tuple[List[UserMusicCollectionItem], int]:
        conditions = [
            UserMusicCollectionItem.user_id == user_id,
            UserMusicCollectionItem.source == COLLECTION_SOURCE_BANDCAMP,
        ]
        if matched:
            conditions.append(UserMusicCollectionItem.resomix_track_id.is_not(None))
        if q:
            pattern = f"%{q.strip()}%"
            conditions.append(
                or_(
                    UserMusicCollectionItem.artist.like(pattern),
                    UserMusicCollectionItem.title.like(pattern),
                    UserMusicCollectionItem.album.like(pattern),
                )
            )
        total = (
            await db.execute(select(func.count()).select_from(UserMusicCollectionItem).where(*conditions))
        ).scalar_one()
        items = (
            await db.execute(
                select(UserMusicCollectionItem)
                .where(*conditions)
                .order_by(UserMusicCollectionItem.added_at.desc(), UserMusicCollectionItem.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars().all()
        return list(items), int(total)

    async def disconnect(self, db: AsyncSession, user_id: int) -> Optional[int]:
        """Delete the connection, imported rows and jobs. Returns rows removed, or None if not connected."""
        connection = await self.get_connection(db, user_id)
        if connection is None:
            return None
        removed = await self._delete_items(db, user_id)
        await db.execute(
            delete(SyncJob).where(SyncJob.user_id == user_id, SyncJob.source == COLLECTION_SOURCE_BANDCAMP)
        )
        await db.delete(connection)
        await db.commit()
        return removed

    async def _active_job(self, db: AsyncSession, user_id: int) -> Optional[SyncJob]:
        return (
            await db.execute(
                select(SyncJob)
                .where(
                    SyncJob.user_id == user_id,
                    SyncJob.source == COLLECTION_SOURCE_BANDCAMP,
                    SyncJob.status.in_(SYNC_ACTIVE),
                )
                .order_by(SyncJob.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    @staticmethod
    async def _collection_counts(db: AsyncSession, user_id: int) -> Tuple[int, int]:
        owned = (
            UserMusicCollectionItem.user_id == user_id,
            UserMusicCollectionItem.source == COLLECTION_SOURCE_BANDCAMP,
        )
        item_count = (
            await db.execute(select(func.count()).select_from(UserMusicCollectionItem).where(*owned))
        ).scalar_one()
        matched_count = (
            await db.execute(
                select(func.count())
                .select_from(UserMusicCollectionItem)
                .where(*owned, UserMusicCollectionItem.resomix_track_id.is_not(None))
            )
        ).scalar_one()
        return int(item_count), int(matched_count)

    @staticmethod
    async def _delete_items(db: AsyncSession, user_id: int) -> int:
        result = await db.execute(
            delete(UserMusicCollectionItem).where(
                UserMusicCollectionItem.user_id == user_id,
                UserMusicCollectionItem.source == COLLECTION_SOURCE_BANDCAMP,
            )
        )
        return result.rowcount or 0


async def upsert_items(db: AsyncSession, user_id: int, items: List[BandcampItem]) -> int:
    """Upsert one page of items; returns how many were not already in the collection."""
    if not items:
        return 0
    ids = {item.external_id for item in items}
    existing = set(
        (
            await db.execute(
                select(UserMusicCollectionItem.external_id).where(
                    UserMusicCollectionItem.user_id == user_id,
                    UserMusicCollectionItem.source == COLLECTION_SOURCE_BANDCAMP,
                    UserMusicCollectionItem.external_id.in_(ids),
                )
            )
        ).scalars()
    )
    stmt = mysql_insert(UserMusicCollectionItem).values(
        [
            {
                "user_id": user_id,
                "source": COLLECTION_SOURCE_BANDCAMP,
                "external_id": item.external_id,
                "item_type": item.item_type,
                "artist": item.artist,
                "title": item.title,
                "album": item.album,
                "artwork_url": item.artwork_url,
                "source_url": item.source_url,
                "duration_ms": item.duration_ms,
                "added_at": item.added_at,
            }
            for item in items
        ]
    )
    stmt = stmt.on_duplicate_key_update(
        item_type=stmt.inserted.item_type,
        artist=stmt.inserted.artist,
        title=stmt.inserted.title,
        album=stmt.inserted.album,
        artwork_url=stmt.inserted.artwork_url,
        source_url=stmt.inserted.source_url,
        duration_ms=stmt.inserted.duration_ms,
        # Keep a previously parsed time when a later page omits the token.
        added_at=func.coalesce(stmt.inserted.added_at, UserMusicCollectionItem.added_at),
        # onupdate is not applied to ON DUPLICATE KEY UPDATE.
        updated_at=func.current_timestamp(),
    )
    await db.execute(stmt)
    return len(ids - existing)


async def _still_current(db: AsyncSession, job_id: str, username: str) -> bool:
    row = (
        await db.execute(
            select(SyncJob.status, BandcampConnection.bandcamp_username)
            .join(BandcampConnection, BandcampConnection.user_id == SyncJob.user_id)
            .where(SyncJob.id == job_id)
        )
    ).first()
    return row is not None and row[0] == SYNC_RUNNING and row[1] == username


async def _fail(db: AsyncSession, job_id: str, error: str) -> None:
    await db.rollback()
    job = await db.get(SyncJob, job_id)
    if job is None or job.status != SYNC_RUNNING:
        return
    await BandcampService().mark_job_failed(db, job, error)


async def run_bandcamp_sync(
    job_id: str,
    *,
    client_factory: Callable[[], BandcampClient] = BandcampClient,
    session_factory: Callable[[], AsyncSession] = AsyncSessionLocal,
) -> None:
    """Import one user's public collection. Never raises: failures are recorded on the job."""
    async with session_factory() as db:
        job = await db.get(SyncJob, job_id)
        if job is None or job.status not in SYNC_ACTIVE:
            return
        user_id = job.user_id
        connection = await BandcampService().get_connection(db, user_id)
        if connection is None:
            job.status = SYNC_FAILED
            job.error = "The Bandcamp connection was removed."
            await db.commit()
            return

        username = connection.bandcamp_username
        # Taken from the job: connect already set status to pending, so the connection
        # row no longer says whether the previous sync had finished.
        incremental = bool(job.incremental) and not job.resume_token
        resume_token = job.resume_token
        job.status = SYNC_RUNNING
        connection.status = CONNECTION_SYNCING
        connection.error_message = None
        await db.commit()

        try:
            stopped_early = False
            capped = False
            partial_message: Optional[str] = None
            partial_token: Optional[str] = None
            async with client_factory() as client:
                fan = await client.get_fan(username)
                job.total = fan.item_count
                await db.commit()

                try:
                    async for page in client.iter_collection(fan, older_than_token=resume_token):
                        if not await _still_current(db, job_id, username):
                            logger.info("Bandcamp sync %s superseded; stopping", job_id)
                            return
                        added = await upsert_items(db, user_id, page)
                        job.processed += len(page)
                        job.total = max(job.total, job.processed)
                        await db.commit()
                        if incremental and added == 0:
                            stopped_early = True
                            break
                except BandcampRequestCapReached as exc:
                    capped = True
                    partial_message = str(exc)
                    partial_token = exc.resume_token

            try:
                matched = await TrackResolver().resolve_user_items(db, user_id)
                await db.commit()
                logger.info("Bandcamp sync %s matched %d items to catalogue tracks", job_id, matched)
            except Exception:
                # Matching is an enrichment; it must never fail the import itself.
                logger.exception("Bandcamp sync %s: track resolution failed", job_id)
                await db.rollback()

            job = await db.get(SyncJob, job_id)
            connection = await BandcampService().get_connection(db, user_id)
            if job is None or connection is None or job.status != SYNC_RUNNING:
                return
            connection.last_synced_at = _utcnow()
            if capped:
                job.status = SYNC_PARTIAL
                job.error = partial_message
                connection.status = CONNECTION_PARTIAL
                connection.error_message = partial_message
                if partial_token:
                    connection.resume_token = partial_token
            else:
                if stopped_early:
                    job.processed = job.total
                job.status = SYNC_DONE
                job.error = None
                connection.status = CONNECTION_READY
                connection.error_message = None
                connection.resume_token = None
            await db.commit()
        except BandcampError as exc:
            logger.warning("Bandcamp sync %s failed: %s", job_id, exc)
            await _fail(db, job_id, str(exc))
        except Exception:
            logger.exception("Bandcamp sync %s crashed", job_id)
            await _fail(db, job_id, _GENERIC_FAILURE)
