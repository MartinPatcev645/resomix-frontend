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

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from decimal import Decimal
import uuid
from datetime import datetime
from enum import Enum
from app.models.playlist import Playlist, PlaylistTrack


class PlaylistWriteDenial(str, Enum):
    """Why a mutation may not proceed. Kept distinct so the API can answer honestly."""

    #: No such playlist for this partner (or it is soft-deleted).
    NOT_FOUND = "not_found"
    #: It exists and the caller can very likely see it — they just don't own it.
    NOT_OWNER = "not_owner"


#: One wording for every mutation, so rename / visibility / cover / delete agree.
PLAYLIST_NOT_FOUND_MESSAGE = "This playlist no longer exists."
PLAYLIST_NOT_OWNER_MESSAGE = (
    "You don't have edit access to this playlist — it isn't owned by your account."
)

DENIAL_MESSAGES = {
    PlaylistWriteDenial.NOT_FOUND: PLAYLIST_NOT_FOUND_MESSAGE,
    PlaylistWriteDenial.NOT_OWNER: PLAYLIST_NOT_OWNER_MESSAGE,
}

#: HTTP status per denial. 403 for an ownership refusal — 404 would be a lie the user can disprove
#: by looking at the screen.
DENIAL_STATUS = {
    PlaylistWriteDenial.NOT_FOUND: 404,
    PlaylistWriteDenial.NOT_OWNER: 403,
}
from app.models.constants import PlaylistType
from app.repositories.base_repository import BaseRepository


class PlaylistRepository(BaseRepository[Playlist]):
    """Repository for Playlist model operations."""

    def __init__(self):
        """Initialize PlaylistRepository with Playlist model."""
        super().__init__(Playlist)

    async def _resolve_library_visibility(
        self, db: AsyncSession, *, user_id: Optional[int], cap: Optional[int]
    ) -> bool:
        """Whether a playlist created right now should be listed in the owner's Library.

        Visible when the owner is below their cap. ``cap is None`` means the caller did not resolve
        one (a guest, a partner, or a path that predates this) — default to visible, because
        hiding someone's playlist by accident is far worse than showing one too many.
        ``cap < 0`` is unlimited.
        """
        if user_id is None or cap is None or cap < 0:
            return True
        if cap == 0:
            return False
        return await self.count_library_visible(db, user_id) < cap

    async def count_library_visible(self, db: AsyncSession, user_id: int) -> int:
        """How many playlists the owner currently has LISTED in their Library.

        One definition, two callers: the visibility decision at creation and the ``usage`` block on
        ``/entitlements/me``. If they counted differently the chip would say "4/5" while the sixth
        playlist came back hidden, and nobody would be able to tell which was lying.
        """
        current = await db.execute(
            select(func.count())
            .select_from(Playlist)
            .where(
                Playlist.user_id == user_id,
                Playlist.is_library_visible.is_(True),
                Playlist.deleted_at.is_(None),
            )
        )
        return current.scalar() or 0

    async def find_same_day_similarity(
        self,
        db: AsyncSession,
        *,
        seed_track_id: int,
        since: datetime,
        user_id: Optional[int] = None,
        guest_visitor_id: Optional[str] = None,
    ) -> Optional[Playlist]:
        """The caller's existing similarity playlist for this seed, created since ``since``.

        Backs the repeat-search rule: asking for the same reference twice in one day returns the
        playlist already built instead of charging a second search credit. The engine is
        deterministic for a given seed, so the second result would be identical anyway — charging
        for it is charging for value already delivered.

        Deliberately a DB lookup rather than a Redis set: the playlist row already carries
        ``seed_track_id`` and is indexed by owner, so a Redis mirror would duplicate identity for a
        case that arises rarely, and could disagree with the database after an eviction.

        Scoped to ONE subject — a user id or a guest visitor id, never both — so one caller's
        playlist can never be handed to another.
        """
        if user_id is None and not guest_visitor_id:
            return None

        owner = (
            Playlist.user_id == user_id
            if user_id is not None
            else and_(Playlist.user_id.is_(None), Playlist.guest_visitor_id == guest_visitor_id)
        )

        result = await db.execute(
            select(Playlist)
            .where(
                and_(
                    owner,
                    Playlist.seed_track_id == seed_track_id,
                    Playlist.type == PlaylistType.SIMILARITY,
                    Playlist.deleted_at.is_(None),
                    Playlist.created_at >= since,
                )
            )
            # Newest first: if a race created two, hand back the one the caller most likely has open.
            .order_by(Playlist.created_at.desc(), Playlist.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def async_get_id_by_uuid(self, db: AsyncSession, uuid: str) -> Optional[int]:
        """Resolve a playlist UUID to its internal integer database ID."""
        stmt = select(self.model.id).where(self.model.uuid == uuid)
        result = await db.execute(stmt)
        return result.scalar()

    async def async_create_similarity_playlist(
        self,
        db: AsyncSession,
        seed_track_id: int,
        track_ids: List[int],
        track_scores: List[float] = None,
        name: str = "Playlist",
        playlist_type: str = PlaylistType.SIMILARITY,
        user_id: Optional[int] = None,
        partner_id: Optional[int] = None,
        is_public: bool = False,
        library_visible_max: Optional[int] = None,
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
            from app.models.track import Track

            # Fetch track durations for all tracks (playlist tracks + seed track)
            all_track_ids = list(track_ids)
            if seed_track_id:
                all_track_ids.append(seed_track_id)

            # Calculate num_tracks (number of tracks in playlist_tracks, excluding seed track)
            num_tracks = len(track_ids)

            # Calculate play_time (sum of all track durations including seed track)
            play_time_float = 0.0
            if all_track_ids:
                # Fetch durations for all tracks in one query
                stmt = select(Track.id, Track.duration_ms).where(
                    Track.id.in_(all_track_ids)
                )
                result = await db.execute(stmt)
                track_durations = {
                    row.id: row.duration_ms for row in result.fetchall()
                }

                # Sum up all durations (including seed track) in milliseconds
                play_time_ms = 0
                for track_id in all_track_ids:
                    duration = track_durations.get(track_id)
                    if duration is not None:
                        play_time_ms += int(duration)
                
                # Convert to seconds for play_time
                play_time = play_time_ms // 1000

            # Library visibility is decided ONCE, here, and then left alone.
            #
            # Beyond the plan's cap a playlist is created HIDDEN — it still exists and is fully
            # usable by link; it is simply not listed in the Library. Deleting a visible one frees
            # a slot, but hidden playlists are never promoted, so the next NEW playlist takes it.
            # That is why this is a stored flag and not a "first N by created_at" query: after the
            # fact the ordering cannot tell you which ones the user actually saw.
            is_library_visible = await self._resolve_library_visibility(
                db, user_id=user_id, cap=library_visible_max
            )

            # Create the playlist record (UUID is auto-generated in __init__)
            playlist = Playlist(
                user_id=user_id, partner_id=partner_id,  # Associate with user if logged in
                name=name,
                is_public=is_public,  # anonymous frontend previews are public; others private
                type=playlist_type,
                seed_track_id=seed_track_id,
                num_tracks=num_tracks,
                play_time=play_time,
                is_library_visible=is_library_visible,
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
                    position=Decimal(
                        str(position)
                    ),  # Convert to Decimal for DECIMAL(12,6)
                    score=score,
                )
                playlist_tracks.append(playlist_track)

            db.add_all(playlist_tracks)
            await db.flush()

            # NOTE: never expose the internal integer primary key (playlist.id) on a
            # user-facing response — only the UUID. If an admin path ever needs the pk,
            # add it in that admin-scoped serializer, not here.
            # `fork_id` / `is_following` are intentionally omitted from the playlist response
            # (unused by the frontend — see docs/PLAYBACK_APPLE_MUSIC_PLAN.md); favorites are kept.
            return {
                "id": playlist.uuid,  # UUID for external use
                "name": playlist.name,
                "is_public": playlist.is_public,
                "is_favorite": False,  # Will be enriched by service layer if user logged in
            }

        except Exception as e:
            print(f"Error creating similarity playlist: {e}")
            raise e

    async def async_fork_playlist(
        self, db: AsyncSession, original_playlist_uuid: str, user_id: int, partner_id: Optional[int] = None
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
            original_playlist = await self.async_get_playlist_by_uuid(
                db, original_playlist_uuid, partner_id=partner_id
            )
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
                partner_id=partner_id,
                name=original_playlist.name,
                is_public=False,  # Forked playlists default to private
                type=original_playlist.type,
                seed_track_id=original_playlist.seed_track_id,
                fork_id=original_playlist_uuid,  # Link back to original
                forked_at=datetime.utcnow(),
                fork_count=0,  # New playlist starts with 0 forks
                # created_at is automatically set by database with current timestamp
            )

            db.add(forked_playlist)
            await db.flush()  # Flush to get the new playlist ID

            # 4. Fetch Original Playlist Tracks
            stmt = (
                select(PlaylistTrack)
                .where(PlaylistTrack.playlist_id == original_playlist.id)
                .order_by(PlaylistTrack.position.asc())
            )

            result = await db.execute(stmt)
            original_tracks = result.scalars().all()

            # 5. Calculate num_tracks and play_time for the forked playlist
            num_tracks = len(original_tracks)

            # Fetch track durations for all tracks (playlist tracks + seed track)
            from app.models.track import Track

            all_track_ids = [pt.track_id for pt in original_tracks]
            if original_playlist.seed_track_id:
                all_track_ids.append(original_playlist.seed_track_id)

            play_time_float = 0.0
            if all_track_ids:
                # Fetch durations for all tracks in one query
                duration_stmt = select(Track.id, Track.duration_ms).where(
                    Track.id.in_(all_track_ids)
                )
                duration_result = await db.execute(duration_stmt)
                track_durations = {
                    row.id: row.duration_ms for row in duration_result.fetchall()
                }

                # Sum up all durations (including seed track) in milliseconds
                play_time_ms = 0
                for track_id in all_track_ids:
                    duration = track_durations.get(track_id)
                    if duration is not None:
                        play_time_ms += int(duration)
                
                # Convert to seconds for play_time
                play_time = play_time_ms // 1000

            # Update forked playlist with calculated values
            forked_playlist.num_tracks = num_tracks
            forked_playlist.play_time = play_time

            # 6. Create Forked Playlist Tracks with Reset Positions
            forked_tracks = []
            for i, original_track in enumerate(original_tracks):
                forked_track = PlaylistTrack(
                    playlist_id=forked_playlist.id,
                    track_id=original_track.track_id,
                    position=Decimal(str(i + 1)),  # Reset to 1.0, 2.0, 3.0, etc.
                    score=original_track.score,  # Keep same score
                )
                forked_tracks.append(forked_track)

            db.add_all(forked_tracks)

            # 7. Increment Original Playlist Fork Count
            original_playlist.fork_count += 1

            # 8. Flush Transaction
            await db.flush()

            # 9. Return Success Data
            return await self.async_get_playlist_similarity_data(
                db, new_uuid, allow_private=True, user_id=user_id
            )

        except Exception as e:
            print(f"Error forking playlist: {e}")
            return None

    async def async_get_playlist_with_tracks(
        self, db: AsyncSession, playlist_id: int
    ) -> Optional[Playlist]:
        """
        Get playlist with all tracks loaded.

        Args:
            db: Database session
            playlist_id: Playlist ID

        Returns:
            Playlist with tracks loaded or None if not found
        """
        stmt = select(self.model).where(self.model.id == playlist_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_get_tracks_by_playlist_id(
        self, db: AsyncSession, playlist_id: int
    ) -> List[PlaylistTrack]:
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
        playlist_type: str = PlaylistType.SIMILARITY,
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
            from app.models.track import Track

            # Fetch track durations for all tracks (playlist tracks + seed track)
            all_track_ids = list(track_ids)
            if seed_track_id:
                all_track_ids.append(seed_track_id)

            # Calculate num_tracks (number of tracks in playlist_tracks, excluding seed track)
            num_tracks = len(track_ids)

            # Calculate play_time (sum of all track durations including seed track)
            play_time_float = 0.0
            if all_track_ids:
                # Fetch durations for all tracks in one query
                tracks = (
                    db.query(Track.id, Track.duration_ms)
                    .filter(Track.id.in_(all_track_ids))
                    .all()
                )
                track_durations = {track.id: track.duration_ms for track in tracks}

                # Sum up all durations (including seed track) in milliseconds
                play_time_ms = 0
                for track_id in all_track_ids:
                    duration = track_durations.get(track_id)
                    if duration is not None:
                        play_time_ms += int(duration)
                
                # Convert to seconds for play_time
                play_time = play_time_ms // 1000

            # Create the playlist record (UUID is auto-generated in __init__)
            playlist = Playlist(
                user_id=None,  # Anonymous playlist
                name=name,
                is_public=False,  # Keep is_public as 0
                type=playlist_type,
                seed_track_id=seed_track_id,
                num_tracks=num_tracks,
                play_time=play_time,
            )

            db.add(playlist)
            db.flush()  # Flush to get the playlist ID

            # Add tracks to playlist with positions
            playlist_tracks = []
            for position, track_id in enumerate(track_ids, start=1):
                playlist_track = PlaylistTrack(
                    playlist_id=playlist.id,
                    track_id=track_id,
                    position=Decimal(
                        str(position)
                    ),  # Convert to Decimal for DECIMAL(12,6)
                )
                playlist_tracks.append(playlist_track)

            db.add_all(playlist_tracks)
            db.flush()

            # Sync method - no user context, so fork_id is always empty (privacy)
            # Also, this method creates new playlists, not forks, so fork_id will be None anyway
            return {
                "id": playlist.uuid,  # Return UUID as 'id' field
                "name": playlist.name,
                "is_public": playlist.is_public,
                "fork_id": "",  # Always empty in sync context (no user to check ownership)
                "is_favorite": False,  # Sync method - engagement not available in sync context
                "is_following": False,  # Sync method - engagement not available in sync context
            }

        except Exception as e:
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
        if "id" in kwargs:
            return db.query(self.model).filter(self.model.id == kwargs["id"]).first()

        # For similarity playlists, they're typically unique by type and seed_track_id
        if "type" in kwargs and "seed_track_id" in kwargs:
            return (
                db.query(self.model)
                .filter(
                    and_(
                        self.model.type == kwargs["type"],
                        self.model.seed_track_id == kwargs["seed_track_id"],
                    )
                )
                .first()
            )

        # Fallback: look up by user_id and name
        if "user_id" in kwargs and "name" in kwargs:
            return (
                db.query(self.model)
                .filter(
                    and_(
                        self.model.user_id == kwargs["user_id"],
                        self.model.name == kwargs["name"],
                    )
                )
                .first()
            )

        return None

    async def _async_find_existing(
        self, db: AsyncSession, **kwargs
    ) -> Optional[Playlist]:
        """Async version of _find_existing."""
        if "id" in kwargs:
            stmt = select(self.model).where(self.model.id == kwargs["id"])
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

        # For similarity playlists, they're typically unique by type and seed_track_id
        if "type" in kwargs and "seed_track_id" in kwargs:
            stmt = select(self.model).where(
                and_(
                    self.model.type == kwargs["type"],
                    self.model.seed_track_id == kwargs["seed_track_id"],
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

        # Fallback: look up by user_id and name
        if "user_id" in kwargs and "name" in kwargs:
            stmt = select(self.model).where(
                and_(
                    self.model.user_id == kwargs["user_id"],
                    self.model.name == kwargs["name"],
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

        return None

    async def async_get_latest_similarity_playlist_uuid_by_seed(
        self, db: AsyncSession, seed_track_id: int, partner_id: Optional[int] = None,
    ) -> Optional[str]:
        """Return the UUID of the most recent, non-deleted similarity playlist seeded by a track.

        An analysis-upload spawns exactly one similarity playlist seeded by the just-uploaded track
        (``seed_track_id``), and that playlist's HLS manifest is that single upload. The analysis
        screen uses this to reuse the sibling playlist for HLS playback instead of a separate
        single-track session. Returns None if none exists yet (sibling not finished / not created).
        """
        conditions = [
            self.model.type == PlaylistType.SIMILARITY,
            self.model.seed_track_id == seed_track_id,
            self.model.deleted_at.is_(None),
        ]
        if partner_id is not None:
            conditions.append(self.model.partner_id == partner_id)
        stmt = (
            select(self.model.uuid)
            .where(and_(*conditions))
            .order_by(self.model.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_get_playlist_for_write(
        self, db: AsyncSession, playlist_uuid: str, user_id: Optional[int],
        partner_id: Optional[int] = None,
    ) -> Tuple[Optional[Playlist], Optional[PlaylistWriteDenial]]:
        """Resolve a playlist for a MUTATION, saying *why* when it may not be written.

        Returns ``(playlist, None)`` when the caller may write, otherwise ``(None, denial)``.

        This exists because every mutation used to fold "doesn't exist" and "isn't yours" into a
        single boolean, so the API answered "Playlist not found" for a playlist the user could see
        on screen and play — which reads as a bug in the product, not as a permissions decision.

        Telling the two apart is safe here: the READ path already answers 403 for a private
        playlist you don't own, so a caller can distinguish existence either way. This leaks
        nothing new and lets each endpoint say something true.

        This is the FIRST check every mutation makes — before validating a name, a file, or
        anything else. Rejecting a payload for a playlist the caller cannot touch tells them about
        the wrong problem.
        """
        playlist = await self.async_get_playlist_by_uuid(db, playlist_uuid, partner_id=partner_id)
        if playlist is None:
            return None, PlaylistWriteDenial.NOT_FOUND
        # user_id None means an internal/admin caller that has already authorised itself.
        if user_id is not None and playlist.user_id != user_id:
            return None, PlaylistWriteDenial.NOT_OWNER
        return playlist, None

    async def async_get_playlist_by_uuid(
        self, db: AsyncSession, playlist_uuid: str, partner_id: Optional[int] = None,
        include_deleted: bool = False,
    ) -> Optional[Playlist]:
        """
        Get playlist by UUID with optional partner scoping.

        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            partner_id: Optional partner ID for tenant scoping
            include_deleted: When False (default) soft-deleted playlists are excluded —
                user-facing reads never see a deleted playlist. Pass True only for admin
                or internal reconciliation that must operate on deleted rows.

        Returns:
            Playlist instance or None if not found
        """
        stmt = select(self.model).where(self.model.uuid == playlist_uuid)
        if partner_id is not None:
            stmt = stmt.where(self.model.partner_id == partner_id)
        if not include_deleted:
            stmt = stmt.where(self.model.deleted_at.is_(None))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_rename_playlist(
        self, db: AsyncSession, playlist_uuid: str, new_name: str, partner_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Rename a playlist by UUID.

        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            new_name: New playlist name
            partner_id: Optional partner ID for tenant scoping
            user_id: When provided, only the owning user may rename — a playlist owned by
                someone else is treated as not found (no ownership leak).

        Returns:
            Dict with success status and old_name if successful
        """
        try:
            playlist, denial = await self.async_get_playlist_for_write(
                db, playlist_uuid, user_id, partner_id=partner_id
            )
            if denial is not None:
                return {"success": False, "old_name": None, "denial": denial}

            old_name = playlist.name
            playlist.name = new_name
            await db.flush()
            return {"success": True, "old_name": old_name, "denial": None}

        except Exception as e:
            print(f"Error renaming playlist: {e}")
            raise e

    async def async_make_playlist_public(
        self, db: AsyncSession, playlist_uuid: str, is_public: bool = True, partner_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> bool:
        """
        Make a playlist public or private by UUID.

        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            is_public: Whether to make the playlist public
            partner_id: Optional partner ID for tenant scoping
            user_id: When provided, only the owning user may change visibility — a playlist
                owned by someone else is treated as not found (no ownership leak).

        Returns:
            True if successful, False if playlist not found / not owned
        """
        try:
            playlist, denial = await self.async_get_playlist_for_write(
                db, playlist_uuid, user_id, partner_id=partner_id
            )
            if denial is not None:
                return False, denial

            playlist.is_public = is_public
            await db.flush()
            return True, None

        except Exception as e:
            print(f"Error updating playlist visibility: {e}")
            raise e

    async def async_soft_delete_user_playlist(
        self, db: AsyncSession, playlist_uuid: str, user_id: int,
        partner_id: Optional[int] = None,
    ) -> bool:
        """Soft-delete one of the user's own playlists (set ``deleted_at``).

        Owner-only: a playlist owned by someone else (or nonexistent / already deleted) is
        treated as not found — returns False (idempotent, no ownership leak). The row is
        retained; user-facing reads exclude it.
        """
        playlist, denial = await self.async_get_playlist_for_write(
            db, playlist_uuid, user_id, partner_id=partner_id
        )
        if denial is not None:
            return False, denial
        playlist.deleted_at = datetime.utcnow()
        await db.flush()
        return True, None

    async def async_soft_delete_playlists_by_seed_track(
        self, db: AsyncSession, seed_track_id: int, partner_id: Optional[int] = None
    ) -> int:
        """Soft-delete every still-active playlist seeded from ``seed_track_id``.

        Called when the (uploaded) seed track itself is deleted — the similarity playlist
        it generated is soft-deleted alongside it. Returns the number of playlists affected.
        """
        conditions = [
            Playlist.seed_track_id == seed_track_id,
            Playlist.deleted_at.is_(None),
        ]
        if partner_id is not None:
            conditions.append(Playlist.partner_id == partner_id)

        result = await db.execute(select(Playlist).where(and_(*conditions)))
        playlists = result.scalars().all()
        now = datetime.utcnow()
        for playlist in playlists:
            playlist.deleted_at = now
        await db.flush()
        return len(playlists)

    async def async_get_similarity_playlist_map(
        self, db: AsyncSession, track_ids: List[int], partner_id: Optional[int] = None
    ) -> Dict[int, str]:
        """Map each seed track id -> the UUID of the (latest) similarity playlist generated
        from it. Used to tell the library which uploaded tracks already have a generated
        playlist. Tracks with no similarity playlist are simply absent from the map.

        Args:
            db: Async database session
            track_ids: Track primary keys to look up
            partner_id: Optional partner ID for tenant scoping

        Returns:
            ``{seed_track_id: playlist_uuid}`` for the most recent similarity playlist per track.
        """
        if not track_ids:
            return {}

        conditions = [
            Playlist.seed_track_id.in_(track_ids),
            Playlist.type.in_([PlaylistType.SIMILARITY, "waiting_segments"]),
            Playlist.deleted_at.is_(None),  # a soft-deleted playlist no longer counts
        ]
        if partner_id is not None:
            conditions.append(Playlist.partner_id == partner_id)

        stmt = (
            select(Playlist.seed_track_id, Playlist.uuid)
            .where(and_(*conditions))
            .order_by(Playlist.created_at.desc(), Playlist.id.desc())
        )
        result = await db.execute(stmt)

        mapping: Dict[int, str] = {}
        for seed_track_id, playlist_uuid in result.all():
            # Rows are newest-first; keep the first (latest) per seed track.
            if seed_track_id not in mapping:
                mapping[seed_track_id] = playlist_uuid
        return mapping

    async def async_get_playlist_similarity_data(
        self,
        db: AsyncSession,
        playlist_uuid: str,
        allow_private: bool = False,
        user_id: Optional[int] = None,
        partner_id: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Get playlist with all tracks and similarity data formatted like similarity response.
        Only returns data for public playlists (is_public = 1) unless allow_private is True or user is the owner.
        Includes optional partner scoping.

        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            allow_private: If True, allows access to private playlists (used for fork operations)
            user_id: Optional user ID - if provided, allows access to user's own private playlists
            partner_id: Optional partner ID for tenant scoping

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
                # A soft-deleted playlist must read as "does not exist" — not "private".
                .where(self.model.deleted_at.is_(None))
            )
            if partner_id is not None:
                stmt = stmt.where(self.model.partner_id == partner_id)
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
                seed_query = text(
                    """
                    SELECT
                        t.id as track_id,
                        t.uuid as id,
                        t.title,
                        t.p_line_year as year,
                        -- Seed duration: prefer the track row, but for uploads whose duration_ms
                        -- was never persisted, fall back to the analysis-measured length (the
                        -- upload's analysis sibling records identity.duration_ms). Recovers the
                        -- reference track's timeline/seek on playlists created before the
                        -- duration-persist fix. Sourced via a derived-table join (one row per
                        -- track) so it never multiplies rows or trips the parser.
                        (COALESCE(t.duration_ms, MAX(tad.dur)) / 1000.0) as duration,
                        t.type as type,
                        COALESCE(l.label_name, '') as label,
                        -- In-house fallbacks for the Apple-first fields (see apple_music_enrichment):
                        -- genre is 1:1 on the track; album is the release title (MIN so a track on
                        -- several releases doesn't multiply rows).
                        g.name as genre,
                        MIN(r.title) as album,
                        COALESCE(
                            GROUP_CONCAT(DISTINCT c.full_name ORDER BY c.full_name SEPARATOR ', '),
                            COALESCE(t.display_artist, '')
                        ) as artist
                    FROM tracks t
                    LEFT JOIN release_tracks rt ON t.id = rt.track_id
                    LEFT JOIN releases r ON rt.release_id = r.id
                    LEFT JOIN labels l ON r.label_id = l.id
                    LEFT JOIN genres g ON t.genre_id = g.id
                    LEFT JOIN track_contributors tc ON t.id = tc.track_id
                    LEFT JOIN contributors c ON tc.person_id = c.id
                    LEFT JOIN (
                        SELECT track_id, MAX(duration_ms) AS dur
                        FROM track_analysis_results
                        GROUP BY track_id
                    ) tad ON tad.track_id = t.id
                    WHERE t.id = :track_id
                    AND t.partner_id = :partner_id
                    AND COALESCE(t.is_active, 1) = 1
                    GROUP BY t.id, t.uuid, t.title, t.p_line_year, t.duration_ms, t.type, l.label_name, g.name
                    LIMIT 1
                """
                )

                seed_result = await db.execute(
                    seed_query, {"track_id": playlist.seed_track_id, "partner_id": partner_id}
                )
                seed_row = seed_result.first()

                if seed_row:
                    queried_track = {
                        "rank": 0,
                        "score": 1.0,
                        "track_id": seed_row.track_id,
                        "id": seed_row.id,
                        "title": seed_row.title or "Unknown",
                        "year": seed_row.year,
                        "duration": (
                            float(seed_row.duration)
                            if seed_row.duration is not None
                            else 0.0
                        ),
                        "label": seed_row.label,
                        "genre": seed_row.genre,
                        "album": seed_row.album,
                        "artist": seed_row.artist or "Unknown",
                        "type": "upload" if seed_row.type == "upload" else "internal",
                    }

            # Get all tracks in playlist with details
            if playlist.playlist_tracks:
                track_ids = [pt.track_id for pt in playlist.playlist_tracks]
                tracks_query = text(
                    """
                    SELECT 
                        t.id as track_id,
                        t.uuid as id,
                        t.title,
                        t.p_line_year as year,
                        (t.duration_ms / 1000.0) as duration,
                        t.type as type,
                        COALESCE(l.label_name, '') as label,
                        -- In-house fallbacks for the Apple-first fields (see apple_music_enrichment).
                        g.name as genre,
                        MIN(r.title) as album,
                        COALESCE(
                            GROUP_CONCAT(DISTINCT c.full_name ORDER BY c.full_name SEPARATOR ', '),
                            COALESCE(t.display_artist, '')
                        ) as artist
                    FROM tracks t
                    LEFT JOIN release_tracks rt ON t.id = rt.track_id
                    LEFT JOIN releases r ON rt.release_id = r.id
                    LEFT JOIN labels l ON r.label_id = l.id
                    LEFT JOIN genres g ON t.genre_id = g.id
                    LEFT JOIN track_contributors tc ON t.id = tc.track_id
                    LEFT JOIN contributors c ON tc.person_id = c.id
                    WHERE t.id IN :track_ids
                    AND t.partner_id = :partner_id
                    AND COALESCE(t.is_active, 1) = 1
                    GROUP BY t.id, t.uuid, t.title, t.p_line_year, t.duration_ms, t.type, l.label_name, g.name
                """
                )

                tracks_result = await db.execute(
                    tracks_query, {"track_ids": tuple(track_ids), "partner_id": partner_id}
                )
                tracks_data = {row.track_id: row for row in tracks_result.fetchall()}

                # Build similar tracks list with proper ordering and scores
                similar_tracks = []
                for pt in sorted(playlist.playlist_tracks, key=lambda x: x.position):
                    track_data = tracks_data.get(pt.track_id)
                    if track_data:
                        track_info = {
                            "rank": float(pt.position),
                            "score": float(pt.score) if pt.score else 0.0,
                            "track_id": track_data.track_id,
                            "id": track_data.id,
                            "title": track_data.title or "Unknown",
                            "year": track_data.year,
                            "duration": (
                                float(track_data.duration)
                                if track_data.duration is not None
                                else 0.0
                            ),
                            "label": track_data.label,
                            "genre": track_data.genre,
                            "album": track_data.album,
                            "artist": track_data.artist or "Unknown",
                            "type": (
                                "upload" if track_data.type == "upload" else "internal"
                            ),
                        }
                        similar_tracks.append(track_info)
            else:
                similar_tracks = []

            # Format response like similarity endpoints. `fork_id` and `is_following` are
            # intentionally omitted — the frontend doesn't use them (see
            # docs/PLAYBACK_APPLE_MUSIC_PLAN.md). The favorite fields are kept.
            playlist_dict = {
                "id": playlist.uuid,
                "name": playlist.name,
                "is_public": playlist.is_public,
                "is_favorite": False,
                # True → frontend fetches the media-server playlist cover; else the seed track cover.
                "has_custom_cover": bool(playlist.has_custom_cover),
                # Owner-only affordances (e.g. the cover pen icon). Backend still enforces owner-only
                # on every mutating endpoint; this only drives what the UI offers.
                "is_owner": bool(user_id is not None and playlist.user_id == user_id),
            }

            # Enrich with engagement data if user is logged in
            if user_id:
                try:
                    from app.repositories.playlist_engagement_repository import (
                        PlaylistEngagementRepository,
                    )

                    engagement_repo = PlaylistEngagementRepository()
                    engagement = await engagement_repo.async_get_engagement(
                        db, user_id, playlist.id
                    )
                    if engagement:
                        playlist_dict["is_favorite"] = engagement.is_favorite
                except Exception as e:
                    # If engagement lookup fails, just use defaults (False)
                    print(f"Error enriching playlist with engagement: {e}")

            response_data = {
                "queried_track": queried_track,
                "similar_tracks": similar_tracks,
                "playlist": playlist_dict,
            }

            return response_data

        except Exception as e:
            print(f"Error getting playlist similarity data: {e}")
            raise e

    async def async_update_type(
        self, db: AsyncSession, playlist_id: int, new_type: str
    ) -> bool:
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
            await db.flush()
            return True

        except Exception as e:
            print(f"Error updating playlist type: {e}")
            raise e

    async def async_get_playlist_hls_data(
        self, db: AsyncSession, playlist_uuid: str, partner_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
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
            playlist = await self.async_get_playlist_by_uuid(db, playlist_uuid, partner_id=partner_id)
            if not playlist:
                return None

            tracks = []

            # First, get the queried track (seed track) if it exists
            if playlist.seed_track_id:
                seed_query = text(
                    """
                    SELECT 
                        t.uuid,
                        t.title,
                        (t.duration_ms / 1000.0) as duration_sec,
                        t.type as type,
                        COALESCE(
                            GROUP_CONCAT(DISTINCT c.full_name ORDER BY c.full_name SEPARATOR ', '),
                            'Unknown Artist'
                        ) as artist
                    FROM tracks t
                    LEFT JOIN track_contributors tc ON t.id = tc.track_id
                    LEFT JOIN contributors c ON tc.person_id = c.id
                    WHERE t.id = :track_id
                      AND COALESCE(t.is_active, 1) = 1
                    GROUP BY t.id, t.uuid, t.title, t.duration_ms, t.type
                    LIMIT 1
                """
                )

                seed_result = await db.execute(
                    seed_query, {"track_id": playlist.seed_track_id}
                )
                seed_row = seed_result.first()

                if seed_row:
                    tracks.append(
                        {
                            "uuid": seed_row.uuid,
                            "title": seed_row.title or "Unknown",
                            "duration_sec": (
                                float(seed_row.duration_sec)
                                if seed_row.duration_sec
                                else 0.0
                            ),
                            "artist": seed_row.artist or "Unknown Artist",
                            "type": (
                                "upload" if seed_row.type == "upload" else "internal"
                            ),
                        }
                    )

            # Then, get all similar tracks in the playlist ordered by position
            similar_tracks_query = text(
                """
                SELECT 
                    t.uuid,
                    t.title,
                    (t.duration_ms / 1000.0) as duration_sec,
                    COALESCE(
                        GROUP_CONCAT(DISTINCT c.full_name ORDER BY c.full_name SEPARATOR ', '),
                        'Unknown Artist'
                    ) as artist,
                    pt.position
                FROM playlist_tracks pt
                JOIN tracks t ON pt.track_id = t.id
                LEFT JOIN track_contributors tc ON t.id = tc.track_id
                LEFT JOIN contributors c ON tc.person_id = c.id
                WHERE pt.playlist_id = :playlist_id
                  AND COALESCE(t.is_active, 1) = 1
                GROUP BY t.id, t.uuid, t.title, t.duration_ms, pt.position
                ORDER BY pt.position
            """
            )

            similar_tracks_result = await db.execute(
                similar_tracks_query, {"playlist_id": playlist.id}
            )
            similar_track_rows = similar_tracks_result.fetchall()

            # Add all similar tracks after the queried track
            for row in similar_track_rows:
                tracks.append(
                    {
                        "uuid": row.uuid,
                        "title": row.title or "Unknown",
                        "duration_sec": (
                            float(row.duration_sec) if row.duration_sec else 0.0
                        ),
                        "artist": row.artist or "Unknown Artist",
                    }
                )

            return {"playlist_name": playlist.name, "tracks": tracks}

        except Exception as e:
            print(f"Error getting playlist HLS data: {e}")
            raise e

    # ============================================================================
    # Admin Methods
    # ============================================================================

    async def async_get_playlist_list_admin(
        self, db: AsyncSession, filters: Dict[str, Any], partner_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get paginated playlist list with filters for admin.
        Mandatory partner scoping is enforced if partner_id is provided.

        Args:
            db: Database session
            filters: Dictionary containing filter parameters
            partner_id: Optional partner ID for tenant scoping

        Returns:
            Dictionary with playlists and pagination metadata
        """
        try:
            from sqlalchemy import and_, func
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
            
            # Apply partner scoping
            if partner_id is not None:
                conditions.append(Playlist.partner_id == partner_id)

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

            # Resolve creator usernames for this page in one batched query (registered-user
            # playlists only; guests have user_id = NULL and are identified by guest_visitor_id).
            from app.models.user import User

            user_ids = {p.user_id for p in playlists if p.user_id is not None}
            username_by_id: Dict[int, str] = {}
            if user_ids:
                urows = await db.execute(
                    select(User.id, User.username).where(User.id.in_(user_ids))
                )
                username_by_id = {uid: uname for uid, uname in urows.all()}

            # Format results
            playlist_list = []
            for playlist in playlists:
                playlist_list.append(
                    {
                        "id": playlist.id,
                        "uuid": playlist.uuid,
                        "user_id": playlist.user_id,
                        # Creator username (None for guest-created playlists).
                        "creator_username": (
                            username_by_id.get(playlist.user_id)
                            if playlist.user_id
                            else None
                        ),
                        # Guest identifier for anonymous creators (None for registered users).
                        "guest_visitor_id": playlist.guest_visitor_id,
                        "name": playlist.name,
                        "is_public": playlist.is_public,
                        "type": playlist.type,
                        "seed_track_id": playlist.seed_track_id,
                        "fork_id": playlist.fork_id,
                        "forked_at": (
                            playlist.forked_at.isoformat()
                            if playlist.forked_at
                            else None
                        ),
                        "fork_count": playlist.fork_count,
                        "created_at": (
                            playlist.created_at.isoformat()
                            if playlist.created_at
                            else None
                        ),
                    }
                )

            # Calculate pagination
            total_pages = (total + page_size - 1) // page_size if total > 0 else 0

            return {
                "data": playlist_list,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": total_pages,
                },
            }

        except Exception as e:
            print(f"Error getting admin playlist list: {e}")
            raise e

    async def async_delete_playlist_admin(
        self, db: AsyncSession, playlist_id: int, partner_id: Optional[int] = None
    ) -> bool:
        """
        Delete a playlist by ID with optional partner scoping.

        Args:
            db: Database session
            playlist_id: Playlist ID to delete
            partner_id: Optional partner ID for tenant scoping

        Returns:
            True if deleted, False if not found
        """
        try:
            # Get playlist
            query = select(Playlist).where(Playlist.id == playlist_id)
            if partner_id is not None:
                query = query.where(Playlist.partner_id == partner_id)
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
        self, db: AsyncSession, playlist_ids: List[int]
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
        self, db: AsyncSession, playlist_id: int, is_public: bool, partner_id: Optional[int] = None
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
            if partner_id is not None:
                stmt = stmt.where(Playlist.partner_id == partner_id)
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
        self, db: AsyncSession, playlist_ids: List[int], is_public: bool, partner_id: Optional[int] = None
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
            stmt = update(Playlist).where(Playlist.id.in_(playlist_ids))
            if partner_id is not None:
                stmt = stmt.where(Playlist.partner_id == partner_id)
            stmt = stmt.values(is_public=is_public)
            result = await db.execute(stmt)
            await db.commit()

            return result.rowcount

        except Exception as e:
            await db.rollback()
            print(f"Error batch updating playlist visibility: {e}")
            raise e

    async def async_get_all_playlists_for_export(
        self, db: AsyncSession, filters: Dict[str, Any], partner_id: Optional[int] = None
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
            from sqlalchemy import and_
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

            if partner_id is not None:
                conditions.append(Playlist.partner_id == partner_id)


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
                playlist_list.append(
                    {
                        "id": playlist.id,
                        "uuid": playlist.uuid,
                        "user_id": playlist.user_id or "",
                        "name": playlist.name,
                        "is_public": "Public" if playlist.is_public else "Private",
                        "type": (
                            playlist.type.replace("_", " ").title()
                            if playlist.type
                            else ""
                        ),
                        "seed_track_id": playlist.seed_track_id or "",
                        "fork_id": playlist.fork_id or "",
                        "forked_at": (
                            playlist.forked_at.strftime("%Y-%m-%d %H:%M:%S")
                            if playlist.forked_at
                            else ""
                        ),
                        "fork_count": playlist.fork_count,
                        "created_at": (
                            playlist.created_at.strftime("%Y-%m-%d %H:%M:%S")
                            if playlist.created_at
                            else ""
                        ),
                    }
                )

            return playlist_list

        except Exception as e:
            print(f"Error getting playlists for export: {e}")
            raise e

    async def async_get_playlist_detail_by_uuid_admin(
        self, db: AsyncSession, playlist_uuid: str, partner_id: Optional[int] = None
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
            from app.models.track import Track
            from app.models.contributor import Contributor
            from app.models.genre import Genre
            from app.models.label import Label
            from app.models.release import Release
            from app.models.playlist import PlaylistTrack
            from app.models.release_track import ReleaseTrack
            from app.models.track_contributor import TrackContributor
            from app.models.audio_file import AudioFile

            # Get playlist
            query = select(Playlist).where(Playlist.uuid == playlist_uuid)
            if partner_id is not None:
                query = query.where(Playlist.partner_id == partner_id)
            result = await db.execute(query)
            playlist = result.scalar_one_or_none()

            if not playlist:
                return None

            # Resolve the creator — a registered user, or an anonymous guest.
            from app.models.user import User
            from app.models.log import SystemLog

            if playlist.user_id:
                urow = (
                    await db.execute(
                        select(
                            User.id,
                            User.uuid,
                            User.username,
                            User.email,
                            User.name,
                            User.is_active,
                            User.is_email_verified,
                            User.created_at,
                        ).where(User.id == playlist.user_id)
                    )
                ).first()
                if urow:
                    creator = {
                        "type": "user",
                        "id": urow.id,
                        "uuid": urow.uuid,
                        "username": urow.username,
                        "email": urow.email,
                        "name": urow.name,
                        "is_active": urow.is_active,
                        "is_email_verified": urow.is_email_verified,
                        "created_at": urow.created_at.isoformat() if urow.created_at else None,
                    }
                else:
                    # FK is SET NULL on user delete, but be defensive if a stale id lingers.
                    creator = {"type": "user", "id": playlist.user_id, "username": None}
            elif playlist.guest_visitor_id:
                # Guests aren't a table — we only store the hashed visitor_id on the playlist. Surface
                # that, plus a best-effort IP / user-agent from the request logs tied to this playlist
                # (earliest logged row with an IP ≈ the creation request). The raw IP is never stored
                # on the playlist itself, so this may be null if no such log row exists.
                log_row = (
                    await db.execute(
                        select(
                            SystemLog.client_ip,
                            SystemLog.user_agent,
                            SystemLog.created_at,
                        )
                        .where(
                            SystemLog.playlist_id == playlist.id,
                            SystemLog.client_ip.isnot(None),
                        )
                        .order_by(SystemLog.created_at.asc())
                        .limit(1)
                    )
                ).first()
                creator = {
                    "type": "guest",
                    "visitor_id": playlist.guest_visitor_id,
                    "ip": log_row.client_ip if log_row else None,
                    "user_agent": log_row.user_agent if log_row else None,
                    "seen_at": (
                        log_row.created_at.isoformat()
                        if log_row and log_row.created_at
                        else None
                    ),
                }
            else:
                creator = {"type": "unknown"}

            # Get track count
            count_query = (
                select(func.count())
                .select_from(PlaylistTrack)
                .where(PlaylistTrack.playlist_id == playlist.id)
            )
            count_result = await db.execute(count_query)
            track_count = count_result.scalar() or 0

            # Get seed track if exists
            seed_track_data = None
            if playlist.seed_track_id:
                seed_query = (
                    select(
                        Track.id,
                        Track.uuid,
                        Track.title,
                        Track.duration_ms,
                        Track.bpm,
                        Track.musical_key,
                        Track.p_line_year.label("year"),
                        Genre.name.label("genre_name"),
                        Label.label_name,
                    )
                    .outerjoin(ReleaseTrack, Track.id == ReleaseTrack.track_id)
                    .outerjoin(Release, ReleaseTrack.release_id == Release.id)
                    .outerjoin(Label, Release.label_id == Label.id)
                    .outerjoin(Genre, Track.genre_id == Genre.id)
                    .where(Track.id == playlist.seed_track_id)
                    .limit(1)
                )

                seed_result = await db.execute(seed_query)
                seed_row = seed_result.first()

                if seed_row:
                    # Get seed track artists
                    artists_query = (
                        select(Contributor.full_name)
                        .join(TrackContributor, Contributor.id == TrackContributor.person_id)
                        .where(TrackContributor.track_id == seed_row.id)
                    )
                    artists_result = await db.execute(artists_query)
                    artist_names = [row[0] for row in artists_result.fetchall()]

                    seed_track_data = {
                        "id": seed_row.id,
                        "uuid": seed_row.uuid,
                        "title": seed_row.title,
                        "artists": artist_names if artist_names else [],
                        "duration_sec": (
                            float(seed_row.duration_ms / 1000.0)
                            if seed_row.duration_ms
                            else 0.0
                        ),
                        "bpm": seed_row.bpm,
                        "musical_key": seed_row.musical_key,
                        "genre": seed_row.genre_name,
                        "label": seed_row.label_name,
                        "year": seed_row.year,
                    }

            # Get all tracks in playlist with metadata
            tracks_query = (
                select(
                    PlaylistTrack.position,
                    PlaylistTrack.score,
                    Track.id,
                    Track.uuid,
                    Track.title,
                    Track.duration_ms,
                    AudioFile.file_size_bytes.label("file_size"),
                    Track.track_type.label("type"),
                    Track.bpm,
                    Track.musical_key,
                    AudioFile.stored_path.label("file_path"),
                    Track.created_at,
                    Genre.name.label("genre_name"),
                    Label.label_name,
                    Release.title.label("release_title"),
                )
                .join(Track, PlaylistTrack.track_id == Track.id)
                .outerjoin(AudioFile, and_(Track.id == AudioFile.track_id, AudioFile.asset_class == 'Master'))
                .outerjoin(ReleaseTrack, Track.id == ReleaseTrack.track_id)
                .outerjoin(Release, ReleaseTrack.release_id == Release.id)
                .outerjoin(Label, Release.label_id == Label.id)
                .outerjoin(Genre, Track.genre_id == Genre.id)
                .where(PlaylistTrack.playlist_id == playlist.id)
                # Admin detail view — intentionally shows ALL tracks, including soft-deleted.
                .order_by(PlaylistTrack.position.asc())
            )

            tracks_result = await db.execute(tracks_query)
            track_rows = tracks_result.fetchall()

            # Format tracks with artists
            tracks_data = []
            for row in track_rows:
                # Get artists for this track
                artists_query = (
                    select(Contributor.full_name)
                    .join(TrackContributor, Contributor.id == TrackContributor.person_id)
                    .where(TrackContributor.track_id == row.id)
                )
                artists_result = await db.execute(artists_query)
                artist_names = [a[0] for a in artists_result.fetchall()]

                tracks_data.append(
                    {
                        "position": float(
                            row.position
                        ),  # Convert Decimal to float for JSON serialization
                        "score": float(row.score) if row.score else None,
                        "track": {
                            "id": row.id,
                            "uuid": row.uuid,
                            "title": row.title,
                            "artists": artist_names if artist_names else [],
                            "duration_sec": (
                                float(row.duration_ms / 1000.0) if row.duration_ms else 0.0
                            ),
                            "file_size": row.file_size or 0,
                            "type": row.type or "electrobuzz",
                            "genre": row.genre_name,
                            "label": row.label_name,
                            "release": row.release_title,
                            "bpm": row.bpm,
                            "musical_key": row.musical_key,
                            "file_path": row.file_path,
                            "created_at": (
                                row.created_at.isoformat() if row.created_at else None
                            ),
                        },
                    }
                )

            # Format response
            return {
                "playlist": {
                    "id": playlist.id,
                    "uuid": playlist.uuid,
                    "user_id": playlist.user_id,
                    "guest_visitor_id": playlist.guest_visitor_id,
                    "name": playlist.name,
                    "is_public": playlist.is_public,
                    "type": playlist.type,
                    "seed_track_id": playlist.seed_track_id,
                    "fork_id": playlist.fork_id,
                    "forked_at": (
                        playlist.forked_at.isoformat() if playlist.forked_at else None
                    ),
                    "fork_count": playlist.fork_count,
                    "created_at": (
                        playlist.created_at.isoformat() if playlist.created_at else None
                    ),
                    "track_count": track_count,
                },
                "creator": creator,
                "seed_track": seed_track_data,
                "tracks": tracks_data,
            }

        except Exception as e:
            print(f"Error getting playlist detail by UUID: {e}")
            raise e

    async def async_get_all_user_playlists(
        self,
        db: AsyncSession,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        filters=None,
        partner_id: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Get all playlists owned by a user with all required information and optional filters.
        Enforces partner scoping.

        Args:
            db: Database session
            user_id: User ID to get playlists for
            page: Page number
            page_size: Items per page
            filters: Optional UserPlaylistsFilters object
            partner_id: Optional partner ID for tenant scoping

        Returns:
            Tuple of (list of playlist dictionaries, total count)
        """
        try:
            from sqlalchemy import text, func, and_, or_
            from datetime import datetime, timedelta
            from app.models.playlist_engagement import UserPlaylistEngagement

            # Build base query conditions
            conditions = []
            if partner_id is not None:
                conditions.append(Playlist.partner_id == partner_id)
            # Never surface soft-deleted playlists to the user.
            conditions.append(Playlist.deleted_at.is_(None))
            # Beyond the plan's library cap a playlist is created hidden. It is NOT deleted and not
            # restricted — the owner can still open, play, rename, export, share and fork it by
            # link. It is only absent from this listing, which is the whole surface the cap governs.
            conditions.append(Playlist.is_library_visible.is_(True))
            needs_engagement_join = False

            # Handle all_favorites filter - if true, include playlists user favorited but doesn't own
            if filters and filters.all_favorites:
                # Join with engagement table to find favorited playlists
                # This includes both owned and non-owned playlists where is_favorite=True
                base_query = select(Playlist).join(
                    UserPlaylistEngagement,
                    and_(
                        UserPlaylistEngagement.playlist_id == Playlist.id,
                        UserPlaylistEngagement.user_id == user_id,
                        UserPlaylistEngagement.is_favorite,
                    ),
                )
                needs_engagement_join = True
            elif filters and filters.own_favorites:
                # own_favorites: user owns AND has favorited
                # Join with engagement to ensure is_favorite=True
                base_query = select(Playlist).join(
                    UserPlaylistEngagement,
                    and_(
                        UserPlaylistEngagement.playlist_id == Playlist.id,
                        UserPlaylistEngagement.user_id == user_id,
                        UserPlaylistEngagement.is_favorite,
                    ),
                )
                conditions.append(Playlist.user_id == user_id)
                needs_engagement_join = True
            else:
                # Default: only playlists owned by user
                base_query = select(Playlist)
                conditions.append(Playlist.user_id == user_id)

            # Apply filters
            if filters:
                # Free-text search: playlist name OR uuid (case-insensitive, partial).
                if getattr(filters, "search", None):
                    like = f"%{filters.search}%"
                    conditions.append(
                        or_(Playlist.name.ilike(like), Playlist.uuid.ilike(like))
                    )

                # play_time filter
                if filters.play_time:
                    if filters.play_time == "lt1h":
                        conditions.append(Playlist.play_time < 3600)
                    elif filters.play_time == "1-3h":
                        conditions.append(
                            and_(Playlist.play_time >= 3600, Playlist.play_time < 10800)
                        )
                    elif filters.play_time == "3-6h":
                        conditions.append(
                            and_(
                                Playlist.play_time >= 10800, Playlist.play_time < 21600
                            )
                        )
                    elif filters.play_time == "6-9h":
                        conditions.append(
                            and_(
                                Playlist.play_time >= 21600, Playlist.play_time < 32400
                            )
                        )
                    elif filters.play_time == "gt9h":
                        conditions.append(Playlist.play_time >= 32400)

                # num_tracks filter (minimum: playlists with at least this many tracks)
                if filters.num_tracks is not None:
                    conditions.append(Playlist.num_tracks >= filters.num_tracks)

                # Date filters
                if filters.start_date:
                    try:
                        start_date_obj = datetime.strptime(
                            filters.start_date, "%Y-%m-%d"
                        )
                        conditions.append(Playlist.created_at >= start_date_obj)
                    except ValueError:
                        pass

                if filters.end_date:
                    try:
                        end_date_obj = datetime.strptime(filters.end_date, "%Y-%m-%d")
                        # Include entire day
                        end_date_obj = (
                            end_date_obj + timedelta(days=1) - timedelta(seconds=1)
                        )
                        conditions.append(Playlist.created_at <= end_date_obj)
                    except ValueError:
                        pass

                # Visibility filter
                if filters.is_public is not None:
                    conditions.append(Playlist.is_public == filters.is_public)

            # Apply all conditions
            if conditions:
                base_query = base_query.where(and_(*conditions))

            # Count total - need to handle join for all_favorites or own_favorites
            if needs_engagement_join:
                if filters and filters.own_favorites:
                    # own_favorites: user owns AND favorited
                    count_query = (
                        select(func.count(Playlist.id))
                        .select_from(Playlist)
                        .join(
                            UserPlaylistEngagement,
                            and_(
                                UserPlaylistEngagement.playlist_id == Playlist.id,
                                UserPlaylistEngagement.user_id == user_id,
                                UserPlaylistEngagement.is_favorite,
                            ),
                        )
                    )
                    conditions_for_count = [Playlist.user_id == user_id]
                    if conditions:
                        conditions_for_count.extend(conditions)
                    if conditions_for_count:
                        count_query = count_query.where(and_(*conditions_for_count))
                else:
                    # all_favorites: any favorited playlist
                    count_query = (
                        select(func.count(Playlist.id))
                        .select_from(Playlist)
                        .join(
                            UserPlaylistEngagement,
                            and_(
                                UserPlaylistEngagement.playlist_id == Playlist.id,
                                UserPlaylistEngagement.user_id == user_id,
                                UserPlaylistEngagement.is_favorite,
                            ),
                        )
                    )
                    if conditions:
                        count_query = count_query.where(and_(*conditions))
            else:
                count_query = select(func.count(Playlist.id))
                if conditions:
                    count_query = count_query.where(and_(*conditions))

            total_result = await db.execute(count_query)
            total = total_result.scalar() or 0

            # Get page of playlists
            offset = max(0, (page - 1) * page_size)
            stmt = (
                base_query.order_by(Playlist.created_at.desc())
                .offset(offset)
                .limit(page_size)
            )
            result = await db.execute(stmt)
            playlists = result.scalars().all()

            if not playlists:
                return [], total

            # Get all playlist IDs for engagement lookup
            playlist_ids = [p.id for p in playlists]

            # Get engagement data for all playlists in one batch query
            engagement_map = {}
            if playlist_ids:
                engagement_stmt = select(UserPlaylistEngagement).where(
                    and_(
                        UserPlaylistEngagement.user_id == user_id,
                        UserPlaylistEngagement.playlist_id.in_(playlist_ids),
                    )
                )
                engagement_result = await db.execute(engagement_stmt)
                engagements = engagement_result.scalars().all()

                # Build engagement map from batch results
                for engagement in engagements:
                    engagement_map[engagement.playlist_id] = {
                        "is_favorite": engagement.is_favorite,
                        "is_following": engagement.is_following,
                    }

            # Set default values for playlists without engagement records
            for playlist_id in playlist_ids:
                if playlist_id not in engagement_map:
                    engagement_map[playlist_id] = {
                        "is_favorite": False,
                        "is_following": False,
                    }

            # Get seed track IDs that need titles
            seed_track_ids = [p.seed_track_id for p in playlists if p.seed_track_id]
            seed_track_titles = {}
            seed_track_types = {}
            seed_track_uuids = {}

            if seed_track_ids:
                # Fetch seed track uuid + title + type in one query. Normalize the DB `type`
                # column to the same "upload"/"internal" convention used by the
                # `queried_track.type` field in the similarity response. The uuid lets the
                # frontend build the media-server cover URL per playlist (same as peaks).
                seed_query = text(
                    """
                    SELECT id, uuid, title, type
                    FROM tracks
                    WHERE id IN :track_ids
                """
                )
                seed_result = await db.execute(
                    seed_query, {"track_ids": tuple(seed_track_ids)}
                )
                for row in seed_result.fetchall():
                    seed_track_titles[row.id] = row.title or None
                    seed_track_uuids[row.id] = row.uuid or None
                    seed_track_types[row.id] = (
                        "upload" if row.type == "upload" else "internal"
                    )

            # Build response
            playlist_list = []
            for playlist in playlists:
                # Get fork_id only if user owns this playlist
                fork_id_value = ""
                if playlist.user_id == user_id:
                    fork_id_value = playlist.fork_id or ""

                # Get seed track uuid + title + type ("upload" vs "internal")
                seed_track_title = None
                seed_track_type = None
                seed_track_uuid = None
                if playlist.seed_track_id:
                    seed_track_title = seed_track_titles.get(playlist.seed_track_id)
                    seed_track_type = seed_track_types.get(playlist.seed_track_id)
                    seed_track_uuid = seed_track_uuids.get(playlist.seed_track_id)

                # Get engagement data
                engagement = engagement_map.get(
                    playlist.id, {"is_favorite": False, "is_following": False}
                )

                playlist_dict = {
                    "id": playlist.uuid,  # UUID as id for compatibility
                    "uuid": playlist.uuid,
                    "name": playlist.name,
                    "is_public": playlist.is_public,
                    "seed_track_title": seed_track_title,
                    "seed_track_type": seed_track_type,
                    "seed_track_uuid": seed_track_uuid,
                    "has_custom_cover": bool(playlist.has_custom_cover),
                    "fork_id": fork_id_value,
                    "num_tracks": playlist.num_tracks or 0,
                    "play_time": playlist.play_time or 0,
                    "created_at": (
                        playlist.created_at.isoformat() if playlist.created_at else None
                    ),
                    "is_favorite": engagement["is_favorite"],
                    "is_following": engagement["is_following"],
                }
                playlist_list.append(playlist_dict)

            return playlist_list, total

        except Exception as e:
            print(f"Error getting all user playlists: {e}")
            raise e
