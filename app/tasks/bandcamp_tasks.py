"""
Bandcamp tasks
==============

The worker half of ``POST /bandcamp/connect``: the request verifies the username and creates a
``sync_jobs`` row, then hands off here; the client polls ``GET /bandcamp/sync/{job_id}``.

Runs on the default queue. Each sync is capped at ``MAX_REQUESTS_PER_SYNC`` Bandcamp requests with a
delay between them, so one task stays short and cannot hammer Bandcamp.
"""

from typing import Optional

from app.core.context import bind_task_tenancy
from app.services.bandcamp_service import run_bandcamp_sync
from .async_runner import run_async_task
from .celery_app import celery_app


async def _async_sync_bandcamp_collection(job_id: str, partner_id: Optional[int]) -> None:
    # The resolver reads partner-scoped `tracks`; without this the SQL failsafe raises.
    bind_task_tenancy(partner_id)
    await run_bandcamp_sync(job_id)


@celery_app.task(bind=True, max_retries=0)
def sync_bandcamp_collection(self, job_id: str, partner_id: Optional[int] = None) -> None:
    run_async_task(_async_sync_bandcamp_collection(job_id, partner_id))
