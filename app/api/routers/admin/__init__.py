"""
Admin API Routers Package
=========================

This package contains admin-specific API routers for ResomiX.
Admin endpoints require API key authentication and provide
management functionality for the application.

Version: 1.0.0
Init Date: October 1, 2025
"""

from .feedback import router as admin_feedback_router

__all__ = ["admin_feedback_router"]
