"""
Health API Router
=================

This module defines the FastAPI router for health check and status endpoints.
It provides system health monitoring and basic API information endpoints
for service monitoring and uptime verification.

Provides essential health check endpoints for monitoring the Resomix
application status and availability.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import time
from fastapi import APIRouter, Request
from database.connection import async_engine
from sqlalchemy import text
import app.db.redis as redis_module
import redis.asyncio as aioredis
from app.core.config import settings

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
        name="Resomix API",
        version=settings.app_version,
        status="running",
        docs_url="/docs"
    )


@router.get(
    "/health",
    summary="Health Check",
    description="Simple health check endpoint to verify service availability."
)
async def health_check(request: Request):
    """Deep health check endpoint checking database, Redis, and system uptime."""
    # 1. Calculate uptime
    start_time = getattr(request.app.state, "start_time", None)
    uptime_seconds = time.time() - start_time if start_time else 0.0

    # 2. Check Database (MariaDB)
    db_status = "healthy"
    try:
        async with async_engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "unhealthy"

    # 3. Check Redis pool
    redis_status = "unhealthy"
    if redis_module._redis_pool is None:
        try:
            await redis_module.init_redis_pool()
        except Exception:
            pass

    if redis_module._redis_pool is not None:
        try:
            client = aioredis.Redis(connection_pool=redis_module._redis_pool)
            await client.ping()
            redis_status = "healthy"
            await client.close()
        except Exception:
            pass

    # 4. Overall status
    overall_status = "healthy"
    if db_status == "unhealthy" or redis_status == "unhealthy":
        overall_status = "unhealthy"

    return {
        "status": overall_status,
        "version": settings.app_version,
        "uptime_seconds": round(uptime_seconds, 2),
        "dependencies": {
            "database": db_status,
            "redis": redis_status
        }
    } 