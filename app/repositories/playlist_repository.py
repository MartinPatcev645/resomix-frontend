"""
Playlist Repository
===================

This repository handles CRUD operations for Playlist and PlaylistTrack models.
It provides playlist creation, track management, and relationship handling
using MariaDB with SQLAlchemy ORM.

Implements playlist operations including similarity playlist creation,
track ordering, and user-based playlist management.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError
from decimal import Decimal
import uuid
from datetime import datetime
from app.models.playlist import Playlist, PlaylistTrack
from app.models.constants import PlaylistType
from app.repositories.base_repository import BaseRepository


class PlaylistRepository(BaseRepository[Playlist]):
    """Repository for Playlist model operations."""
    
    def __init__(self):
        """Initialize PlaylistRepository with Playlist model."""
        super().__init__(Playlist)
    
    async def async_create_similarity_playlist(
        self,
        db: AsyncSession,
        seed_track_id: int,
        track_ids: List[int],
        track_scores: List[float] = None,
        name: str = "Playlist",
        playlist_type: str = PlaylistType.SIMILARITY,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Create a similarity playlist with tracks.
        
        Args:
            db: Database session
            seed_track_id: The ID of the seed track for similarity
            track_ids: List of track IDs to include in playlist (similar tracks)
            track_scores: List of similarity scores for each track (optional)
            name: Playlist name (defaults to "Playlist")
            playlist_type: The type of playlist (defaults to SIMILARITY)
            user_id: Optional user ID to associate playlist with (None for anonymous)
            
        Returns:
            Dictionary with playlist info including uuid (as id) and name
        """
        try:
            # Create the playlist record (UUID is auto-generated in __init__)
            playlist = Playlist(
                user_id=user_id,  # Associate with user if logged in, otherwise anonymous
                name=name,
                is_public=False,  # Keep is_public as 0
                type=playlist_type,
                seed_track_id=seed_track_id
            )
            
            db.add(playlist)
            await db.flush()  # Flush to get the playlist ID
            
            # Add tracks to playlist with positions and scores
            playlist_tracks = []
            for position, track_id in enumerate(track_ids, start=1):
                score = None
                if track_scores and position <= len(track_scores):
                    score = str(track_scores[position - 1])  # Convert to string
                
                playlist_track = PlaylistTrack(
                    playlist_id=playlist.id,
                    track_id=track_id,
                    position= Decimal(str(position)),  # Convert to Decimal for DECIMAL(12,6)
                    score=score
                )
                playlist_tracks.append(playlist_track)
            
            db.add_all(playlist_tracks)
            await db.commit()
            
            return {
                "id": playlist.uuid,  # UUID for external use
                "pk": playlist.id,    # Primary key for internal DB ops
                "name": playlist.name,
                "is_public": playlist.is_public,
                "fork_id": playlist.fork_id or "",
                "is_favorite": False,  # Will be enriched by service layer if user logged in
                "is_following": False  # Will be enriched by service layer if user logged in
            }
            
        except Exception as e:
            await db.rollback()
            print(f"Error creating similarity playlist: {e}")
            raise e
    
    async def async_fork_playlist(
        self,
        db: AsyncSession,
        original_playlist_uuid: str,
        user_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Fork (copy) a public playlist for a user.
        
        Args:
            db: Database session
            original_playlist_uuid: UUID of the playlist to fork
            user_id: ID of the user forking the playlist
            
        Returns:
            Dictionary with forked playlist data in similarity format, or None if not found,
            or dict with error key for business logic failures
        """
        try:
            # 1. Fetch Original Playlist
            original_playlist = await self.async_get_playlist_by_uuid(db, original_playlist_uuid)
            if not original_playlist:
                return None
            
            # Verify playlist is public OR user owns it (users can fork their own playlists)
            if not original_playlist.is_public and original_playlist.user_id != user_id:
                return {"error": "not_public"}
            
            # Note: We allow users to fork their own playlists (both public and private)
            # This allows users to create copies/duplicates of their own playlists
            
            # 2. Generate New UUID
            new_uuid = str(uuid.uuid4())
            
            # 3. Create New Playlist Record
            forked_playlist = Playlist(
                uuid=new_uuid,
                user_id=user_id,
                name=original_playlist.name,
                is_public=False,  # Forked playlists default to private
                type=original_playlist.type,
                seed_track_id=original_playlist.seed_track_id,
                fork_id=original_playlist_uuid,  # Link back to original
                forked_at=datetime.utcnow(),
                fork_count=0  # New playlist starts with 0 forks
                # created_at is automatically set by database with current timestamp
            )
            
            db.add(forked_playlist)
            await db.flush()  # Flush to get the new playlist ID
            
            # 4. Fetch Original Playlist Tracks
            stmt = select(PlaylistTrack).where(
                PlaylistTrack.playlist_id == original_playlist.id
            ).order_by(PlaylistTrack.position.asc())
            
            result = await db.execute(stmt)
            original_tracks = result.scalars().all()
            
            # 5. Create Forked Playlist Tracks with Reset Positions
            forked_tracks = []
            for i, original_track in enumerate(original_tracks):
                forked_track = PlaylistTrack(
                    playlist_id=forked_playlist.id,
                    track_id=original_track.track_id,
                    position=Decimal(str(i + 1)),  # Reset to 1.0, 2.0, 3.0, etc.
                    score=original_track.score  # Keep same score
                )
                forked_tracks.append(forked_track)
            
            db.add_all(forked_tracks)
            
            # 6. Increment Original Playlist Fork Count
            original_playlist.fork_count += 1
            
            # 7. Commit Transaction
            await db.commit()
            
            # 8. Return Success Data
            return await self.async_get_playlist_similarity_data(db, new_uuid, allow_private=True, user_id=user_id)
            
        except Exception as e:
            await db.rollback()
            print(f"Error forking playlist: {e}")
            return None
    
    async def async_get_playlist_with_tracks(self, db: AsyncSession, playlist_id: int) -> Optional[Playlist]:
        """
        Get playlist with all tracks loaded.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            
        Returns:
            Playlist with tracks loaded or None if not found
        """
        stmt = (
            select(self.model)
            .where(self.model.id == playlist_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def async_get_tracks_by_playlist_id(self, db: AsyncSession, playlist_id: int) -> List[PlaylistTrack]:
        """
        Get all playlist tracks for a playlist ordered by position.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            
        Returns:
            List of PlaylistTrack instances ordered by position
        """
        stmt = (
            select(PlaylistTrack)
            .where(PlaylistTrack.playlist_id == playlist_id)
            .order_by(PlaylistTrack.position)
        )
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def create_similarity_playlist_sync(
        self, 
        db: Session, 
        seed_track_id: int, 
        track_ids: List[int],
        name: str = "Playlist",
        playlist_type: str = PlaylistType.SIMILARITY
    ) -> Dict[str, Any]:
        """
        Synchronous version of create_similarity_playlist.
        
        Args:
            db: Database session
            seed_track_id: The ID of the seed track for similarity
            track_ids: List of track IDs to include in playlist (similar tracks)
            name: Playlist name (defaults to "Playlist")
            
        Returns:
            Dictionary with playlist info including uuid (as id) and name
        """
        try:
            # Create the playlist record (UUID is auto-generated in __init__)
            playlist = Playlist(
                user_id=None,  # Anonymous playlist
                name=name,
                is_public=False,  # Keep is_public as 0
                type=playlist_type,
                seed_track_id=seed_track_id
            )
            
            db.add(playlist)
            db.flush()  # Flush to get the playlist ID
            
            # Add tracks to playlist with positions
            playlist_tracks = []
            for position, track_id in enumerate(track_ids, start=1):
                playlist_track = PlaylistTrack(
                    playlist_id=playlist.id,
                    track_id=track_id,
                    position= Decimal(str(position)),  # Convert to Decimal for DECIMAL(12,6)
                )
                playlist_tracks.append(playlist_track)
            
            db.add_all(playlist_tracks)
            db.commit()
            
            return {
                "id": playlist.uuid,  # Return UUID as 'id' field
                "name": playlist.name,
                "is_public": playlist.is_public,
                "fork_id": playlist.fork_id or "",
                "is_favorite": False,  # Sync method - engagement not available in sync context
                "is_following": False  # Sync method - engagement not available in sync context
            }
            
        except Exception as e:
            db.rollback()
            print(f"Error creating similarity playlist: {e}")
            raise e
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[Playlist]:
        """Find existing playlist by provided fields.
        
        For playlists, we typically look up by ID or user_id + name combination.
        
        Args:
            db: Database session
            **kwargs: Fields to search with
            
        Returns:
            Existing Playlist instance or None
        """
        if 'id' in kwargs:
            return db.query(self.model).filter(self.model.id == kwargs['id']).first()
        
        # For similarity playlists, they're typically unique by type and seed_track_id
        if 'type' in kwargs and 'seed_track_id' in kwargs:
            return (
                db.query(self.model)
                .filter(
                    and_(
                        self.model.type == kwargs['type'],
                        self.model.seed_track_id == kwargs['seed_track_id']
                    )
                )
                .first()
            )
        
        # Fallback: look up by user_id and name
        if 'user_id' in kwargs and 'name' in kwargs:
            return (
                db.query(self.model)
                .filter(
                    and_(
                        self.model.user_id == kwargs['user_id'],
                        self.model.name == kwargs['name']
                    )
                )
                .first()
            )
        
        return None
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[Playlist]:
        """Async version of _find_existing."""
        if 'id' in kwargs:
            stmt = select(self.model).where(self.model.id == kwargs['id'])
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        
        # For similarity playlists, they're typically unique by type and seed_track_id
        if 'type' in kwargs and 'seed_track_id' in kwargs:
            stmt = (
                select(self.model)
                .where(
                    and_(
                        self.model.type == kwargs['type'],
                        self.model.seed_track_id == kwargs['seed_track_id']
                    )
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        
        # Fallback: look up by user_id and name
        if 'user_id' in kwargs and 'name' in kwargs:
            stmt = (
                select(self.model)
                .where(
                    and_(
                        self.model.user_id == kwargs['user_id'],
                        self.model.name == kwargs['name']
                    )
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        
        return None

    async def async_get_playlist_by_uuid(self, db: AsyncSession, playlist_uuid: str) -> Optional[Playlist]:
        """
        Get playlist by UUID.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            
        Returns:
            Playlist instance or None if not found
        """
        stmt = select(self.model).where(self.model.uuid == playlist_uuid)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_rename_playlist(self, db: AsyncSession, playlist_uuid: str, new_name: str) -> Dict[str, Any]:
        """
        Rename a playlist by UUID.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            new_name: New playlist name
            
        Returns:
            Dict with success status and old_name if successful
        """
        try:
            playlist = await self.async_get_playlist_by_uuid(db, playlist_uuid)
            if not playlist:
                return {"success": False, "old_name": None}
            
            old_name = playlist.name
            playlist.name = new_name
            await db.commit()
            return {"success": True, "old_name": old_name}
            
        except Exception as e:
            await db.rollback()
            print(f"Error renaming playlist: {e}")
            raise e

    async def async_make_playlist_public(self, db: AsyncSession, playlist_uuid: str, is_public: bool = True) -> bool:
        """
        Make a playlist public or private by UUID.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            is_public: Whether to make the playlist public
            
        Returns:
            True if successful, False if playlist not found
        """
        try:
            playlist = await self.async_get_playlist_by_uuid(db, playlist_uuid)
            if not playlist:
                return False
            
            playlist.is_public = is_public
            await db.commit()
            return True
            
        except Exception as e:
            await db.rollback()
            print(f"Error updating playlist visibility: {e}")
            raise e

    async def async_get_playlist_similarity_data(self, db: AsyncSession, playlist_uuid: str, allow_private: bool = False, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Get playlist with all tracks and similarity data formatted like similarity response.
        Only returns data for public playlists (is_public = 1) unless allow_private is True or user is the owner.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            allow_private: If True, allows access to private playlists (used for fork operations)
            user_id: Optional user ID - if provided, allows access to user's own private playlists
            
        Returns:
            Dictionary with similarity-formatted data or None if not found or not accessible
        """
        try:
            from sqlalchemy.orm import selectinload
            from sqlalchemy import text
            
            # Get playlist with tracks
            stmt = (
                select(self.model)
                .options(selectinload(self.model.playlist_tracks))
                .where(self.model.uuid == playlist_uuid)
            )
            result = await db.execute(stmt)
            playlist = result.scalar_one_or_none()
            
            if not playlist:
                return None
            
            # Check if playlist is public (unless allow_private is True or user is the owner)
            is_owner = user_id is not None and playlist.user_id == user_id
            if not playlist.is_public and not allow_private and not is_owner:
                return {"error": "playlist_not_public"}
            
            # Get seed track details if it exists
            queried_track = None
            if playlist.seed_track_id:
                seed_query = text("""
                    SELECT 
                        t.uuid as id,
                        t.title,
                        t.year,
                        t.duration_sec as duration,
                        COALESCE(l.name, '') as label,
                        COALESCE(
                            GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', '),
                            ''
                        ) as artist
                    FROM tracks t
                    LEFT JOIN labels l ON t.label_id = l.id
                    LEFT JOIN track_artists ta ON t.id = ta.track_id
                    LEFT JOIN artists a ON ta.artist_id = a.id
                    WHERE t.id = :track_id
                    GROUP BY t.id, t.uuid, t.title, t.year, t.duration_sec, l.name
                    LIMIT 1
                """)
                
                seed_result = await db.execute(seed_query, {"track_id": playlist.seed_track_id})
                seed_row = seed_result.first()
                
                if seed_row:
                    queried_track = {
                        "rank": 0,
                        "score": 1.0,
                        "id": seed_row.id,
                        "title": seed_row.title or "Unknown",
                        "year": seed_row.year,
                        "duration": float(seed_row.duration) if seed_row.duration is not None else 0.0,
                        "label": seed_row.label,
                        "artist": seed_row.artist or "Unknown"
                    }
            
            # Get all tracks in playlist with details
            if playlist.playlist_tracks:
                track_ids = [pt.track_id for pt in playlist.playlist_tracks]
                tracks_query = text("""
                    SELECT 
                        t.id as track_id,
                        t.uuid as id,
                        t.title,
                        t.year,
                        t.duration_sec as duration,
                        COALESCE(l.name, '') as label,
                        COALESCE(
                            GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', '),
                            ''
                        ) as artist
                    FROM tracks t
                    LEFT JOIN labels l ON t.label_id = l.id
                    LEFT JOIN track_artists ta ON t.id = ta.track_id
                    LEFT JOIN artists a ON ta.artist_id = a.id
                    WHERE t.id IN :track_ids
                    GROUP BY t.id, t.uuid, t.title, t.year, t.duration_sec, l.name
                """)
                
                tracks_result = await db.execute(tracks_query, {"track_ids": tuple(track_ids)})
                tracks_data = {row.track_id: row for row in tracks_result.fetchall()}
                
                # Build similar tracks list with proper ordering and scores
                similar_tracks = []
                for pt in sorted(playlist.playlist_tracks, key=lambda x: x.position):
                    track_data = tracks_data.get(pt.track_id)
                    if track_data:
                        track_info = {
                            "rank": float(pt.position),
                            "score": float(pt.score) if pt.score else 0.0,
                            "id": track_data.id,
                            "title": track_data.title or "Unknown",
                            "year": track_data.year,
                            "duration": float(track_data.duration) if track_data.duration is not None else 0.0,
                            "label": track_data.label,
                            "artist": track_data.artist or "Unknown"
                        }
                        similar_tracks.append(track_info)
            else:
                similar_tracks = []
            
            # Format response like similarity endpoints
            playlist_dict = {
                "id": playlist.uuid,
                "name": playlist.name,
                "is_public": playlist.is_public,
                "fork_id": playlist.fork_id or "",
                "is_favorite": False,
                "is_following": False
            }
            
            # Enrich with engagement data if user is logged in
            if user_id:
                try:
                    from app.repositories.playlist_engagement_repository import PlaylistEngagementRepository
                    engagement_repo = PlaylistEngagementRepository()
                    engagement = await engagement_repo.async_get_engagement(db, user_id, playlist.id)
                    if engagement:
                        playlist_dict["is_favorite"] = engagement.is_favorite
                        playlist_dict["is_following"] = engagement.is_following
                except Exception as e:
                    # If engagement lookup fails, just use defaults (False)
                    print(f"Error enriching playlist with engagement: {e}")
            
            response_data = {
                "queried_track": queried_track,
                "similar_tracks": similar_tracks,
                "playlist": playlist_dict
            }
            
            return response_data
            
        except Exception as e:
            print(f"Error getting playlist similarity data: {e}")
            raise e
    
    async def async_update_type(self, db: AsyncSession, playlist_id: int, new_type: str) -> bool:
        """
        Update the type of a playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            new_type: New playlist type
            
        Returns:
            True if successful, False if playlist not found
        """
        try:
            stmt = select(self.model).where(self.model.id == playlist_id)
            result = await db.execute(stmt)
            playlist = result.scalar_one_or_none()
            if not playlist:
                return False
            
            playlist.type = new_type
            await db.commit()
            return True
            
        except Exception as e:
            await db.rollback()
            print(f"Error updating playlist type: {e}")
            raise e
    
    async def async_get_playlist_hls_data(self, db: AsyncSession, playlist_uuid: str) -> Optional[Dict[str, Any]]:
        """
        Get playlist tracks with metadata formatted for HLS playlist generation.
        Includes queried track first, followed by all similar tracks in order.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            
        Returns:
            Dictionary with tracks data for HLS or None if not found
        """
        try:
            from sqlalchemy import text
            
            # Get playlist basic info
            playlist = await self.async_get_playlist_by_uuid(db, playlist_uuid)
            if not playlist:
                return None
            
            tracks = []
            
            # First, get the queried track (seed track) if it exists
            if playlist.seed_track_id:
                seed_query = text("""
                    SELECT 
                        t.uuid,
                        t.title,
                        t.duration_sec,
                        COALESCE(
                            GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', '),
                            'Unknown Artist'
                        ) as artist
                    FROM tracks t
                    LEFT JOIN track_artists ta ON t.id = ta.track_id
                    LEFT JOIN artists a ON ta.artist_id = a.id
                    WHERE t.id = :track_id
                    GROUP BY t.id, t.uuid, t.title, t.duration_sec
                    LIMIT 1
                """)
                
                seed_result = await db.execute(seed_query, {"track_id": playlist.seed_track_id})
                seed_row = seed_result.first()
                
                if seed_row:
                    tracks.append({
                        "uuid": seed_row.uuid,
                        "title": seed_row.title or "Unknown",
                        "duration_sec": float(seed_row.duration_sec) if seed_row.duration_sec else 0.0,
                        "artist": seed_row.artist or "Unknown Artist"
                    })
            
            # Then, get all similar tracks in the playlist ordered by position
            similar_tracks_query = text("""
                SELECT 
                    t.uuid,
                    t.title,
                    t.duration_sec,
                    COALESCE(
                        GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', '),
                        'Unknown Artist'
                    ) as artist,
                    pt.position
                FROM playlist_tracks pt
                JOIN tracks t ON pt.track_id = t.id
                LEFT JOIN track_artists ta ON t.id = ta.track_id
                LEFT JOIN artists a ON ta.artist_id = a.id
                WHERE pt.playlist_id = :playlist_id
                GROUP BY t.id, t.uuid, t.title, t.duration_sec, pt.position
                ORDER BY pt.position
            """)
            
            similar_tracks_result = await db.execute(similar_tracks_query, {"playlist_id": playlist.id})
            similar_track_rows = similar_tracks_result.fetchall()
            
            # Add all similar tracks after the queried track
            for row in similar_track_rows:
                tracks.append({
                    "uuid": row.uuid,
                    "title": row.title or "Unknown",
                    "duration_sec": float(row.duration_sec) if row.duration_sec else 0.0,
                    "artist": row.artist or "Unknown Artist"
                })
            
            return {
                "playlist_name": playlist.name,
                "tracks": tracks
            }
            
        except Exception as e:
            print(f"Error getting playlist HLS data: {e}")
            raise e
    
    # ============================================================================
    # Admin Methods
    # ============================================================================
    
    async def async_get_playlist_list_admin(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Get paginated playlist list with filters for admin.
        
        Args:
            db: Database session
            filters: Dictionary containing filter parameters
            
        Returns:
            Dictionary with playlists and pagination metadata
        """
        try:
            from sqlalchemy import and_, or_, func, case
            from datetime import datetime
            
            page = filters.get("page", 1)
            page_size = filters.get("page_size", 30)
            search = filters.get("search")
            search_column = filters.get("search_column", "name")
            is_public = filters.get("is_public")
            type_filter = filters.get("type")
            date_from = filters.get("date_from")
            date_to = filters.get("date_to")
            sort_by = filters.get("sort_by", "id")
            sort_order = filters.get("sort_order", "desc")
            
            # Build base query
            query = select(Playlist)
            conditions = []
            
            # Search filter
            if search:
                if search_column == "id" and search.isdigit():
                    conditions.append(Playlist.id == int(search))
                elif search_column == "uuid":
                    conditions.append(Playlist.uuid == search)
                elif search_column == "name":
                    conditions.append(Playlist.name.like(f"%{search}%"))
                else:
                    # Default to name search
                    conditions.append(Playlist.name.like(f"%{search}%"))
            
            # Visibility filter
            if is_public is not None and is_public != "":
                conditions.append(Playlist.is_public == (is_public == "1"))
            
            # Type filter
            if type_filter:
                conditions.append(Playlist.type == type_filter)
            
            # Date filters
            if date_from:
                try:
                    date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
                    conditions.append(Playlist.created_at >= date_from_obj)
                except ValueError:
                    pass
            
            if date_to:
                try:
                    date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
                    # Add 23:59:59 to include the entire day
                    from datetime import timedelta
                    date_to_obj = date_to_obj + timedelta(days=1) - timedelta(seconds=1)
                    conditions.append(Playlist.created_at <= date_to_obj)
                except ValueError:
                    pass
            
            # Apply conditions
            if conditions:
                query = query.where(and_(*conditions))
            
            # Get total count
            count_query = select(func.count()).select_from(Playlist)
            if conditions:
                count_query = count_query.where(and_(*conditions))
            total_result = await db.execute(count_query)
            total = total_result.scalar() or 0
            
            # Sorting
            if sort_by == "created_at":
                order_column = Playlist.created_at
            else:
                order_column = Playlist.id
            
            if sort_order.lower() == "asc":
                query = query.order_by(order_column.asc())
            else:
                query = query.order_by(order_column.desc())
            
            # Pagination
            offset = (page - 1) * page_size
            query = query.offset(offset).limit(page_size)
            
            # Execute query
            result = await db.execute(query)
            playlists = result.scalars().all()
            
            # Format results
            playlist_list = []
            for playlist in playlists:
                playlist_list.append({
                    "id": playlist.id,
                    "uuid": playlist.uuid,
                    "user_id": playlist.user_id,
                    "name": playlist.name,
                    "is_public": playlist.is_public,
                    "type": playlist.type,
                    "seed_track_id": playlist.seed_track_id,
                    "fork_id": playlist.fork_id,
                    "forked_at": playlist.forked_at.isoformat() if playlist.forked_at else None,
                    "fork_count": playlist.fork_count,
                    "created_at": playlist.created_at.isoformat() if playlist.created_at else None
                })
            
            # Calculate pagination
            total_pages = (total + page_size - 1) // page_size if total > 0 else 0
            
            return {
                "data": playlist_list,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": total_pages
                }
            }
            
        except Exception as e:
            print(f"Error getting admin playlist list: {e}")
            raise e
    
    async def async_delete_playlist_admin(
        self,
        db: AsyncSession,
        playlist_id: int
    ) -> bool:
        """
        Delete a playlist by ID.
        
        Args:
            db: Database session
            playlist_id: Playlist ID to delete
            
        Returns:
            True if deleted, False if not found
        """
        try:
            # Get playlist
            query = select(Playlist).where(Playlist.id == playlist_id)
            result = await db.execute(query)
            playlist = result.scalar_one_or_none()
            
            if not playlist:
                return False
            
            # Delete playlist (cascade will handle playlist_tracks)
            await db.delete(playlist)
            await db.commit()
            
            return True
            
        except Exception as e:
            await db.rollback()
            print(f"Error deleting playlist: {e}")
            raise e
    
    async def async_batch_delete_playlists_admin(
        self,
        db: AsyncSession,
        playlist_ids: List[int]
    ) -> int:
        """
        Delete multiple playlists by IDs.
        
        Args:
            db: Database session
            playlist_ids: List of playlist IDs to delete
            
        Returns:
            Number of playlists deleted
        """
        try:
            from sqlalchemy import delete
            
            # Delete playlists
            stmt = delete(Playlist).where(Playlist.id.in_(playlist_ids))
            result = await db.execute(stmt)
            await db.commit()
            
            return result.rowcount
            
        except Exception as e:
            await db.rollback()
            print(f"Error batch deleting playlists: {e}")
            raise e
    
    async def async_change_playlist_visibility_by_id(
        self,
        db: AsyncSession,
        playlist_id: int,
        is_public: bool
    ) -> bool:
        """
        Change playlist visibility by ID.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            is_public: Whether to make the playlist public
            
        Returns:
            True if successful, False if playlist not found
        """
        try:
            stmt = select(Playlist).where(Playlist.id == playlist_id)
            result = await db.execute(stmt)
            playlist = result.scalar_one_or_none()
            
            if not playlist:
                return False
            
            playlist.is_public = is_public
            await db.commit()
            return True
            
        except Exception as e:
            await db.rollback()
            print(f"Error updating playlist visibility: {e}")
            raise e
    
    async def async_batch_change_playlist_visibility(
        self,
        db: AsyncSession,
        playlist_ids: List[int],
        is_public: bool
    ) -> int:
        """
        Change visibility for multiple playlists by IDs.
        
        Args:
            db: Database session
            playlist_ids: List of playlist IDs to update
            is_public: Whether to make the playlists public
            
        Returns:
            Number of playlists updated
        """
        try:
            from sqlalchemy import update
            
            # Update playlists
            stmt = (
                update(Playlist)
                .where(Playlist.id.in_(playlist_ids))
                .values(is_public=is_public)
            )
            result = await db.execute(stmt)
            await db.commit()
            
            return result.rowcount
            
        except Exception as e:
            await db.rollback()
            print(f"Error batch updating playlist visibility: {e}")
            raise e
    
    async def async_get_all_playlists_for_export(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Get all playlists matching filters for export (no pagination).
        
        Args:
            db: Database session
            filters: Dictionary containing filter parameters
            
        Returns:
            List of playlist dictionaries
        """
        try:
            from sqlalchemy import and_, func
            from datetime import datetime
            
            search = filters.get("search")
            search_column = filters.get("search_column", "name")
            is_public = filters.get("is_public")
            type_filter = filters.get("type")
            date_from = filters.get("date_from")
            date_to = filters.get("date_to")
            sort_by = filters.get("sort_by", "id")
            sort_order = filters.get("sort_order", "desc")
            
            # Build base query
            query = select(Playlist)
            conditions = []
            
            # Search filter
            if search:
                if search_column == "id" and search.isdigit():
                    conditions.append(Playlist.id == int(search))
                elif search_column == "uuid":
                    conditions.append(Playlist.uuid == search)
                elif search_column == "name":
                    conditions.append(Playlist.name.like(f"%{search}%"))
                else:
                    conditions.append(Playlist.name.like(f"%{search}%"))
            
            # Visibility filter
            if is_public is not None and is_public != "":
                conditions.append(Playlist.is_public == (is_public == "1"))
            
            # Type filter
            if type_filter:
                conditions.append(Playlist.type == type_filter)
            
            # Date filters
            if date_from:
                try:
                    date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
                    conditions.append(Playlist.created_at >= date_from_obj)
                except ValueError:
                    pass
            
            if date_to:
                try:
                    date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
                    from datetime import timedelta
                    date_to_obj = date_to_obj + timedelta(days=1) - timedelta(seconds=1)
                    conditions.append(Playlist.created_at <= date_to_obj)
                except ValueError:
                    pass
            
            # Apply conditions
            if conditions:
                query = query.where(and_(*conditions))
            
            # Sorting
            if sort_by == "created_at":
                order_column = Playlist.created_at
            else:
                order_column = Playlist.id
            
            if sort_order.lower() == "asc":
                query = query.order_by(order_column.asc())
            else:
                query = query.order_by(order_column.desc())
            
            # Execute query (no pagination for export)
            result = await db.execute(query)
            playlists = result.scalars().all()
            
            # Format results
            playlist_list = []
            for playlist in playlists:
                playlist_list.append({
                    "id": playlist.id,
                    "uuid": playlist.uuid,
                    "user_id": playlist.user_id or "",
                    "name": playlist.name,
                    "is_public": "Public" if playlist.is_public else "Private",
                    "type": playlist.type.replace('_', ' ').title() if playlist.type else "",
                    "seed_track_id": playlist.seed_track_id or "",
                    "fork_id": playlist.fork_id or "",
                    "forked_at": playlist.forked_at.strftime("%Y-%m-%d %H:%M:%S") if playlist.forked_at else "",
                    "fork_count": playlist.fork_count,
                    "created_at": playlist.created_at.strftime("%Y-%m-%d %H:%M:%S") if playlist.created_at else ""
                })
            
            return playlist_list
            
        except Exception as e:
            print(f"Error getting playlists for export: {e}")
            raise e
    
    async def async_get_playlist_detail_by_uuid_admin(
        self,
        db: AsyncSession,
        playlist_uuid: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get detailed playlist information by UUID for admin.
        
        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            
        Returns:
            Dictionary with complete playlist details or None if not found
        """
        try:
            from sqlalchemy import func
            from sqlalchemy.orm import aliased
            from app.models.track import Track
            from app.models.artist import Artist
            from app.models.genre import Genre
            from app.models.label import Label
            from app.models.album import Album
            from app.models.playlist import PlaylistTrack
            
            # Get playlist
            query = select(Playlist).where(Playlist.uuid == playlist_uuid)
            result = await db.execute(query)
            playlist = result.scalar_one_or_none()
            
            if not playlist:
                return None
            
            # Get track count
            count_query = select(func.count()).select_from(PlaylistTrack).where(
                PlaylistTrack.playlist_id == playlist.id
            )
            count_result = await db.execute(count_query)
            track_count = count_result.scalar() or 0
            
            # Get seed track if exists
            seed_track_data = None
            if playlist.seed_track_id:
                seed_query = select(
                    Track.id,
                    Track.uuid,
                    Track.title,
                    Track.duration_sec,
                    Track.bpm,
                    Track.musical_key,
                    Track.year,
                    Genre.name.label('genre_name'),
                    Label.name.label('label_name')
                ).outerjoin(Genre, Track.genre_id == Genre.id
                ).outerjoin(Label, Track.label_id == Label.id
                ).where(Track.id == playlist.seed_track_id)
                
                seed_result = await db.execute(seed_query)
                seed_row = seed_result.first()
                
                if seed_row:
                    # Get seed track artists
                    from app.models.track import TrackArtist
                    artists_query = select(Artist.name).join(
                        TrackArtist, Artist.id == TrackArtist.artist_id
                    ).where(TrackArtist.track_id == seed_row.id)
                    artists_result = await db.execute(artists_query)
                    artist_names = [row[0] for row in artists_result.fetchall()]
                    
                    seed_track_data = {
                        "id": seed_row.id,
                        "uuid": seed_row.uuid,
                        "title": seed_row.title,
                        "artists": artist_names if artist_names else [],
                        "duration_sec": float(seed_row.duration_sec) if seed_row.duration_sec else 0.0,
                        "bpm": seed_row.bpm,
                        "musical_key": seed_row.musical_key,
                        "genre": seed_row.genre_name,
                        "label": seed_row.label_name,
                        "year": seed_row.year
                    }
            
            # Get all tracks in playlist with metadata
            tracks_query = select(
                PlaylistTrack.position,
                PlaylistTrack.score,
                Track.id,
                Track.uuid,
                Track.title,
                Track.duration_sec,
                Track.file_size,
                Track.type,
                Track.year,
                Track.bpm,
                Track.musical_key,
                Track.file_path,
                Track.preview_path,
                Track.created_at,
                Genre.name.label('genre_name'),
                Label.name.label('label_name'),
                Album.title.label('album_name')
            ).join(Track, PlaylistTrack.track_id == Track.id
            ).outerjoin(Genre, Track.genre_id == Genre.id
            ).outerjoin(Label, Track.label_id == Label.id
            ).outerjoin(Album, Track.album_id == Album.id
            ).where(PlaylistTrack.playlist_id == playlist.id
            ).order_by(PlaylistTrack.position.asc())
            
            tracks_result = await db.execute(tracks_query)
            track_rows = tracks_result.fetchall()
            
            # Format tracks with artists
            tracks_data = []
            for row in track_rows:
                # Get artists for this track
                from app.models.track import TrackArtist
                artists_query = select(Artist.name).join(
                    TrackArtist, Artist.id == TrackArtist.artist_id
                ).where(TrackArtist.track_id == row.id)
                artists_result = await db.execute(artists_query)
                artist_names = [a[0] for a in artists_result.fetchall()]
                
                tracks_data.append({
                    "position": float(row.position),  # Convert Decimal to float for JSON serialization
                    "score": float(row.score) if row.score else None,
                    "track": {
                        "id": row.id,
                        "uuid": row.uuid,
                        "title": row.title,
                        "artists": artist_names if artist_names else [],
                        "duration_sec": float(row.duration_sec) if row.duration_sec else 0.0,
                        "file_size": row.file_size or 0,
                        "type": row.type or "electrobuzz",
                        "genre": row.genre_name,
                        "label": row.label_name,
                        "album": row.album_name,
                        "year": row.year,
                        "bpm": row.bpm,
                        "musical_key": row.musical_key,
                        "file_path": row.file_path,
                        "preview_path": row.preview_path,
                        "created_at": row.created_at.isoformat() if row.created_at else None
                    }
                })
            
            # Format response
            return {
                "playlist": {
                    "id": playlist.id,
                    "uuid": playlist.uuid,
                    "user_id": playlist.user_id,
                    "name": playlist.name,
                    "is_public": playlist.is_public,
                    "type": playlist.type,
                    "seed_track_id": playlist.seed_track_id,
                    "fork_id": playlist.fork_id,
                    "forked_at": playlist.forked_at.isoformat() if playlist.forked_at else None,
                    "fork_count": playlist.fork_count,
                    "created_at": playlist.created_at.isoformat() if playlist.created_at else None,
                    "track_count": track_count
                },
                "seed_track": seed_track_data,
                "tracks": tracks_data
            }
            
        except Exception as e:
            print(f"Error getting playlist detail by UUID: {e}")
            raise e
