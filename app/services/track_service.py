"""
Track Service
=============

This service provides business logic for user-facing track operations, primarily the
"library" page where a logged-in user manages their own uploaded tracks: listing them
(paginated), viewing full metadata for a single track, and deleting a track.

Deletion is a soft delete (``is_active`` -> False) which hides the track from the
library/catalog while leaving the row and storage assets intact. Physical purge of
Hetzner assets and the ``embedding.deleted`` webhook are handled separately by the
cleanup worker.

All operations are scoped to the authenticated user (ownership) and the partner tenant.

Version: 3.0.1
Init Date: July 3, 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.track import Track
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository


class TrackService:
    """Service for a user's own uploaded tracks (library page)."""

    def __init__(self):
        self.track_repository = TrackRepository()
        self.playlist_repository = PlaylistRepository()

    # ------------------------------------------------------------------ #
    # Serialization helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _serialize_track_summary(
        track: Track, playlist_uuid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Lightweight representation for the library list view.

        Only scalar columns and the eager-loaded genre relationships are touched, so
        this is safe to call on rows fetched without eager-loading lazy collections.

        ``playlist_uuid`` is the UUID of the similarity playlist generated from this track
        (or None). It drives the ``has_similarity`` flag. ``has_analysis`` is always False
        for now — audio analysis is not implemented yet and will be wired in later.
        """
        return {
            "uuid": track.uuid,
            "title": track.title,
            "version_title": track.version_title,
            "display_artist": track.display_artist,
            "mix_name": track.mix_name,
            "isrc": track.isrc,
            "duration_ms": track.duration_ms,
            "duration": track.duration,  # seconds (property)
            "bpm": track.bpm,
            "musical_key": track.musical_key,
            "genre": track.genre_name,
            "sub_genre": track.sub_genre_name,
            "track_type": track.track_type,
            "price_cents": track.price_cents,
            "is_explicit": track.is_explicit,
            "is_instrumental": track.is_instrumental,
            "is_active": track.is_active,
            "created_at": track.created_at.isoformat() if track.created_at else None,
            "updated_at": track.updated_at.isoformat() if track.updated_at else None,
            # Library dropdown state
            "playlist_uuid": playlist_uuid,
            "has_similarity": playlist_uuid is not None,
            "has_analysis": False,  # analysis not implemented yet — always False for now
        }

    @classmethod
    def _serialize_track_detail(
        cls, track: Track, playlist_uuid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Full metadata for the single-track view.

        Requires ``audio_files`` and ``recording_contributors`` (with ``contributor``)
        to be eager-loaded. Internal-only fields such as the storage ``stored_path`` and
        file checksums are deliberately not exposed to the client.
        """
        detail = cls._serialize_track_summary(track, playlist_uuid)
        detail.update(
            {
                "key_signature": track.key_signature,
                "audio_language": track.audio_language,
                "language_of_lyrics": track.language_of_lyrics,
                "p_line_year": track.p_line_year,
                "p_line_text": track.p_line_text,
                "parental_warning": track.parental_warning,
                "audio_files": [
                    {
                        "asset_class": af.asset_class,
                        "asset_subtype": af.asset_subtype,
                        "original_filename": af.original_filename,
                        "mime_type": af.mime_type,
                        "file_size_bytes": af.file_size_bytes,
                        "duration_seconds": af.duration_seconds,
                        "audio_codec": af.audio_codec,
                        "sample_rate": af.sample_rate,
                        "bit_depth": af.bit_depth,
                        "channels": af.channels,
                        "bitrate_kbps": af.bitrate_kbps,
                        "created_at": af.created_at.isoformat() if af.created_at else None,
                    }
                    for af in track.audio_files
                ],
                "contributors": [
                    {
                        "name": tc.contributor.full_name if tc.contributor else None,
                        "role": tc.role,
                        "royalty_type": tc.royalty_type,
                        "ownership_share": (
                            float(tc.ownership_share)
                            if tc.ownership_share is not None
                            else None
                        ),
                        "sequence_num": tc.sequence_num,
                    }
                    for tc in sorted(
                        track.recording_contributors,
                        key=lambda c: (c.sequence_num or 0),
                    )
                ],
            }
        )
        return detail

    # ------------------------------------------------------------------ #
    # Operations
    # ------------------------------------------------------------------ #

    async def get_user_tracks(
        self,
        db: AsyncSession,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        partner_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """List the user's own uploaded tracks (paginated, newest first)."""
        try:
            tracks, total = await self.track_repository.async_get_user_uploaded_tracks(
                db, user_id, page, page_size, partner_id=partner_id
            )
            # One batch query to tell which tracks already have a generated similarity playlist.
            playlist_map = await self.playlist_repository.async_get_similarity_playlist_map(
                db, [t.id for t in tracks], partner_id=partner_id
            )
            data: List[Dict[str, Any]] = [
                self._serialize_track_summary(t, playlist_map.get(t.id)) for t in tracks
            ]
            return {"success": True, "data": data, "total": total}
        except Exception as e:
            print(f"Error getting user tracks: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving tracks",
                "data": [],
                "total": 0,
            }

    async def get_user_track_detail(
        self,
        db: AsyncSession,
        uuid: str,
        user_id: int,
        partner_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Get full metadata for one of the user's own uploaded tracks."""
        try:
            track = await self.track_repository.async_get_user_uploaded_track_by_uuid(
                db, uuid, user_id, partner_id=partner_id
            )
            if track is None:
                return {
                    "success": False,
                    "error": "Track not found",
                    "not_found": True,
                }
            playlist_map = await self.playlist_repository.async_get_similarity_playlist_map(
                db, [track.id], partner_id=partner_id
            )
            return {
                "success": True,
                "data": self._serialize_track_detail(track, playlist_map.get(track.id)),
            }
        except Exception as e:
            print(f"Error getting user track detail: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving the track",
            }

    async def delete_user_track(
        self,
        db: AsyncSession,
        uuid: str,
        user_id: int,
        partner_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Soft-delete one of the user's own uploaded tracks."""
        try:
            deleted = await self.track_repository.async_soft_delete_user_track(
                db, uuid, user_id, partner_id=partner_id
            )
            if not deleted:
                return {
                    "success": False,
                    "error": "Track not found",
                    "not_found": True,
                }
            await db.commit()
            return {
                "success": True,
                "data": {"uuid": uuid, "is_active": False},
                "message": "Track deleted successfully",
            }
        except Exception as e:
            await db.rollback()
            print(f"Error deleting user track: {e}")
            return {
                "success": False,
                "error": "An error occurred while deleting the track",
            }
