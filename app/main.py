# FastAPI app creation and configuration 
import shutil
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException

# Import configuration and core components
from app.core.config import settings

# Import middleware setup
from app.api.middlewares.cors import setup_cors

# Import all routers
from app.api.routers import all_routers

# Import actual database engine for lifecycle management
from database.connection import async_engine

# Import FFmpeg check utility
from src.ffmpeg import is_ffmpeg_installed

# Import response formatting utility
from src.utils import format_response


# Global exception handlers
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle Pydantic validation errors and return standardized format.
    """
    # Extract validation error details
    details = []
    for error in exc.errors():
        field_path = " -> ".join(str(loc) for loc in error["loc"][1:])  # Skip 'body' prefix
        details.append({
            "field": field_path,
            "message": error["msg"],
            "value": error.get("input")
        })
    
    return JSONResponse(
        status_code=422,
        content=format_response(
            success=False,
            error="Validation failed",
            details=details
        )
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Handle HTTP exceptions and return standardized format.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content=format_response(
            success=False,
            error=exc.detail
        )
    )


async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle unexpected exceptions and return standardized format.
    """
    print(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content=format_response(
            success=False,
            error="An internal server error occurred"
        )
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
    
    # Check if FFmpeg is installed at startup
    ffmpeg_available = is_ffmpeg_installed()
    if not ffmpeg_available:
        print("WARNING: FFmpeg is not installed or not found in PATH. Audio file validation will be skipped.")
    
    print("Application startup: External services initialization complete (lifespan).")
    
    yield
    
    print("Application shutdown: Cleaning up resources (lifespan)...")
    
    # Close database engine and all connections
    await async_engine.dispose()
    print("MariaDB database connections closed.")
    
    # Clean up temp directory on shutdown
    if os.path.exists(settings.temp_dir):
        shutil.rmtree(settings.temp_dir)
        print(f"Cleaned up temporary directory: {settings.temp_dir}")
    
    print("Application shutdown: Resource cleanup complete (lifespan).")


# Create FastAPI app
app = FastAPI(
    title=settings.app_title,
    description=settings.app_description,
    version=settings.app_version,
    lifespan=lifespan
)

# Add global exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Setup CORS middleware
setup_cors(app)

# Include all routers
for router in all_routers:
    app.include_router(router)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint that returns API information"""
    return {
        "name": settings.app_title,
        "version": settings.app_version,
        "status": "running",
        "docs_url": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    # It's good practice to make host and port configurable
    uvicorn.run(app, host="0.0.0.0", port=8001)
