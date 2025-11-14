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

__all__ = [
    "admin_feedback_router",
    "admin_contact_router",
    "admin_waitlist_router",
    "admin_playlist_router",
    "admin_operation_limits_router",
    "admin_spotify_apps_router",
]
