"""
API Router Module
================

This module aggregates all API routers and exposes them for the main FastAPI app.
It provides a centralized way to manage all API endpoints and their routing.

Version: 3.2.0 (Full API Versioning)
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
from .admin.promo import router as admin_promo_router
from .admin.partners import router as admin_partners_router
from .admin.similarity import router as admin_similarity_router
from .admin.auth import router as admin_auth_router
from .admin.users import router as admin_users_router
from .admin.roles import router as admin_roles_router
from .partner import router as partner_router
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
from .purchases import router as purchases_router
from .webhooks import router as webhooks_router

V1_PREFIX = "/api/v1"

# All routers are now versioned under /api/v1
# Note: webhooks_router already has /api/v1 in its internal prefix, 
# so we handle it specially in main.py or keep it here without prefix duplication.
v1_routers = [
    (similarity_router, V1_PREFIX),
    (metadata_router, V1_PREFIX),
    (search_router, V1_PREFIX),
    (feedback_router, V1_PREFIX),
    (contact_router, V1_PREFIX),
    (waitlist_router, V1_PREFIX),
    (ratings_router, V1_PREFIX),
    (preview_router, V1_PREFIX),
    (telemetry_router, V1_PREFIX),
    (purchases_router, V1_PREFIX),
    (playlists_router, V1_PREFIX),
    (playlist_engagement_router, V1_PREFIX),
    (auth_router, V1_PREFIX),
    (users_router, V1_PREFIX),
    (spotify_transfer_router, V1_PREFIX),
    (tidal_transfer_router, V1_PREFIX),
    (apple_music_transfer_router, V1_PREFIX),
    (partner_router, V1_PREFIX),
    (monthly_pipeline_router, V1_PREFIX),
    (open_tracks_pipeline_router, V1_PREFIX),
    (admin_partners_router, V1_PREFIX),
    (admin_operation_limits_router, V1_PREFIX),
    (admin_similarity_router, V1_PREFIX),
    (admin_feedback_router, V1_PREFIX),
    (admin_contact_router, V1_PREFIX),
    (admin_waitlist_router, V1_PREFIX),
    (admin_playlist_router, V1_PREFIX),
    (admin_promo_router, V1_PREFIX),
    (admin_spotify_apps_router, V1_PREFIX),
    (admin_auth_router, V1_PREFIX),
    (admin_users_router, V1_PREFIX),
    (admin_roles_router, V1_PREFIX),
    (health_router, V1_PREFIX),
    (dummy_router, V1_PREFIX),
    # Special case: webhooks_router has internal /api/v1 prefix
    (webhooks_router, ""), 
]

# Legacy support: Unversioned registration at root
legacy_root_routers = [r for r, p in v1_routers if p == V1_PREFIX] + [webhooks_router]

# Kept for backward compatibility if any script uses it
all_routers = [r for r, _ in v1_routers]
