"""
Health API Router
=================

This module defines the FastAPI router for health check and status endpoints.
It provides system health monitoring and basic API information endpoints
for service monitoring and uptime verification.

Provides essential health check endpoints for monitoring the ResomiX
application status and availability.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Health and status endpoints 
from fastapi import APIRouter

from app.schemas.common import HealthCheckResponse

router = APIRouter(tags=["health"])


@router.get(
    "/",
    response_model=HealthCheckResponse,
    summary="API Information",
    description="Get basic API information including name, version, and status."
)
async def root() -> HealthCheckResponse:
    """Root endpoint that returns API information"""
    return HealthCheckResponse(
        name="ResomiX API",
        version="3.0.1",
        status="running",
        docs_url="/docs"
    )


@router.get(
    "/health",
    summary="Health Check",
    description="Simple health check endpoint to verify service availability."
)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ResomiX API"
    } 