"""
Bandcamp Controller
===================

HTTP side of the Bandcamp collection import. The controller calls ``BandcampService`` only;
the service checks the username with the Bandcamp client, and the import itself runs in the
Celery worker (``app.tasks.bandcamp_tasks``). Bandcamp is never called from the frontend, and
only its public pages are read — see ``app.services.bandcamp_client``.
"""

import logging
from typing import Optional

from fastapi import status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.bandcamp_client import (
    BandcampCollectionPrivate,
    BandcampError,
    BandcampRateLimited,
    BandcampUnavailable,
    BandcampUserNotFound,
)
from app.services.bandcamp_service import BandcampService
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)

_ERROR_STATUS = (
    (BandcampUserNotFound, status.HTTP_404_NOT_FOUND),
    (BandcampCollectionPrivate, status.HTTP_403_FORBIDDEN),
    (BandcampRateLimited, status.HTTP_429_TOO_MANY_REQUESTS),
    (BandcampUnavailable, status.HTTP_503_SERVICE_UNAVAILABLE),
)


def _error(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=format_response(success=False, error=message))


class BandcampController:
    def __init__(self, service: Optional[BandcampService] = None) -> None:
        self.service = service or BandcampService()

    @staticmethod
    def _enqueue(job_id: str, partner_id: Optional[int]) -> None:
        from app.tasks.bandcamp_tasks import sync_bandcamp_collection

        sync_bandcamp_collection.delay(job_id, partner_id)

    async def connect(
        self, db: AsyncSession, current_user: User, raw_username: str, partner_id: Optional[int]
    ) -> JSONResponse:
        try:
            job, created = await self.service.connect(db, current_user.id, raw_username)
        except ValueError as e:
            return _error(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
        except BandcampError as e:
            for exc_type, code in _ERROR_STATUS:
                if isinstance(e, exc_type):
                    return _error(code, str(e))
            logger.warning("Bandcamp verification failed for user %s: %s", current_user.id, e)
            return _error(status.HTTP_502_BAD_GATEWAY, str(e))
        except Exception as e:  # noqa: BLE001
            logger.error("Failed to save Bandcamp connection: %s", str(e))
            await db.rollback()
            return _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not connect your Bandcamp account.")

        if created:
            try:
                self._enqueue(job.id, partner_id)
            except Exception as e:  # noqa: BLE001
                logger.error("Failed to enqueue Bandcamp sync %s: %s", job.id, str(e))
                await self.service.mark_job_failed(db, job, "The import could not be started.")
                return _error(status.HTTP_503_SERVICE_UNAVAILABLE, "The import could not be started. Please try again.")

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content=format_response(success=True, data={"job_id": job.id}),
        )

    async def get_connection(self, db: AsyncSession, current_user: User) -> JSONResponse:
        state = await self.service.get_connection_state(db, current_user.id)
        return JSONResponse(status_code=status.HTTP_200_OK, content=format_response(success=True, data=state))

    async def get_sync_status(self, db: AsyncSession, current_user: User, job_id: str) -> JSONResponse:
        job = await self.service.get_job(db, current_user.id, job_id)
        if job is None:
            return _error(status.HTTP_404_NOT_FOUND, "Sync job not found.")
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(success=True, data=job.to_status_dict()),
        )

    async def get_collection(
        self,
        db: AsyncSession,
        current_user: User,
        page: int,
        page_size: int,
        q: Optional[str],
        matched: bool,
    ) -> JSONResponse:
        items, total = await self.service.list_collection(
            db, current_user.id, page=page, page_size=page_size, q=q, matched=matched
        )
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(
                success=True,
                data={
                    "items": [item.to_dict() for item in items],
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                },
            ),
        )

    async def disconnect(self, db: AsyncSession, current_user: User) -> JSONResponse:
        try:
            removed = await self.service.disconnect(db, current_user.id)
        except Exception as e:  # noqa: BLE001
            logger.error("Failed to disconnect Bandcamp: %s", str(e))
            await db.rollback()
            return _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not disconnect your Bandcamp account.")
        if removed is None:
            return _error(status.HTTP_404_NOT_FOUND, "No Bandcamp account is connected.")
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=format_response(success=True, data={"connected": False, "removed_items": removed}),
        )
