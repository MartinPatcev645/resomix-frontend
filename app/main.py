"""
FastAPI Application Entry Point
===============================

This is the main FastAPI application entry point for the Resomix Audio Similarity API.
It configures the FastAPI app, sets up global exception handlers for standardized responses,
includes all API routers, and handles CORS middleware for cross-origin requests.

The application provides audio similarity matching, track search, metadata retrieval,
and user feedback/contact functionality with MariaDB database integration.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# FastAPI app creation and configuration
import shutil
import os
import logging
import traceback
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.exceptions import HTTPException

# Import configuration and core components
from app.core.config import settings

# Import middleware setup
from app.api.middlewares.cors import setup_cors
from app.observability import TimingMiddleware
from app.api.middlewares.rate_limit import limiter, rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Import all routers
from app.api.routers import all_routers

# Import actual database engine for lifecycle management
from database.connection import async_engine

# Import Redis pool manager
from app.db.redis import init_redis_pool, close_redis_pool
from app.services.cleanup_worker import start_session_cleanup_worker
from app.services.telemetry_worker import start_telemetry_flush_worker
from app.services.quota_worker import start_quota_sync_worker
import asyncio

# Import FFmpeg check utility
from app.services.audio_service import AudioService
from app.services.logging_service import LoggingService

# Import response formatting utility
from app.utils.response_utils import format_response


# Global exception handlers
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle Pydantic validation errors and return standardized format.
    """
    # Extract validation error details
    details = []
    for error in exc.errors():
        field_path = " -> ".join(
            str(loc) for loc in error["loc"][1:]
        )  # Skip 'body' prefix
        details.append(
            {"field": field_path, "message": error["msg"], "value": error.get("input")}
        )

    return JSONResponse(
        status_code=422,
        content=format_response(
            success=False, error="Validation failed", data={"details": details}
        ),
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    """Handler for HTTP exceptions (e.g., 404, 401, 500)"""
    # Create logging service instance
    logging_service = LoggingService()

    # Log the exception internally
    logging_service.log(
        level="WARNING" if exc.status_code < 500 else "ERROR",
        category="INTERNAL",
        action="http_exception",
        message=f"HTTP Exception {exc.status_code}: {exc.detail}",
        request=request,
        status_code=exc.status_code,
        error=exc,
    )

    # For 500 internal server errors, never expose the detail to the client
    error_message = exc.detail
    if exc.status_code == 500:
        error_message = "An internal server error occurred. Please try again later."

    return JSONResponse(
        status_code=exc.status_code,
        content=format_response(success=False, error=error_message),
    )


async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle unexpected exceptions and return standardized format.
    Logs full exception details server-side but returns generic message to client.
    """
    # Create a logger for this handler
    logger = logging.getLogger("app.main")

    # Log the full exception with context
    logger.error(
        f"Unhandled exception in {request.method} {request.url.path}: {exc.__class__.__name__}: {str(exc)}",
        exc_info=True,  # This logs the full stack trace
    )

    # In development mode, also print to console for quick debugging
    if settings.use_development_cors:
        print(f"\n{'='*60}")
        print(f"Unhandled Exception: {exc.__class__.__name__}")
        print(f"Request: {request.method} {request.url.path}")
        print(f"Message: {str(exc)}")
        print(f"{'='*60}\n")
        traceback.print_exc()

    # Always return a generic error message to the client (never expose internals)
    return JSONResponse(
        status_code=500,
        content=format_response(
            success=False,
            error="An internal server error occurred. Please try again later.",
        ),
    )


# Lifespan context manager
@asynccontextmanager
async def lifespan(app_instance: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan manager for FastAPI application startup and shutdown.
    Initializes external services on startup and cleans up on shutdown.
    """
    print("Application startup: Initializing external services via lifespan...")

    # Test MariaDB database connection
    try:
        async with async_engine.begin() as conn:
            result = await conn.execute(text("SELECT 1"))
            result.fetchone()
        print("MariaDB database connection established successfully.")
    except Exception as e:
        print(f"WARNING: Failed to connect to MariaDB database: {e}")

    # Create temporary directory for uploads if it doesn't exist
    if not os.path.exists(settings.temp_dir):
        os.makedirs(settings.temp_dir)

    # Create exports directory if it doesn't exist
    exports_dir = os.path.join(os.getcwd(), "exports")
    if not os.path.exists(exports_dir):
        os.makedirs(exports_dir)
        print(f"Created exports directory: {exports_dir}")

    # Check if FFmpeg is installed at startup
    ffmpeg_available = AudioService.is_ffmpeg_installed()
    if not ffmpeg_available:
        print(
            "WARNING: FFmpeg is not installed or not found in PATH. Audio file validation will be skipped."
        )

    # Initialize Redis connection pool
    print("Application startup: Initializing Redis connection pool...")
    await init_redis_pool()

    # Start the session background worker task
    print("Application startup: Starting Session Cleanup Worker...")
    app_instance.state.cleanup_worker_task = asyncio.create_task(
        start_session_cleanup_worker()
    )

    # Start the Telemetry Flush background worker task
    print("Application startup: Starting Telemetry Flush Worker...")
    app_instance.state.telemetry_worker_task = asyncio.create_task(
        start_telemetry_flush_worker()
    )

    # Start the Quota Sync background worker task
    print("Application startup: Starting Quota Sync Worker...")
    app_instance.state.quota_sync_worker_task = asyncio.create_task(
        start_quota_sync_worker()
    )

    print("Application startup: External services initialization complete (lifespan).")

    yield

    print("Application shutdown: Cleaning up resources (lifespan)...")

    # Close database engine and all connections
    await async_engine.dispose()
    print("MariaDB database connections closed.")

    # Stop Background Worker
    if hasattr(app_instance.state, "cleanup_worker_task"):
        app_instance.state.cleanup_worker_task.cancel()
        try:
            await app_instance.state.cleanup_worker_task
        except asyncio.CancelledError:
            pass
        print("Session Cleanup Worker stopped.")

    # Stop Telemetry Flush Worker
    if hasattr(app_instance.state, "telemetry_worker_task"):
        app_instance.state.telemetry_worker_task.cancel()
        try:
            await app_instance.state.telemetry_worker_task
        except asyncio.CancelledError:
            pass
        print("Telemetry Flush Worker stopped.")

    # Stop Quota Sync Worker
    if hasattr(app_instance.state, "quota_sync_worker_task"):
        app_instance.state.quota_sync_worker_task.cancel()
        try:
            await app_instance.state.quota_sync_worker_task
        except asyncio.CancelledError:
            pass
        print("Quota Sync Worker stopped.")

    # Close Redis connection pool
    await close_redis_pool()
    print("Redis connections closed.")

    # Clean up temp directory on shutdown
    if os.path.exists(settings.temp_dir):
        shutil.rmtree(settings.temp_dir)
        print(f"Cleaned up temporary directory: {settings.temp_dir}")

    print("Application shutdown: Resource cleanup complete (lifespan).")


# Create FastAPI app
# Conditionally disable docs endpoints in production (when use_development_cors is False)

# Configure OpenAPI servers list to prevent private IP disclosure
servers = []
if settings.use_development_cors:
    # In development, include localhost
    servers.append(
        {"url": "http://localhost:8001", "description": "Development server"}
    )
# Always include production URL if available
if (
    settings.resomix_server_url
    and settings.resomix_server_url != "http://localhost:8001"
):
    servers.append(
        {"url": settings.resomix_server_url, "description": "Production server"}
    )

app = FastAPI(
    title=settings.app_title,
    description=settings.app_description,
    version=settings.app_version,
    lifespan=lifespan,
    servers=(
        servers if servers else None
    ),  # Explicitly define servers to prevent IP disclosure
    # Disable docs, redoc, and openapi.json in production
    docs_url="/docs" if settings.use_development_cors else None,
    redoc_url="/redoc" if settings.use_development_cors else None,
    openapi_url="/openapi.json" if settings.use_development_cors else None,
)

# Add global exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)


# Standard standard-response middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Middleware to add security headers to all responses.
    Prevents MIME-sniffing attacks and other security vulnerabilities.
    """
    response = await call_next(request)

    # Prevent browsers from MIME-sniffing (helps prevent XSS)
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Optional: Add other security headers for defense-in-depth
    # Prevent clickjacking attacks
    response.headers["X-Frame-Options"] = "DENY"

    # Control how much referrer information is passed
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    return response


# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Setup CORS middleware
setup_cors(app)
# Add timing middleware *after* CORS so we measure downstream handlers too
app.add_middleware(TimingMiddleware)

# Mount static files for exports BEFORE including routers to avoid conflicts
exports_dir = os.path.join(os.getcwd(), "exports")
if not os.path.exists(exports_dir):
    os.makedirs(exports_dir)
    print(f"Created exports directory for static serving: {exports_dir}")

try:
    app.mount("/exports", StaticFiles(directory=exports_dir), name="exports")
    print(f"Mounted /exports static files from: {exports_dir}")
except Exception as e:
    print(f"WARNING: Failed to mount /exports static files: {e}")

# Include all routers
for router in all_routers:
    app.include_router(router)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint that returns API information"""
    response = {
        "name": settings.app_title,
        "version": settings.app_version,
        "status": "running",
    }
    # Only include docs_url in development mode
    if settings.use_development_cors:
        response["docs_url"] = "/docs"
    return response


if __name__ == "__main__":
    import uvicorn

    # It's good practice to make host and port configurable
    uvicorn.run(app, host="0.0.0.0", port=8001)
