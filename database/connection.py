"""
Database Connection
===================

This module provides MariaDB database connection setup and session management
for the ResomiX Audio Similarity API. It configures both synchronous and asynchronous
database engines using SQLAlchemy with proper connection pooling and session handling.

Manages database connections, session factories, and dependency injection
for FastAPI endpoints with environment-based configuration.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# MariaDB connection setup
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DB_URL = (
    "mariadb+mariadbconnector://{user}:{password}@{host}:{port}/{db}"
    .format(
        user=os.getenv("MARIA_DB_USER"),
        password=os.getenv("MARIA_DB_PASS"),
        host=os.getenv("MARIA_DB_HOST"),
        port=os.getenv("MARIA_DB_PORT"),
        db=os.getenv("MARIA_DB_NAME"),
    )
)

# Async DB URL for FastAPI
ASYNC_DB_URL = (
    "mariadb+aiomysql://{user}:{password}@{host}:{port}/{db}"
    .format(
        user=os.getenv("MARIA_DB_USER"),
        password=os.getenv("MARIA_DB_PASS"),
        host=os.getenv("MARIA_DB_HOST"),
        port=os.getenv("MARIA_DB_PORT"),
        db=os.getenv("MARIA_DB_NAME"),
    )
)

# Synchronous engine and session (for existing code)
engine = create_engine(
    DB_URL,
    pool_pre_ping=True,      # helps with stale connections
    future=True,             # SQLAlchemy 2.x style
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Async engine and session for FastAPI
async_engine = create_async_engine(
    ASYNC_DB_URL,
    pool_pre_ping=True,
    future=True,
)
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
)

def list_tables() -> list[str]:
    insp = inspect(engine)
    return insp.get_table_names()

# Dependency for FastAPI to get async database session
async def get_async_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Dependency for synchronous database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

if __name__ == "__main__":
    print(list_tables())
