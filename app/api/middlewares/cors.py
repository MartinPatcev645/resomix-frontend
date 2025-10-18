"""
CORS Middleware
===============

This module provides CORS (Cross-Origin Resource Sharing) middleware configuration
for the ResomiX FastAPI application. It handles cross-origin request policies
and security settings for web browser access.

Configures CORS policies based on environment settings to allow secure
cross-origin access while maintaining appropriate security restrictions.

Production Mode:
- Explicit allowed origins (no wildcards)
- Specific methods and headers
- Credentials support with proper origin validation
- Preflight caching for performance

Development Mode:
- Localhost origins for local development
- Same security headers as production

Version: 3.0.2
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
    
    Uses explicit allowed origins for production security.
    Supports credentials (cookies/auth headers) with proper origin validation.
    Exposes necessary headers for HLS/media streaming.
    Caches preflight requests for 24 hours to reduce overhead.
    
    Fallback to regex mode if use_cors_regex=True (not recommended with credentials).
    """
    if settings.use_cors_regex:
        # Legacy regex mode (not recommended with credentials=True)
        print(f"WARNING: Using CORS regex mode - not recommended with credentials=True")
        app.add_middleware(
            CORSMiddleware,
            allow_origin_regex=settings.allowed_origin_regex,
            allow_credentials=settings.cors_allow_credentials,
            allow_methods=settings.cors_allow_methods,
            allow_headers=settings.cors_allow_headers,
            expose_headers=settings.cors_expose_headers,
            max_age=settings.cors_max_age,
        )
    else:
        # Secure explicit origins mode (recommended)
        allowed_origins = settings.current_allowed_origins
        mode = "development" if settings.use_development_cors else "production"
        print(f"CORS: {mode} mode with {len(allowed_origins)} allowed origins")
        print(f"CORS origins: {', '.join(allowed_origins)}")
        
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,  # Explicit list, no wildcards
            allow_credentials=settings.cors_allow_credentials,
            allow_methods=settings.cors_allow_methods,
            allow_headers=settings.cors_allow_headers,
            expose_headers=settings.cors_expose_headers,  # For HLS/media/range requests
            max_age=settings.cors_max_age,  # Cache preflight for 6 hours
        )
