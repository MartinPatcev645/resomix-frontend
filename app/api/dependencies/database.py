"""
Database Dependencies
=====================

This module provides FastAPI dependency functions for database session management.
It handles async MariaDB session creation, cleanup, and connection lifecycle
for all API endpoints requiring database access.

Centralizes database session management to ensure proper connection handling
and resource cleanup across the ResomiX application.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# Database session management dependencies 
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from database.connection import AsyncSessionLocal, get_async_db, get_db

# Async database session dependency for FastAPI endpoints
async def get_database_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Database session dependency for FastAPI endpoints.
    Provides an async MariaDB session that automatically handles cleanup.
    
    Usage:
        @app.get("/endpoint")
        async def my_endpoint(db: AsyncSession = Depends(get_database_session)):
            # Use db session here
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Re-export the connection functions for compatibility
get_async_database_session = get_async_db
get_sync_database_session = get_db

async def init_database():
    """
    Initialize database connection.
    This is called during application startup.
    """
    # Database initialization is handled by the engine creation in connection.py
    # No additional initialization needed for MariaDB
    pass

async def close_database():
    """
    Close database connection.
    This is called during application shutdown.
    """
    # Database cleanup is handled automatically by SQLAlchemy
    # Connection pooling manages the lifecycle
    pass
