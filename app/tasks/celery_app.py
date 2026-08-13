"""
Celery Application Initialization
=================================

Initializes and configures the Celery app instance for managing background tasks 
with Redis as broker and backend.
"""

from celery import Celery
from app.core.config import settings

# Initialize Celery app instance
celery_app = Celery(
    "resomix_tasks",
    broker=settings.redis_url,
    backend=settings.redis_url
)

# Apply Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    result_expires=86400, # 24 hours TTL for task results

    # Foreground uploads get their own queue, served by their own worker.
    #
    # `run_similarity_upload` is work a user is ACTIVELY WAITING ON — it is the playlist behind
    # their spinner. Everything else here is background: `generate_track_analysis` in particular
    # holds its worker slot for up to 240s waiting on the analysis service, and every similarity
    # upload enqueues one. On a single shared pool a burst of uploads therefore fills every slot
    # with background siblings, and the NEXT user's foreground upload queues behind them — the
    # foreground/background inversion that the capacity work identified as the thing to avoid.
    #
    # Two queues + two workers is the cheap structural fix: a background pile-up can never delay
    # a foreground upload, because they do not share a pool.
    task_routes={
        "app.tasks.similarity_tasks.run_similarity_upload": {"queue": "similarity"},
    },
    task_default_queue="celery",
)

# Auto-discover tasks in app.tasks package
celery_app.autodiscover_tasks(["app.tasks"])
