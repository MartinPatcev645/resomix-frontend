# FastAPI app creation and configuration 
import shutil
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI

# Import configuration and core components
from app.core.config import settings

# Import middleware setup
from app.api.middlewares.cors import setup_cors

# Import all routers
from app.api.routers import all_routers

# Import services for lifespan management
from src.search import initialize_mongodb_client, close_mongodb_client
from src.feedback import initialize_gspread_client_on_startup
from src.ffmpeg import is_ffmpeg_installed


# Lifespan context manager
@asynccontextmanager
async def lifespan(app_instance: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan manager for FastAPI application startup and shutdown.
    Initializes external services on startup and cleans up on shutdown.
    """
    print("Application startup: Initializing external services via lifespan...")
    
    # Initialize external services
    await initialize_gspread_client_on_startup()
    await initialize_mongodb_client()
    
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
    
    # Close external connections
    await close_mongodb_client()
    
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