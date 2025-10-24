"""
Resomix Audio Similarity API - Application Entry Point
======================================================

This module serves as the main entry point for the Resomix Audio Similarity API.
It configures and starts the FastAPI application using Uvicorn ASGI server
with production-ready settings for host binding and port configuration.

Provides the primary startup script for running the audio similarity service
with proper server configuration and environment-based settings.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Application entry point 
import uvicorn
from app.main import app

if __name__ == "__main__":
    # It's good practice to make host and port configurable
    uvicorn.run(app, host="0.0.0.0", port=8001)
