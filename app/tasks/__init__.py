from .celery_app import celery_app
from .webhooks import dispatch_webhook
from .ingestion_tasks import persist_and_finalize_ingestion
from .processing_tasks import finalize_processing_job
# Importing here is what REGISTERS these tasks on the worker (the worker loads app.tasks via
# `-A app.tasks.celery_app`, running this __init__). Without it, `.delay()` from the API enqueues
# a message the worker treats as an unregistered task and drops — so the analysis summary row
# never fills and the similarity sibling never runs.
from .analysis_tasks import (
    generate_track_analysis,
    persist_analysis_summary,
    generate_similarity_sibling,
)

__all__ = [
    "celery_app", "dispatch_webhook",
    "persist_and_finalize_ingestion", "finalize_processing_job",
    "generate_track_analysis", "persist_analysis_summary", "generate_similarity_sibling",
]
