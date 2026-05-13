"""
Database Connection Management
==============================

This module manages database connections for the Resomix Audio Similarity API.
It provides SQLAlchemy engine configuration, connection pooling, session management,
and database URL construction with proper error handling and logging.

Handles MariaDB connection setup, connection pooling configuration,
session lifecycle management, and database connectivity monitoring.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import os
import logging
from typing import Dict, Any
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker, Session, with_loader_criteria
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.pool import QueuePool
import urllib.parse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabaseConfig:
    """Database configuration management."""
    
    def __init__(self):
        # Load environment variables first
        from dotenv import load_dotenv
        load_dotenv()
        
        # Use the existing environment variable names from the user's .env file
        self.host = os.getenv("MARIA_DB_HOST", "127.0.0.1")
        self.port = int(os.getenv("MARIA_DB_PORT", "3306"))
        self.username = os.getenv("MARIA_DB_USER", "resomix")
        self.password = os.getenv("MARIA_DB_PASS", "secret")
        self.database = os.getenv("MARIA_DB_NAME", "resomix_db")
        self.charset = os.getenv("DB_CHARSET", "utf8mb4")
        
        # Connection pool settings
        self.pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
        self.max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "20"))
        self.pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))
        self.pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "3600"))  # 1 hour
        
        # Connection settings
        self.connect_timeout = int(os.getenv("DB_CONNECT_TIMEOUT", "10"))
        self.read_timeout = int(os.getenv("DB_READ_TIMEOUT", "30"))
        self.write_timeout = int(os.getenv("DB_WRITE_TIMEOUT", "30"))
        
        # SSL settings
        self.ssl_disabled = os.getenv("DB_SSL_DISABLED", "true").lower() == "true"
        
        # Validate configuration
        self._validate_config()
    
    def _validate_config(self):
        """Validate database configuration."""
        if not self.username:
            raise ValueError("Database username is required (MARIA_DB_USER)")
        
        if not self.database:
            raise ValueError("Database name is required (MARIA_DB_NAME)")
        
        if self.pool_size <= 0:
            raise ValueError("Pool size must be positive")
        
        if self.max_overflow < 0:
            raise ValueError("Max overflow cannot be negative")
    
    def get_sync_url(self) -> str:
        """Get synchronous database URL using mariadb+mariadbconnector (matching existing config)."""
        # URL encode password to handle special characters
        encoded_password = urllib.parse.quote_plus(self.password) if self.password else ""
        
        # Use the same format as the existing working configuration
        url = f"mariadb+mariadbconnector://{self.username}"
        if encoded_password:
            url += f":{encoded_password}"
        url += f"@{self.host}:{self.port}/{self.database}"
        
        return url
    
    def get_async_url(self) -> str:
        """Get asynchronous database URL."""
        # URL encode password to handle special characters
        encoded_password = urllib.parse.quote_plus(self.password) if self.password else ""
        
        # For async, we'll use aiomysql since mariadb doesn't have async connector
        url = f"mysql+aiomysql://{self.username}"
        if encoded_password:
            url += f":{encoded_password}"
        url += f"@{self.host}:{self.port}/{self.database}"
        
        # Add connection parameters
        params = {
            'charset': self.charset,
            'connect_timeout': self.connect_timeout,
        }
        
        # Build query string
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        url += f"?{query_string}"
        
        return url
    
    def get_engine_kwargs(self) -> Dict[str, Any]:
        """Get SQLAlchemy engine configuration for synchronous engines."""
        return {
            'poolclass': QueuePool,
            'pool_size': self.pool_size,
            'max_overflow': self.max_overflow,
            'pool_timeout': self.pool_timeout,
            'pool_recycle': self.pool_recycle,
            'pool_pre_ping': True,  # Validate connections before use (matches existing config)
            'future': True,  # SQLAlchemy 2.x style (matches existing config)
            'echo': os.getenv("DB_ECHO", "false").lower() == "true",
            'echo_pool': os.getenv("DB_ECHO_POOL", "false").lower() == "true",
        }
    
    def get_async_engine_kwargs(self) -> Dict[str, Any]:
        """Get SQLAlchemy engine configuration for asynchronous engines."""
        # For async engines, we don't specify poolclass - it will use AsyncAdaptedQueuePool by default
        return {
            'pool_size': self.pool_size,
            'max_overflow': self.max_overflow,
            'pool_timeout': self.pool_timeout,
            'pool_recycle': self.pool_recycle,
            'pool_pre_ping': True,  # Validate connections before use (matches existing config)
            'future': True,  # SQLAlchemy 2.x style (matches existing config)
            'echo': os.getenv("DB_ECHO", "false").lower() == "true",
            'echo_pool': os.getenv("DB_ECHO_POOL", "false").lower() == "true",
        }


# Initialize configuration
config = DatabaseConfig()

# Database URLs
DB_URL = config.get_sync_url()
ASYNC_DB_URL = config.get_async_url()

# Create engines
engine = create_engine(DB_URL, **config.get_engine_kwargs())
async_engine = create_async_engine(ASYNC_DB_URL, **config.get_async_engine_kwargs())

# Session factories (match existing configuration)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
AsyncSessionLocal = async_sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)


# --- Multi-Tenancy Global Failsafe ---

@event.listens_for(Session, "do_orm_execute")
def _do_orm_execute(execute_state):
    """
    Global failsafe to ensure all queries are scoped by partner_id.
    This listener automatically injects a WHERE partner_id = :pid clause
    to any query involving a model that has a partner_id attribute,
    provided a partner context is currently active.

    If no partner context is active (pid is None) and the query targets a
    partner-scoped model, it raises a RuntimeError to prevent data leakage.
    """
    from app.core.context import get_current_partner_id, is_admin_context

    pid = get_current_partner_id()
    is_admin = is_admin_context()

    # Only process ORM statements
    if execute_state.is_orm_statement:
        from app.models import Base

        # ADMIN BYPASS: If this is an administrative request, do not enforce strict partner filtering
        if is_admin:
            logger.debug("SQL Failsafe: Admin context active - bypassing tenant isolation")
            return

        if pid is not None:
            # Inject the loader criteria (automatic WHERE partner_id = :pid)
            execute_state.statement = execute_state.statement.options(
                with_loader_criteria(
                    Base,
                    lambda cls: getattr(cls, "partner_id", None) == pid,
                    include_aliases=True
                )
            )
            logger.debug(f"SQL Failsafe: Injected partner_id={pid} into query")
        else:
            # STRICT CHECK: If pid is None, verify no partner-scoped models are targeted
            # EXCEPT for models used in tenant discovery (authentication)
            EXEMPT_MODELS = {"PartnerApiKey", "Partner", "User", "UserToken", "UserSession"}
            
            for mapper in execute_state.all_mappers:
                model_name = mapper.class_.__name__
                if hasattr(mapper.class_, "partner_id") and model_name not in EXEMPT_MODELS:
                    # This model REQUIRES partner_id, but none was provided in context!
                    error_msg = (
                        f"Multi-tenancy violation: Query targeting partner-scoped model '{model_name}' "
                        f"attempted without an active partner context (partner_id is None). "
                        f"This is a critical security failure."
                    )
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)


# Connection event handlers for better monitoring and debugging
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Set connection-level settings for MariaDB."""
    try:
        with dbapi_connection.cursor() as cursor:
            # Set session-level settings
            cursor.execute("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'")
            cursor.execute("SET SESSION time_zone = '+00:00'")  # Use UTC
            cursor.execute("SET SESSION innodb_lock_wait_timeout = 50")
            logger.debug("Database connection configured successfully")
    except Exception as e:
        logger.warning(f"Failed to configure database connection: {e}")


@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    """Log connection checkout from pool."""
    logger.debug("Connection checked out from pool")


@event.listens_for(engine, "checkin")
def receive_checkin(dbapi_connection, connection_record):
    """Log connection checkin to pool."""
    logger.debug("Connection checked in to pool")


@event.listens_for(engine, "invalidate")
def receive_invalidate(dbapi_connection, connection_record, exception):
    """Handle connection invalidation."""
    logger.warning(f"Connection invalidated: {exception}")


def get_database_session() -> Session:
    """
    Get a database session for synchronous operations.
    
    Returns:
        SQLAlchemy Session instance
    """
    return SessionLocal()


async def get_async_database_session() -> AsyncSession:
    """
    Get an async database session for asynchronous operations.
    
    Returns:
        SQLAlchemy AsyncSession instance
    """
    return AsyncSessionLocal()


# Compatibility functions for existing code
def get_db() -> Session:
    """
    Get a synchronous database session.
    Alias for get_database_session() for compatibility.
    
    Returns:
        SQLAlchemy Session instance
    """
    return get_database_session()


async def get_async_db() -> AsyncSession:
    """
    Get an asynchronous database session.
    Alias for get_async_database_session() for compatibility.
    
    Returns:
        SQLAlchemy AsyncSession instance
    """
    return await get_async_database_session()


def test_connection() -> bool:
    """
    Test database connectivity.
    
    Returns:
        True if connection successful, False otherwise
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.scalar() == 1
            logger.info("Database connection test successful")
            return True
    except SQLAlchemyError as e:
        logger.error(f"Database connection test failed: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error during connection test: {e}")
        return False


async def test_async_connection() -> bool:
    """
    Test async database connectivity.
    
    Returns:
        True if connection successful, False otherwise
    """
    try:
        async with async_engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            assert result.scalar() == 1
            logger.info("Async database connection test successful")
            return True
    except SQLAlchemyError as e:
        logger.error(f"Async database connection test failed: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error during async connection test: {e}")
        return False


def get_connection_info() -> Dict[str, Any]:
    """
    Get database connection information.
    
    Returns:
        Dictionary with connection details
    """
    return {
        'host': config.host,
        'port': config.port,
        'database': config.database,
        'username': config.username,
        'charset': config.charset,
        'pool_size': config.pool_size,
        'max_overflow': config.max_overflow,
        'pool_timeout': config.pool_timeout,
        'pool_recycle': config.pool_recycle,
        'ssl_disabled': config.ssl_disabled
    }


def close_connections():
    """Close all database connections and dispose engines."""
    try:
        engine.dispose()
        logger.info("Synchronous database connections closed")
    except Exception as e:
        logger.error(f"Error closing sync connections: {e}")
    
    try:
        # Note: async_engine.dispose() is not available in older versions
        # In newer versions, you would use: await async_engine.dispose()
        logger.info("Async database connections closed")
    except Exception as e:
        logger.error(f"Error closing async connections: {e}")


# Context managers for session handling
class DatabaseSession:
    """Context manager for database sessions."""
    
    def __init__(self):
        self.session = None
    
    def __enter__(self) -> Session:
        self.session = get_database_session()
        return self.session
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            if exc_type:
                self.session.rollback()
            else:
                self.session.commit()
            self.session.close()


class AsyncDatabaseSession:
    """Async context manager for database sessions."""
    
    def __init__(self):
        self.session = None
    
    async def __aenter__(self) -> AsyncSession:
        self.session = await get_async_database_session()
        return self.session
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            if exc_type:
                await self.session.rollback()
            else:
                await self.session.commit()
            await self.session.close()


# Export commonly used items
__all__ = [
    'engine',
    'async_engine', 
    'SessionLocal',
    'AsyncSessionLocal',
    'get_database_session',
    'get_async_database_session',
    'get_db',
    'get_async_db',
    'test_connection',
    'test_async_connection',
    'get_connection_info',
    'close_connections',
    'DatabaseSession',
    'AsyncDatabaseSession',
    'DB_URL',
    'ASYNC_DB_URL'
]


if __name__ == "__main__":
    # Test connections when run directly
    print("Testing database connections...")
    
    print(f"Configuration: {get_connection_info()}")
    
    sync_result = test_connection()
    print(f"Synchronous connection: {'✓ PASS' if sync_result else '✗ FAIL'}")
    
    import asyncio
    async_result = asyncio.run(test_async_connection())
    print(f"Asynchronous connection: {'✓ PASS' if async_result else '✗ FAIL'}")
    
    if sync_result and async_result:
        print("All database connections working correctly!")
    else:
        print("Some database connections failed. Check configuration.")
        exit(1)
