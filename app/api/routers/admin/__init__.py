"""
Admin API Routers Package
=========================

This package contains admin-specific API routers for Resomix.
Admin endpoints require API key authentication and provide
management functionality for the application.

Version: 1.0.0
Init Date: October 1, 2025
"""

from .feedback import router as admin_feedback_router
from .contact import router as admin_contact_router
from .playlist import router as admin_playlist_router
from .waitlist import router as admin_waitlist_router
from .operation_limits import router as admin_operation_limits_router
from .spotify_apps import router as admin_spotify_apps_router
from .partners import router as admin_partners_router
from .similarity import router as admin_similarity_router
from .promo import router as admin_promo_router
from .auth import router as admin_auth_router
from .users import router as admin_users_router
from .roles import router as admin_roles_router

__all__ = [
    "admin_feedback_router",
    "admin_contact_router",
    "admin_waitlist_router",
    "admin_playlist_router",
    "admin_operation_limits_router",
    "admin_spotify_apps_router",
    "admin_partners_router",
    "admin_similarity_router",
    "admin_promo_router",
    "admin_auth_router",
    "admin_users_router",
    "admin_roles_router",
]
