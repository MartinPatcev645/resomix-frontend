"""
Rating Repository
=================

This repository handles CRUD operations for TrackRating and PlaylistRating models.
It provides rating creation, updates, retrieval, and statistics functionality
using MariaDB with SQLAlchemy ORM.

Implements rating operations including user-based rating management,
rating statistics, and duplicate rating handling.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import List, Dict, Any, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, delete, text, case, update

from ..models.rating import TrackRating, PlaylistRating
from ..models.track import Track
from ..models.playlist import Playlist, PlaylistTrack
from ..models.user import User
from ..repositories.base_repository import BaseRepository


class TrackRatingRepository(BaseRepository[TrackRating]):
    """Repository for TrackRating model operations."""
    
    def __init__(self):
        """Initialize TrackRatingRepository with TrackRating model."""
        super().__init__(TrackRating)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[TrackRating]:
        """Find existing track rating by user_id, track_id, and playlist_id."""
        if 'user_id' in kwargs and 'track_id' in kwargs and 'playlist_id' in kwargs:
            return db.query(self.model).filter(
                and_(
                    self.model.user_id == kwargs['user_id'],
                    self.model.track_id == kwargs['track_id'],
                    self.model.playlist_id == kwargs['playlist_id']
                )
            ).first()
        return None
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[TrackRating]:
        """Find the user's current track rating (latest row) for (user, track, playlist).

        Duplicate-safe: historically ``async_rate_track`` appended a new row per rating, so more
        than one row can exist for the same (user, track, playlist). We take the most recent one
        (``id`` desc) instead of ``scalar_one_or_none`` (which would raise on duplicates).
        """
        if 'user_id' in kwargs and 'track_id' in kwargs and 'playlist_id' in kwargs:
            stmt = (
                select(self.model)
                .where(
                    and_(
                        self.model.user_id == kwargs['user_id'],
                        self.model.track_id == kwargs['track_id'],
                        self.model.playlist_id == kwargs['playlist_id'],
                    )
                )
                .order_by(self.model.id.desc())
                .limit(1)
            )
            result = await db.execute(stmt)
            return result.scalars().first()
        return None
    
    async def async_rate_track(
        self,
        db: AsyncSession,
        track_id: str,
        playlist_id: str,
        rating: int,
        user_id: Optional[int] = None,
    ) -> Optional[TrackRating]:
        """
        Rate a track with UUID support for both track and playlist.
        
        Args:
            db: Database session
            track_id: Track ID (UUID)
            playlist_id: Playlist ID (UUID)
            rating: Rating value (0 or 1)
            user_id: Optional user ID
            
        Returns:
            TrackRating instance or None if track or playlist doesn't exist
        """
        try:
            # First, try to get the numeric track ID from the identifier
            track_numeric_id = None
            
            # Try looking up by uuid field first
            track_query = await db.execute(
                select(Track.id).where(Track.uuid == track_id)
            )
            track_numeric_id = track_query.scalar_one_or_none()
            
            # If not found and the track_id looks numeric, try direct ID lookup
            if not track_numeric_id and track_id.isdigit():
                try:
                    numeric_id = int(track_id)
                    track_query = await db.execute(
                        select(Track.id).where(Track.id == numeric_id)
                    )
                    track_numeric_id = track_query.scalar_one_or_none()
                except ValueError:
                    pass
            
            if not track_numeric_id:
                return None  # Track not found
            
            # Get the numeric playlist ID from UUID
            from ..models.playlist import Playlist
            playlist_query = await db.execute(
                select(Playlist.id).where(Playlist.uuid == playlist_id)
            )
            playlist_numeric_id = playlist_query.scalar_one_or_none()
            
            if not playlist_numeric_id:
                return None  # Playlist not found

            # Upsert: one rating row per (user, track, playlist). If the user already rated this
            # track here, update that row in place; otherwise insert. Any legacy duplicate rows
            # (from the old append-only behaviour) are collapsed to the single latest row, so
            # "the user's current rating" is always well-defined.
            existing = await self._async_find_existing(
                db, user_id=user_id, track_id=track_numeric_id, playlist_id=playlist_numeric_id
            )
            if existing is not None:
                # Remove any older duplicates, keeping the latest row we're about to update.
                await db.execute(
                    delete(TrackRating).where(
                        and_(
                            TrackRating.user_id == user_id,
                            TrackRating.track_id == track_numeric_id,
                            TrackRating.playlist_id == playlist_numeric_id,
                            TrackRating.id != existing.id,
                        )
                    )
                )
                existing.rating = rating
                existing.rated_at = func.current_timestamp()
                await db.commit()
                await db.refresh(existing)
                return existing

            new_rating = TrackRating(
                user_id=user_id,
                track_id=track_numeric_id,
                playlist_id=playlist_numeric_id,
                rating=rating
            )
            db.add(new_rating)
            await db.commit()
            await db.refresh(new_rating)
            return new_rating

        except Exception as e:
            await db.rollback()
            raise e
    
    async def async_get_track_rating(
        self, 
        db: AsyncSession, 
        track_id: str,  # Changed from int to str (UUID)
        playlist_id: str,  # Added playlist UUID
        user_id: Optional[str] = None
    ) -> Optional[TrackRating]:
        """
        Get user's rating for a specific track in a specific playlist.
        
        Args:
            db: Database session
            track_id: Track ID (UUID, ObjectId, or other format)
            playlist_id: Playlist UUID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            TrackRating instance or None if not found
        """
        try:
            # First, try to get the numeric track ID from the identifier
            track_numeric_id = None
            
            # Try looking up by uuid field first
            track_query = await db.execute(
                select(Track.id).where(Track.uuid == track_id)
            )
            track_numeric_id = track_query.scalar_one_or_none()
            
            # If not found and the track_id looks numeric, try direct ID lookup
            if not track_numeric_id and track_id.isdigit():
                try:
                    numeric_id = int(track_id)
                    track_query = await db.execute(
                        select(Track.id).where(Track.id == numeric_id)
                    )
                    track_numeric_id = track_query.scalar_one_or_none()
                except ValueError:
                    pass
            
            if not track_numeric_id:
                return None  # Track not found
            
            # Get the numeric playlist ID from UUID
            from ..models.playlist import Playlist
            playlist_query = await db.execute(
                select(Playlist.id).where(Playlist.uuid == playlist_id)
            )
            playlist_numeric_id = playlist_query.scalar_one_or_none()
            
            if not playlist_numeric_id:
                return None  # Playlist not found
            
            return await self._async_find_existing(db, user_id=user_id, track_id=track_numeric_id, playlist_id=playlist_numeric_id)
        except Exception as e:
            print(f"Error getting track rating: {e}")
            raise e
    
    async def async_delete_track_rating(
        self, 
        db: AsyncSession, 
        track_id: str,  # Changed from int to str (UUID)
        playlist_id: str,  # Added playlist UUID
        user_id: Optional[str] = None
    ) -> bool:
        """
        Delete user's rating for a specific track in a specific playlist.
        
        Args:
            db: Database session
            track_id: Track ID (UUID, ObjectId, or other format)
            playlist_id: Playlist UUID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            True if deleted, False if not found
        """
        try:
            # First, try to get the numeric track ID from the identifier
            track_numeric_id = None
            
            # Try looking up by uuid field first
            track_query = await db.execute(
                select(Track.id).where(Track.uuid == track_id)
            )
            track_numeric_id = track_query.scalar_one_or_none()
            
            # If not found and the track_id looks numeric, try direct ID lookup
            if not track_numeric_id and track_id.isdigit():
                try:
                    numeric_id = int(track_id)
                    track_query = await db.execute(
                        select(Track.id).where(Track.id == numeric_id)
                    )
                    track_numeric_id = track_query.scalar_one_or_none()
                except ValueError:
                    pass
            
            if not track_numeric_id:
                return False  # Track not found
            
            # Get the numeric playlist ID from UUID
            from ..models.playlist import Playlist
            playlist_query = await db.execute(
                select(Playlist.id).where(Playlist.uuid == playlist_id)
            )
            playlist_numeric_id = playlist_query.scalar_one_or_none()
            
            if not playlist_numeric_id:
                return False  # Playlist not found
            
            stmt = delete(self.model).where(
                and_(
                    self.model.track_id == track_numeric_id,
                    self.model.playlist_id == playlist_numeric_id,
                    self.model.user_id == user_id
                )
            )
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount > 0
        except Exception as e:
            await db.rollback()
            print(f"Error deleting track rating: {e}")
            raise e
    
    async def async_get_track_rating_stats(self, db: AsyncSession, track_id: str) -> Dict[str, Any]:
        """
        Get rating statistics for a specific track.
        
        Args:
            db: Database session
            track_id: Track ID (UUID)
            
        Returns:
            Dictionary with rating statistics
        """
        try:
            # First, resolve the numeric track ID from UUID
            track_query = await db.execute(
                select(Track.id).where(Track.uuid == track_id)
            )
            track_numeric_id = track_query.scalar_one_or_none()
            
            # If not found by UUID and the track_id looks numeric, try direct ID lookup
            if not track_numeric_id and track_id.isdigit():
                try:
                    numeric_id = int(track_id)
                    track_query = await db.execute(
                        select(Track.id).where(Track.id == numeric_id)
                    )
                    track_numeric_id = track_query.scalar_one_or_none()
                except (ValueError, TypeError):
                    pass
            
            if not track_numeric_id:
                return {
                    "total_ratings": 0,
                    "average_rating": None,
                    "rating_distribution": {"0": 0, "1": 0}
                }
            
            # Aggregate stats using a single query
            stmt = select(
                func.count(TrackRating.id).label('total_ratings'),
                func.sum(case((TrackRating.rating == 0, 1), else_=0)).label('not_similar'),
                func.sum(case((TrackRating.rating == 1, 1), else_=0)).label('similar')
            ).where(TrackRating.track_id == track_numeric_id)

            result = await db.execute(stmt)
            row = result.mappings().one()
            
            total = int(row['total_ratings'] or 0)
            if total == 0:
                return {
                    "total_ratings": 0,
                    "average_rating": None,
                    "rating_distribution": {"0": 0, "1": 0}
                }

            return {
                "total_ratings": total,
                "average_rating": None,
                "rating_distribution": {
                    "0": int(row['not_similar'] or 0),
                    "1": int(row['similar'] or 0)
                }
            }
        except Exception as e:
            # Silently handle but log for server-side debugging
            # logger.error(f"Error getting track rating stats for {track_id}: {e}")
            return {
                "total_ratings": 0,
                "average_rating": None,
                "rating_distribution": {"0": 0, "1": 0}
            }

    async def async_get_user_ratings_for_playlist(
        self, db: AsyncSession, playlist_uuid: str, user_id: int
    ) -> Dict[str, int]:
        """Return the user's CURRENT rating for every track they've rated in this playlist.

        Result is ``{track_uuid: rating}`` (rating 0 or 1). One entry per track — the latest row
        wins if legacy duplicates exist. Used to hydrate the playlist screen so a returning user
        sees their thumbs already set.
        """
        if user_id is None:
            return {}
        playlist_numeric_id = await db.scalar(
            select(Playlist.id).where(Playlist.uuid == playlist_uuid)
        )
        if not playlist_numeric_id:
            return {}

        rows = (await db.execute(
            select(TrackRating.track_id, TrackRating.rating, TrackRating.id, Track.uuid)
            .join(Track, Track.id == TrackRating.track_id)
            .where(
                and_(
                    TrackRating.playlist_id == playlist_numeric_id,
                    TrackRating.user_id == user_id,
                )
            )
            .order_by(TrackRating.track_id, TrackRating.id.desc())
        )).all()

        result: Dict[str, int] = {}
        seen: set = set()
        for track_id, rating, _row_id, track_uuid in rows:
            if track_id in seen:
                continue  # rows are latest-first per track, so the first is the current one
            seen.add(track_id)
            if rating is not None:
                result[track_uuid] = int(rating)
        return result


class PlaylistRatingRepository(BaseRepository[PlaylistRating]):
    """Repository for PlaylistRating model operations."""
    
    def __init__(self):
        """Initialize PlaylistRatingRepository with PlaylistRating model."""
        super().__init__(PlaylistRating)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[PlaylistRating]:
        """Find existing playlist rating by user_id and playlist_id."""
        if 'user_id' in kwargs and 'playlist_id' in kwargs:
            return db.query(self.model).filter(
                and_(
                    self.model.user_id == kwargs['user_id'],
                    self.model.playlist_id == kwargs['playlist_id']
                )
            ).first()
        return None
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[PlaylistRating]:
        """Find the current playlist rating (latest row) for a user or a guest visitor.

        Duplicate-safe (latest ``id`` wins). Pass ``user_id`` for a logged-in user, or
        ``visitor_id`` for a guest.
        """
        conds = None
        if kwargs.get('user_id') is not None and 'playlist_id' in kwargs:
            conds = and_(self.model.user_id == kwargs['user_id'],
                         self.model.playlist_id == kwargs['playlist_id'])
        elif kwargs.get('visitor_id') and 'playlist_id' in kwargs:
            conds = and_(self.model.visitor_id == kwargs['visitor_id'],
                         self.model.user_id.is_(None),
                         self.model.playlist_id == kwargs['playlist_id'])
        if conds is None:
            return None
        stmt = select(self.model).where(conds).order_by(self.model.id.desc()).limit(1)
        result = await db.execute(stmt)
        return result.scalars().first()
    
    async def async_rate_playlist(
        self,
        db: AsyncSession,
        playlist_id: str,  # Changed from int to str (UUID)
        rating: int,
        user_id: Optional[str] = None,
        message: Optional[str] = None,
        visitor_id: Optional[str] = None,
    ) -> Optional[PlaylistRating]:
        """
        Rate a playlist by creating a new rating entry.
        
        Args:
            db: Database session
            playlist_id: Playlist UUID to rate
            rating: Rating value (0-3)
            user_id: User ID (optional for anonymous ratings)
            message: Optional user message/feedback
            
        Returns:
            PlaylistRating instance or None if playlist doesn't exist
        """
        try:
            # First, get the numeric playlist ID from UUID
            from ..models.playlist import Playlist
            playlist_query = await db.execute(
                select(Playlist.id).where(Playlist.uuid == playlist_id)
            )
            playlist_numeric_id = playlist_query.scalar_one_or_none()
            
            if not playlist_numeric_id:
                return None  # Playlist not found

            # Upsert: one rating row per user (or per guest visitor) per playlist. Guests are
            # tagged by visitor_id. Legacy duplicates are collapsed to the single latest row.
            existing = await self._async_find_existing(
                db, user_id=user_id, visitor_id=visitor_id, playlist_id=playlist_numeric_id
            )
            if existing is not None:
                if user_id is not None:
                    dup_cond = and_(PlaylistRating.user_id == user_id,
                                    PlaylistRating.playlist_id == playlist_numeric_id,
                                    PlaylistRating.id != existing.id)
                else:
                    dup_cond = and_(PlaylistRating.visitor_id == visitor_id,
                                    PlaylistRating.user_id.is_(None),
                                    PlaylistRating.playlist_id == playlist_numeric_id,
                                    PlaylistRating.id != existing.id)
                await db.execute(delete(PlaylistRating).where(dup_cond))
                existing.rating = rating
                # Only overwrite the message when a new one is supplied (a thumb/stars update
                # shouldn't wipe an earlier written note).
                if message is not None:
                    existing.message = message
                existing.rated_at = func.current_timestamp()
                await db.commit()
                await db.refresh(existing)
                return existing

            new_rating = PlaylistRating(
                user_id=user_id,
                visitor_id=visitor_id if not user_id else None,
                playlist_id=playlist_numeric_id,
                rating=rating,
                message=message
            )
            db.add(new_rating)
            await db.commit()
            await db.refresh(new_rating)
            return new_rating

        except Exception as e:
            await db.rollback()
            print(f"Error rating playlist: {e}")
            raise e
    
    async def async_get_playlist_rating(
        self, 
        db: AsyncSession, 
        playlist_id: int, 
        user_id: Optional[str] = None
    ) -> Optional[PlaylistRating]:
        """
        Get user's rating for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            PlaylistRating instance or None if not found
        """
        try:
            return await self._async_find_existing(db, user_id=user_id, playlist_id=playlist_id)
        except Exception as e:
            print(f"Error getting playlist rating: {e}")
            raise e
    
    async def async_delete_playlist_rating(
        self, 
        db: AsyncSession, 
        playlist_id: int, 
        user_id: Optional[str] = None
    ) -> bool:
        """
        Delete user's rating for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID
            user_id: User ID (optional for anonymous ratings)
            
        Returns:
            True if deleted, False if not found
        """
        try:
            stmt = delete(self.model).where(
                and_(
                    self.model.playlist_id == playlist_id,
                    self.model.user_id == user_id
                )
            )
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount > 0
        except Exception as e:
            await db.rollback()
            print(f"Error deleting playlist rating: {e}")
            raise e
    
    async def async_get_playlist_rating_stats(self, db: AsyncSession, playlist_id: Union[int, str]) -> Dict[str, Any]:
        """
        Get rating statistics for a specific playlist.
        
        Args:
            db: Database session
            playlist_id: Playlist ID (numeric ID or UUID string)
            
        Returns:
            Dictionary with rating statistics
        """
        try:
            from app.models.playlist import Playlist
            
            # Resolve numeric ID if UUID provided
            playlist_numeric_id = None
            if isinstance(playlist_id, int):
                playlist_numeric_id = playlist_id
            elif isinstance(playlist_id, str):
                # Try to look up by UUID
                stmt = select(Playlist.id).where(Playlist.uuid == playlist_id)
                result = await db.execute(stmt)
                playlist_numeric_id = result.scalar_one_or_none()
                
                # If not found and it looks like a number, try direct ID
                if not playlist_numeric_id and playlist_id.isdigit():
                    playlist_numeric_id = int(playlist_id)

            if not playlist_numeric_id:
                return {
                    "total_ratings": 0,
                    "average_rating": None,
                    "rating_distribution": {"0": 0, "1": 0, "2": 0, "3": 0}
                }

            # Get total count, average, and distribution
            stmt = select(
                func.count(PlaylistRating.id).label('total_ratings'),
                func.avg(PlaylistRating.rating).label('average_rating'),
                func.sum(case((PlaylistRating.rating == 0, 1), else_=0)).label('rating_0'),
                func.sum(case((PlaylistRating.rating == 1, 1), else_=0)).label('rating_1'),
                func.sum(case((PlaylistRating.rating == 2, 1), else_=0)).label('rating_2'),
                func.sum(case((PlaylistRating.rating == 3, 1), else_=0)).label('rating_3')
            ).where(PlaylistRating.playlist_id == playlist_numeric_id)

            result = await db.execute(stmt)
            row = result.mappings().one()
            
            total = int(row['total_ratings'] or 0)
            if total == 0:
                return {
                    "total_ratings": 0,
                    "average_rating": None,
                    "rating_distribution": {"0": 0, "1": 0, "2": 0, "3": 0}
                }

            return {
                "total_ratings": total,
                "average_rating": float(row['average_rating']) if row['average_rating'] is not None else None,
                "rating_distribution": {
                    "0": int(row['rating_0'] or 0),
                    "1": int(row['rating_1'] or 0),
                    "2": int(row['rating_2'] or 0),
                    "3": int(row['rating_3'] or 0)
                }
            }
        except Exception as e:
            return {
                "total_ratings": 0,
                "average_rating": None,
                "rating_distribution": {"0": 0, "1": 0, "2": 0, "3": 0},
                "error": str(e)
            }

    async def async_get_user_playlist_rating(
        self, db: AsyncSession, playlist_uuid: str, user_id: int
    ) -> Optional[PlaylistRating]:
        """The user's current star rating (+ message) for a playlist, resolved by playlist UUID."""
        if user_id is None:
            return None
        playlist_numeric_id = await db.scalar(
            select(Playlist.id).where(Playlist.uuid == playlist_uuid)
        )
        if not playlist_numeric_id:
            return None
        return await self._async_find_existing(db, user_id=user_id, playlist_id=playlist_numeric_id)

    async def async_get_playlist_ratings_detail(
        self, db: AsyncSession, playlist_uuid: str
    ) -> Optional[Dict[str, Any]]:
        """Admin view: everything about a playlist's ratings.

        Returns the playlist + creator, the list of playlist-level ratings (stars/message, one per
        rater, creator flagged), a stars summary, and the per-track thumb aggregates (plus/minus
        counts + the creator's own thumb). All de-duplicated to each rater's CURRENT rating so the
        old append-only rows never double-count.
        """
        prow = (await db.execute(
            select(
                Playlist.id, Playlist.uuid, Playlist.name, Playlist.type,
                Playlist.num_tracks, Playlist.user_id, Playlist.created_at,
                User.email.label("creator_email"), User.name.label("creator_name"),
            ).outerjoin(User, User.id == Playlist.user_id)
            .where(Playlist.uuid == playlist_uuid)
        )).first()
        if not prow:
            return None

        pid = prow.id
        creator_user_id = prow.user_id

        # ---- Playlist-level ratings (stars + optional message), latest per rater ----
        pr_rows = (await db.execute(
            select(
                PlaylistRating.user_id, PlaylistRating.visitor_id, PlaylistRating.rating,
                PlaylistRating.message, PlaylistRating.rated_at, PlaylistRating.id,
                User.email, User.name,
            ).outerjoin(User, User.id == PlaylistRating.user_id)
            .where(PlaylistRating.playlist_id == pid)
            .order_by(PlaylistRating.id.desc())  # latest first → first seen per rater is current
        )).all()

        playlist_ratings: List[Dict[str, Any]] = []
        seen_raters: set = set()
        dist = {0: 0, 1: 0, 2: 0, 3: 0}
        for r in pr_rows:
            rater_key = f"u{r.user_id}" if r.user_id is not None else f"v{r.visitor_id}"
            if rater_key in seen_raters:
                continue
            seen_raters.add(rater_key)
            is_creator = creator_user_id is not None and r.user_id == creator_user_id
            if r.rating in dist:
                dist[r.rating] += 1
            playlist_ratings.append({
                "user_id": r.user_id,
                "visitor_id": r.visitor_id if r.user_id is None else None,
                "email": r.email,
                "name": r.name,
                "is_creator": is_creator,
                "rating": int(r.rating) if r.rating is not None else None,
                "message": r.message,
                "rated_at": r.rated_at.isoformat() if r.rated_at else None,
            })
        # Creator first, then most-recent.
        playlist_ratings.sort(key=lambda x: (not x["is_creator"],))
        total_pr = len(playlist_ratings)
        avg_pr = (sum(x["rating"] for x in playlist_ratings if x["rating"] is not None) / total_pr) if total_pr else None

        # ---- Per-track thumb aggregates ----
        track_rows = (await db.execute(
            select(
                PlaylistTrack.track_id, PlaylistTrack.position,
                Track.uuid, Track.title, Track.display_artist,
            ).join(Track, Track.id == PlaylistTrack.track_id)
            .where(PlaylistTrack.playlist_id == pid)
            .order_by(PlaylistTrack.position)
        )).all()

        tr_rows = (await db.execute(
            select(TrackRating.track_id, TrackRating.user_id, TrackRating.rating, TrackRating.id)
            .where(TrackRating.playlist_id == pid)
            .order_by(TrackRating.track_id, TrackRating.user_id, TrackRating.id.desc())
        )).all()

        # latest rating per (track_id, user_id)
        latest: Dict[tuple, int] = {}
        for tr in tr_rows:
            key = (tr.track_id, tr.user_id)
            if key in latest:
                continue
            if tr.rating is not None:
                latest[key] = int(tr.rating)

        # fold into per-track plus/minus + creator's own thumb
        agg: Dict[int, Dict[str, Any]] = {}
        for (track_id, user_id), rating in latest.items():
            a = agg.setdefault(track_id, {"plus": 0, "minus": 0, "creator_rating": None})
            if rating == 1:
                a["plus"] += 1
            elif rating == 0:
                a["minus"] += 1
            if creator_user_id is not None and user_id == creator_user_id:
                a["creator_rating"] = rating

        tracks: List[Dict[str, Any]] = []
        for t in track_rows:
            a = agg.get(t.track_id, {"plus": 0, "minus": 0, "creator_rating": None})
            tracks.append({
                "track_id": t.uuid,
                "title": t.title,
                "artist": t.display_artist,
                "position": float(t.position) if t.position is not None else None,
                "plus": a["plus"],
                "minus": a["minus"],
                "total": a["plus"] + a["minus"],
                "creator_rating": a["creator_rating"],
            })

        return {
            "playlist": {
                "uuid": prow.uuid,
                "name": prow.name,
                "type": prow.type,
                "num_tracks": prow.num_tracks,
                "created_at": prow.created_at.isoformat() if prow.created_at else None,
                "creator": (
                    {"user_id": creator_user_id, "email": prow.creator_email, "name": prow.creator_name}
                    if creator_user_id is not None else None
                ),
            },
            "playlist_ratings": playlist_ratings,
            "playlist_rating_summary": {
                "count": total_pr,
                "average": round(avg_pr, 2) if avg_pr is not None else None,
                "distribution": {str(k): v for k, v in dist.items()},
            },
            "tracks": tracks,
        }
