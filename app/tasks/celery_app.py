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
)

# Auto-discover tasks in app.tasks package
celery_app.autodiscover_tasks(["app.tasks"])
