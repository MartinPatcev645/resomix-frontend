"""
CORS Middleware
===============

This module provides CORS (Cross-Origin Resource Sharing) middleware configuration
for the ResomiX FastAPI application. It handles cross-origin request policies
and security settings for web browser access.

Configures CORS policies based on environment settings to allow secure
cross-origin access while maintaining appropriate security restrictions.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# CORS configuration middleware 
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from app.core.config import settings


def setup_cors(app: FastAPI) -> None:
    """
    Configure CORS middleware for the FastAPI application.
    Uses settings from core.config to determine appropriate CORS policy.
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=settings.current_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
        allow_headers=["*"],  # Allows all headers
    )
