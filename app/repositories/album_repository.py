"""
Album Repository
================

This repository handles CRUD operations for the Album model using MariaDB.
It provides album creation, retrieval, and search functionality with support
for artist-based filtering and title-based searches.

Implements get-or-create patterns for album management and provides
comprehensive album operations with proper relationship handling.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.album import Album
from app.repositories.base_repository import BaseRepository


class AlbumRepository(BaseRepository[Album]):
    """Repository for Album model operations.
    
    Implements the album get-or-create logic from Cache.album() method.
    """
    
    def __init__(self):
        """Initialize AlbumRepository with Album model."""
        super().__init__(Album)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Album]:
        """Find existing album by title and artist_id (case-insensitive title).
        
        Implements the lookup logic from Cache.album() which uses
        case-insensitive title matching with exact artist_id match.
        
        Args:
            db: Database session
            **kwargs: Should contain 'title' and 'artist_id' fields
            
        Returns:
            Existing Album instance or None
        """
        title = kwargs.get('title')
        artist_id = kwargs.get('artist_id')
        
        if not title or not artist_id:
            return None
            
        # Case-insensitive title lookup with exact artist_id match
        # This mirrors Cache.album() key = (title.lower(), primary_artist_id)
        return db.query(self.model).filter(
            and_(
                self.model.title.ilike(title),
                self.model.artist_id == artist_id
            )
        ).first()
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Album]:
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
    
    # --- Album-specific methods ---
    
    def get_by_title_and_artist(self, db: Session, title: str, artist_id: int) -> Optional[Album]:
        """Get album by exact title and artist ID match.
        
        Args:
            db: Database session
            title: Album title to search for
            artist_id: Artist ID
            
        Returns:
            Album instance or None
        """
        return db.query(self.model).filter(
            and_(
                self.model.title == title,
                self.model.artist_id == artist_id
            )
        ).first()
    
    async def async_get_by_title_and_artist(self, db: AsyncSession, title: str, artist_id: int) -> Optional[Album]:
        """Async version of get_by_title_and_artist."""
        stmt = select(self.model).where(
            and_(
                self.model.title == title,
                self.model.artist_id == artist_id
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    def get_by_artist_id(self, db: Session, artist_id: int, skip: int = 0, limit: int = 100) -> list[Album]:
        """Get all albums by artist ID.
        
        Args:
            db: Database session
            artist_id: Artist ID to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of albums by the artist
        """
        return (
            db.query(self.model)
            .filter(self.model.artist_id == artist_id)
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    async def async_get_by_artist_id(self, db: AsyncSession, artist_id: int, skip: int = 0, limit: int = 100) -> list[Album]:
        """Async version of get_by_artist_id."""
        stmt = (
            select(self.model)
            .where(self.model.artist_id == artist_id)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def search_by_title(self, db: Session, title_pattern: str, limit: int = 10) -> list[Album]:
        """Search albums by title pattern.
        
        Args:
            db: Database session
            title_pattern: Pattern to search for (supports wildcards)
            limit: Maximum results to return
            
        Returns:
            List of matching albums
        """
        return db.query(self.model).filter(
            self.model.title.ilike(f"%{title_pattern}%")
        ).limit(limit).all()
    
    async def async_search_by_title(self, db: AsyncSession, title_pattern: str, limit: int = 10) -> list[Album]:
        """Async version of search_by_title."""
        stmt = select(self.model).where(
            self.model.title.ilike(f"%{title_pattern}%")
        ).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def get_or_create_by_title_and_artist(self, db: Session, title: str, artist_id: int, **extra_fields) -> Tuple[Album, bool]:
        """Convenience method for album get-or-create pattern.
        
        This directly mirrors the Cache.album() method signature and logic.
        
        Args:
            db: Database session
            title: Album title
            artist_id: Primary artist ID
            **extra_fields: Additional fields for album creation (release_date, cover_image)
            
        Returns:
            Tuple of (Album instance, was_created)
        """
        album_data = {
            'title': title,
            'artist_id': artist_id,
            **extra_fields
        }
        return self.get_or_create(db, **album_data)
    
    async def async_get_or_create_by_title_and_artist(self, db: AsyncSession, title: str, artist_id: int, **extra_fields) -> Tuple[Album, bool]:
        """Async version of get_or_create_by_title_and_artist."""
        album_data = {
            'title': title,
            'artist_id': artist_id,
            **extra_fields
        }
        return await self.async_get_or_create(db, **album_data)
    
    def get_albums_with_tracks_count(self, db: Session, skip: int = 0, limit: int = 100) -> list[dict]:
        """Get albums with their track counts.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of dictionaries with album info and track count
        """
        from app.models.track import Track
        
        results = (
            db.query(
                self.model,
                db.func.count(Track.id).label('track_count')
            )
            .outerjoin(Track)
            .group_by(self.model.id)
            .offset(skip)
            .limit(limit)
            .all()
        )
        
        return [
            {
                'album': album,
                'track_count': track_count
            }
            for album, track_count in results
        ]
    
    async def async_get_albums_with_tracks_count(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> list[dict]:
        """Async version of get_albums_with_tracks_count."""
        from app.models.track import Track
        from sqlalchemy import func
        
        stmt = (
            select(
                self.model,
                func.count(Track.id).label('track_count')
            )
            .outerjoin(Track)
            .group_by(self.model.id)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        results = result.all()
        
        return [
            {
                'album': album,
                'track_count': track_count
            }
            for album, track_count in results
        ] 