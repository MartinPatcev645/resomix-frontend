"""
Release Repository
==================

This repository handles CRUD operations for the Release model using MariaDB.
It provides release creation, retrieval, and search functionality with support
for artist-based filtering and title-based searches.

Implements get-or-create patterns for release management and provides
comprehensive release operations with proper relationship handling.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.release import Release
from app.repositories.base_repository import BaseRepository


class ReleaseRepository(BaseRepository[Release]):
    """Repository for Release model operations.
    
    Implements the release get-or-create logic from Cache.release() method.
    """
    
    def __init__(self):
        """Initialize ReleaseRepository with Release model."""
        super().__init__(Release)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Release]:
        """Find existing release by title and artist_id (case-insensitive title).
        
        Implements the lookup logic from Cache.release() which uses
        case-insensitive title matching with exact artist_id match.
        
        Args:
            db: Database session
            **kwargs: Should contain 'title' and 'artist_id' fields
            
        Returns:
            Existing Release instance or None
        """
        title = kwargs.get('title')
        artist_id = kwargs.get('artist_id')
        
        if not title or not artist_id:
            return None
            
        # Case-insensitive title lookup with exact artist_id match
        return db.query(self.model).filter(
            and_(
                self.model.title.ilike(title),
                self.model.artist_id == artist_id
            )
        ).first()
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Release]:
        """Async version of _find_existing."""
        title = kwargs.get('title')
        artist_id = kwargs.get('artist_id')
        
        if not title or not artist_id:
            return None
            
        stmt = select(self.model).where(
            and_(
                self.model.title.ilike(title),
                self.model.artist_id == artist_id
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # --- Release-specific methods ---
    
    def get_by_title_and_artist(self, db: Session, title: str, artist_id: int) -> Optional[Release]:
        """Get release by exact title and artist ID match.
        
        Args:
            db: Database session
            title: Release title to search for
            artist_id: Artist ID
            
        Returns:
            Release instance or None
        """
        return db.query(self.model).filter(
            and_(
                self.model.title == title,
                self.model.artist_id == artist_id
            )
        ).first()
    
    async def async_get_by_title_and_artist(self, db: AsyncSession, title: str, artist_id: int) -> Optional[Release]:
        """Async version of get_by_title_and_artist."""
        stmt = select(self.model).where(
            and_(
                self.model.title == title,
                self.model.artist_id == artist_id
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    def get_by_artist_id(self, db: Session, artist_id: int, skip: int = 0, limit: int = 100) -> list[Release]:
        """Get all releases by artist ID.
        
        Args:
            db: Database session
            artist_id: Artist ID to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of releases by the artist
        """
        return (
            db.query(self.model)
            .filter(self.model.artist_id == artist_id)
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    async def async_get_by_artist_id(self, db: AsyncSession, artist_id: int, skip: int = 0, limit: int = 100) -> list[Release]:
        """Async version of get_by_artist_id."""
        stmt = (
            select(self.model)
            .where(self.model.artist_id == artist_id)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def search_by_title(self, db: Session, title_pattern: str, limit: int = 10) -> list[Release]:
        """Search releases by title pattern.
        
        Args:
            db: Database session
            title_pattern: Pattern to search for (supports wildcards)
            limit: Maximum results to return
            
        Returns:
            List of matching releases
        """
        return db.query(self.model).filter(
            self.model.title.ilike(f"%{title_pattern}%")
        ).limit(limit).all()
    
    async def async_search_by_title(self, db: AsyncSession, title_pattern: str, limit: int = 10) -> list[Release]:
        """Async version of search_by_title."""
        stmt = select(self.model).where(
            self.model.title.ilike(f"%{title_pattern}%")
        ).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def get_or_create_by_title_and_artist(self, db: Session, title: str, artist_id: int, **extra_fields) -> Tuple[Release, bool]:
        """Convenience method for release get-or-create pattern.
        
        Args:
            db: Database session
            title: Release title
            artist_id: Primary artist ID
            **extra_fields: Additional fields for release creation
            
        Returns:
            Tuple of (Release instance, was_created)
        """
        release_data = {
            'title': title,
            'artist_id': artist_id,
            **extra_fields
        }
        return self.get_or_create(db, **release_data)
    
    async def async_get_or_create_by_title_and_artist(self, db: AsyncSession, title: str, artist_id: int, **extra_fields) -> Tuple[Release, bool]:
        """Async version of get_or_create_by_title_and_artist."""
        release_data = {
            'title': title,
            'artist_id': artist_id,
            **extra_fields
        }
        return await self.async_get_or_create(db, **release_data)
    
    def get_releases_with_tracks_count(self, db: Session, skip: int = 0, limit: int = 100) -> list[dict]:
        """Get releases with their track counts.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of dictionaries with release info and track count
        """
        from app.models.track import Track
        
        results = (
            db.query(
                self.model,
                db.func.count(Track.id).label('track_count')
            )
            .outerjoin(Track, Track.release_id == self.model.id)
            .group_by(self.model.id)
            .offset(skip)
            .limit(limit)
            .all()
        )
        
        return [
            {
                'release': release,
                'track_count': track_count
            }
            for release, track_count in results
        ]
    
    async def async_get_releases_with_tracks_count(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> list[dict]:
        """Async version of get_releases_with_tracks_count."""
        from app.models.track import Track
        from sqlalchemy import func
        
        stmt = (
            select(
                self.model,
                func.count(Track.id).label('track_count')
            )
            .outerjoin(Track, Track.release_id == self.model.id)
            .group_by(self.model.id)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        results = result.all()
        
        return [
            {
                'release': release,
                'track_count': track_count
            }
            for release, track_count in results
        ]
