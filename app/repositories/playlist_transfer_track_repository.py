"""
Playlist Transfer Track Repository
==================================

This repository handles CRUD operations for the PlaylistTransferTrack model,
which stores external music platform track IDs for caching purposes during playlist transfers.
It prevents repeated searches on platforms like Spotify, Apple Music, Tidal, etc.

Provides methods for caching and retrieving track IDs from various music platforms
to optimize playlist transfer operations.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import List, Dict, Optional
from sqlalchemy import select, and_
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.mysql import insert

from app.models.playlist_transfer_track import PlaylistTransferTrack
from app.repositories.base_repository import BaseRepository


class PlaylistTransferTrackRepository(BaseRepository[PlaylistTransferTrack]):
    """Repository for PlaylistTransferTrack model operations"""
    
    def __init__(self):
        """Initialize PlaylistTransferTrackRepository with PlaylistTransferTrack model"""
        super().__init__(PlaylistTransferTrack)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[PlaylistTransferTrack]:
        """Find existing playlist transfer track by track_id"""
        track_id = kwargs.get('track_id')
        if not track_id:
            return None
            
        return db.query(self.model).filter(self.model.track_id == track_id).first()
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[PlaylistTransferTrack]:
        """Async version of _find_existing"""
        track_id = kwargs.get('track_id')
        if not track_id:
            return None
            
        stmt = select(self.model).where(self.model.track_id == track_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # --- Spotify-specific methods ---
    
    async def async_get_spotify_ids(self, db: AsyncSession, track_ids: List[int]) -> Dict[int, str]:
        """
        Get cached Spotify IDs for multiple tracks
        
        Args:
            db: Database session
            track_ids: List of track IDs to look up
            
        Returns:
            Dictionary mapping track_id -> spotify_id for found entries
        """
        if not track_ids:
            return {}
            
        stmt = select(self.model.track_id, self.model.spotify_id).where(
            and_(
                self.model.track_id.in_(track_ids),
                self.model.spotify_id.isnot(None)
            )
        )
        result = await db.execute(stmt)
        
        return {track_id: spotify_id for track_id, spotify_id in result.fetchall()}
    
    def get_spotify_ids(self, db: Session, track_ids: List[int]) -> Dict[int, str]:
        """
        Sync version of get_spotify_ids
        
        Args:
            db: Database session
            track_ids: List of track IDs to look up
            
        Returns:
            Dictionary mapping track_id -> spotify_id for found entries
        """
        if not track_ids:
            return {}
            
        results = (
            db.query(self.model.track_id, self.model.spotify_id)
            .filter(
                and_(
                    self.model.track_id.in_(track_ids),
                    self.model.spotify_id.isnot(None)
                )
            )
            .all()
        )
        
        return {track_id: spotify_id for track_id, spotify_id in results}
    
    async def async_upsert_spotify_id(self, db: AsyncSession, track_id: int, spotify_id: str) -> PlaylistTransferTrack:
        """
        Insert or update Spotify ID for a track
        
        Args:
            db: Database session
            track_id: Track ID
            spotify_id: Spotify track ID/URI
            
        Returns:
            PlaylistTransferTrack instance
        """
        # Use MySQL's ON DUPLICATE KEY UPDATE for upsert
        stmt = insert(PlaylistTransferTrack).values(
            track_id=track_id,
            spotify_id=spotify_id
        )
        
        # Update spotify_id if record already exists
        stmt = stmt.on_duplicate_key_update(
            spotify_id=stmt.inserted.spotify_id,
            updated_at=stmt.inserted.updated_at
        )
        
        await db.execute(stmt)
        await db.commit()
        
        # Return the created/updated record
        return await self.async_get_by_track_id(db, track_id)
    
    def upsert_spotify_id(self, db: Session, track_id: int, spotify_id: str) -> PlaylistTransferTrack:
        """
        Sync version of upsert_spotify_id
        
        Args:
            db: Database session
            track_id: Track ID
            spotify_id: Spotify track ID/URI
            
        Returns:
            PlaylistTransferTrack instance
        """
        existing = self._find_existing(db, track_id=track_id)
        
        if existing:
            existing.spotify_id = spotify_id
            db.commit()
            db.refresh(existing)
            return existing
        else:
            new_record = PlaylistTransferTrack(
                track_id=track_id,
                spotify_id=spotify_id
            )
            db.add(new_record)
            db.commit()
            db.refresh(new_record)
            return new_record
    
    async def async_batch_upsert_spotify_ids(self, db: AsyncSession, track_spotify_map: Dict[int, str]) -> List[PlaylistTransferTrack]:
        """
        Batch insert/update multiple Spotify IDs
        
        Args:
            db: Database session
            track_spotify_map: Dictionary mapping track_id -> spotify_id
            
        Returns:
            List of PlaylistTransferTrack instances
        """
        if not track_spotify_map:
            return []
        
        # Prepare batch insert/update
        values = [
            {
                'track_id': track_id,
                'spotify_id': spotify_id
            }
            for track_id, spotify_id in track_spotify_map.items()
        ]
        
        stmt = insert(PlaylistTransferTrack).values(values)
        stmt = stmt.on_duplicate_key_update(
            spotify_id=stmt.inserted.spotify_id,
            updated_at=stmt.inserted.updated_at
        )
        
        await db.execute(stmt)
        await db.commit()
        
        # Return the updated records
        track_ids = list(track_spotify_map.keys())
        return await self.async_get_by_track_ids(db, track_ids)
    
    # --- Tidal-specific methods ---
    
    async def async_get_tidal_ids(self, db: AsyncSession, track_ids: List[int]) -> Dict[int, str]:
        """
        Get cached Tidal IDs for multiple tracks
        
        Args:
            db: Database session
            track_ids: List of track IDs to look up
            
        Returns:
            Dictionary mapping track_id -> tidal_id for found entries
        """
        if not track_ids:
            return {}
            
        stmt = select(self.model.track_id, self.model.tidal_id).where(
            and_(
                self.model.track_id.in_(track_ids),
                self.model.tidal_id.isnot(None)
            )
        )
        result = await db.execute(stmt)
        
        return {track_id: tidal_id for track_id, tidal_id in result.fetchall()}
    
    def get_tidal_ids(self, db: Session, track_ids: List[int]) -> Dict[int, str]:
        """
        Sync version of get_tidal_ids
        
        Args:
            db: Database session
            track_ids: List of track IDs to look up
            
        Returns:
            Dictionary mapping track_id -> tidal_id for found entries
        """
        if not track_ids:
            return {}
            
        results = (
            db.query(self.model.track_id, self.model.tidal_id)
            .filter(
                and_(
                    self.model.track_id.in_(track_ids),
                    self.model.tidal_id.isnot(None)
                )
            )
            .all()
        )
        
        return {track_id: tidal_id for track_id, tidal_id in results}
    
    async def async_upsert_tidal_id(self, db: AsyncSession, track_id: int, tidal_id: str) -> PlaylistTransferTrack:
        """
        Insert or update Tidal ID for a track
        
        Args:
            db: Database session
            track_id: Track ID
            tidal_id: Tidal track ID
            
        Returns:
            PlaylistTransferTrack instance
        """
        # Use MySQL's ON DUPLICATE KEY UPDATE for upsert
        stmt = insert(PlaylistTransferTrack).values(
            track_id=track_id,
            tidal_id=tidal_id
        )
        
        # Update tidal_id if record already exists
        stmt = stmt.on_duplicate_key_update(
            tidal_id=stmt.inserted.tidal_id,
            updated_at=stmt.inserted.updated_at
        )
        
        await db.execute(stmt)
        await db.commit()
        
        # Return the created/updated record
        return await self.async_get_by_track_id(db, track_id)
    
    def upsert_tidal_id(self, db: Session, track_id: int, tidal_id: str) -> PlaylistTransferTrack:
        """
        Sync version of upsert_tidal_id
        
        Args:
            db: Database session
            track_id: Track ID
            tidal_id: Tidal track ID
            
        Returns:
            PlaylistTransferTrack instance
        """
        existing = self._find_existing(db, track_id=track_id)
        
        if existing:
            existing.tidal_id = tidal_id
            db.commit()
            db.refresh(existing)
            return existing
        else:
            new_record = PlaylistTransferTrack(
                track_id=track_id,
                tidal_id=tidal_id
            )
            db.add(new_record)
            db.commit()
            db.refresh(new_record)
            return new_record
    
    async def async_batch_upsert_tidal_ids(self, db: AsyncSession, track_tidal_map: Dict[int, str]) -> List[PlaylistTransferTrack]:
        """
        Batch insert/update multiple Tidal IDs
        
        Args:
            db: Database session
            track_tidal_map: Dictionary mapping track_id -> tidal_id
            
        Returns:
            List of PlaylistTransferTrack instances
        """
        if not track_tidal_map:
            return []
        
        # Prepare batch insert/update
        values = [
            {
                'track_id': track_id,
                'tidal_id': tidal_id
            }
            for track_id, tidal_id in track_tidal_map.items()
        ]
        
        stmt = insert(PlaylistTransferTrack).values(values)
        stmt = stmt.on_duplicate_key_update(
            tidal_id=stmt.inserted.tidal_id,
            updated_at=stmt.inserted.updated_at
        )
        
        await db.execute(stmt)
        await db.commit()
        
        # Return the updated records
        track_ids = list(track_tidal_map.keys())
        return await self.async_get_by_track_ids(db, track_ids)
    
    # --- General utility methods ---
    
    async def async_get_by_track_id(self, db: AsyncSession, track_id: int) -> Optional[PlaylistTransferTrack]:
        """Get playlist transfer track by track_id"""
        stmt = select(self.model).where(self.model.track_id == track_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def async_get_by_track_ids(self, db: AsyncSession, track_ids: List[int]) -> List[PlaylistTransferTrack]:
        """Get playlist transfer tracks by multiple track_ids"""
        if not track_ids:
            return []
            
        stmt = select(self.model).where(self.model.track_id.in_(track_ids))
        result = await db.execute(stmt)
        return result.scalars().all()
