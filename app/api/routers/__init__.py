"""
API Router Module
================

This module aggregates all API routers and exposes them for the main FastAPI app.
It provides a centralized way to manage all API endpoints and their routing.

Manages authentication, database dependencies, and route organization
for the Resomix audio similarity API system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from .similarity import router as similarity_router
from .metadata import router as metadata_router
from .search import router as search_router
from .feedback import router as feedback_router
from .admin.feedback import router as admin_feedback_router
from .admin.contact import router as admin_contact_router
from .admin.playlist import router as admin_playlist_router
from .admin.waitlist import router as admin_waitlist_router
from .admin.operation_limits import router as admin_operation_limits_router
from .admin.spotify_apps import router as admin_spotify_apps_router
from .contact import router as contact_router
from .health import router as health_router
from .preview import router as preview_router
from .playlists import router as playlists_router
from .monthly_pipeline import router as monthly_pipeline_router
from .ratings import router as ratings_router
from .spotify_transfer import router as spotify_transfer_router
from .tidal_transfer import router as tidal_transfer_router
from .apple_music_transfer import router as apple_music_transfer_router
from .waitlist import router as waitlist_router
from .dummy import router as dummy_router
from .auth import router as auth_router
from .users import router as users_router
from .playlist_engagement import router as playlist_engagement_router
from .open_tracks_pipeline import router as open_tracks_pipeline_router
from .telemetry import router as telemetry_router

# List of all routers for easy inclusion
all_routers = [
    auth_router,
    users_router,
    similarity_router,
    metadata_router,
    search_router,
    feedback_router,
    admin_feedback_router,
    admin_contact_router,
    admin_waitlist_router,
    admin_playlist_router,
    admin_operation_limits_router,
    admin_spotify_apps_router,
    contact_router,
    health_router,
    preview_router,
    playlists_router,
    monthly_pipeline_router,
    ratings_router,
    spotify_transfer_router,
    tidal_transfer_router,
    apple_music_transfer_router,
    waitlist_router,
    dummy_router,
    playlist_engagement_router,
    open_tracks_pipeline_router,
    telemetry_router,
]
