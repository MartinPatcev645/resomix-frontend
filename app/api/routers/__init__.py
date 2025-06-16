# Routers package 
from .similarity import router as similarity_router
from .metadata import router as metadata_router
from .search import router as search_router
from .feedback import router as feedback_router
from .contact import router as contact_router
from .health import router as health_router
from .preview import router as preview_router
from .track_upload import router as track_upload_router

# List of all routers for easy inclusion
all_routers = [
    similarity_router,
    metadata_router,
    search_router,
    feedback_router,
    contact_router,
    health_router,
    preview_router,
    track_upload_router,
] 