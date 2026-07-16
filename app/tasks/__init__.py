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
# track_tasks was omitted here, so `purge_uploaded_track_assets` was never registered on the
# worker — deleting an upload logged "Received unregistered task ...purge_uploaded_track_assets"
# and dropped the message, leaving the upload's media assets (peaks/segments/embeddings/preview/
# cover/raw) orphaned on the media server. Importing it here registers it.
from .track_tasks import purge_uploaded_track_assets

__all__ = [
    "celery_app", "dispatch_webhook",
    "persist_and_finalize_ingestion", "finalize_processing_job",
    "generate_track_analysis", "persist_analysis_summary", "generate_similarity_sibling",
    "purge_uploaded_track_assets",
]
