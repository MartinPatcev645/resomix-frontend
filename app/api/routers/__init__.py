"""
API Router Module
================

This module aggregates all API routers and exposes them for the main FastAPI app.
It provides a centralized way to manage all API endpoints and their routing.

Manages authentication, database dependencies, and route organization
for the ResomiX audio similarity API system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from .similarity import router as similarity_router
from .metadata import router as metadata_router
from .search import router as search_router
from .feedback import router as feedback_router
from .contact import router as contact_router
from .health import router as health_router
from .preview import router as preview_router

# List of all routers for easy inclusion
all_routers = [
    similarity_router,
    metadata_router,
    search_router,
    feedback_router,
    contact_router,
    health_router,
    preview_router,
]
