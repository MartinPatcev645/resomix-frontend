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
from app.repositories.track_analysis_result_repository import TrackAnalysisResultRepository
from app.repositories.track_repository import TrackRepository


class TrackService:
    """Service for a user's own uploaded tracks (library page)."""

    def __init__(self):
        self.track_repository = TrackRepository()
        self.playlist_repository = PlaylistRepository()
        self.analysis_repository = TrackAnalysisResultRepository()

    # ------------------------------------------------------------------ #
    # Serialization helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _serialize_track_summary(
        track: Track,
        playlist_uuid: Optional[str] = None,
        analysis_meta: Optional[Dict[str, Any]] = None,
        display_meta: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Lightweight representation for the library list view (reshaped 2026-07-22).

        Only scalar columns and the eager-loaded genre relationships are touched, so this is
        safe on rows fetched without eager-loading lazy collections — ``display_meta`` (artist /
        album / label, batch-resolved via ``async_get_track_display_meta_map``) and
        ``analysis_meta`` (``async_get_analysis_meta_map``) carry everything relationship-bound.

        Shape notes:
          * ``playlist_uuid`` / ``analysis_uuid`` themselves signal existence — the old
            ``has_similarity`` / ``has_analysis`` booleans were redundant and are gone.
          * Track-level ``bpm`` / ``musical_key`` / ``sub_genre`` are never populated for uploads
            — the analysis-derived values live in the ``analysis`` block instead.
          * ``duration_ms`` falls back to the analysis-measured duration (upload meta rarely
            carries one); shop/internal flags (price, explicit, active…) are not the library's
            business.
        """
        a = analysis_meta or {}
        d = display_meta or {}
        duration_ms = track.duration_ms
        if duration_ms is None and a.get("duration_ms"):
            duration_ms = int(a["duration_ms"])
        return {
            "uuid": track.uuid,
            "title": track.title,
            "version_title": track.version_title,
            "artist": d.get("artist") or track.display_artist,
            "album": d.get("album"),
            "label": d.get("label"),
            "mix_name": track.mix_name,
            "isrc": track.isrc,
            "duration_ms": duration_ms,
            "genre": track.genre_name,
            "track_type": track.track_type,
            "created_at": track.created_at.isoformat() if track.created_at else None,
            "updated_at": track.updated_at.isoformat() if track.updated_at else None,
            # Sibling artifacts — a non-null uuid IS the "exists" signal.
            "playlist_uuid": playlist_uuid,
            "analysis_uuid": a.get("analysis_uuid"),
            # Analysis-derived display metrics (null until the analysis lands).
            "analysis": (
                {
                    "top_genre": a.get("top_genre"),
                    "bpm": a.get("bpm"),
                    "music_key": a.get("music_key"),
                    "scale": a.get("scale"),
                    "camelot": a.get("camelot"),
                }
                if a.get("analysis_uuid")
                else None
            ),
        }

    @classmethod
    def _serialize_track_detail(
        cls,
        track: Track,
        playlist_uuid: Optional[str] = None,
        analysis_meta: Optional[Dict[str, Any]] = None,
        display_meta: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Full metadata for the single-track view.

        Requires ``audio_files`` and ``recording_contributors`` (with ``contributor``)
        to be eager-loaded. Internal-only fields such as the storage ``stored_path`` and
        file checksums are deliberately not exposed to the client.
        """
        detail = cls._serialize_track_summary(track, playlist_uuid, analysis_meta, display_meta)
        detail.update(
            {
                # Detail keeps is_active (the delete flow returns the flipped row).
                "is_active": track.is_active,
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
            # One batch query each to tell which tracks already have a similarity playlist / analysis.
            track_ids = [t.id for t in tracks]
            playlist_map = await self.playlist_repository.async_get_similarity_playlist_map(
                db, track_ids, partner_id=partner_id
            )
            analysis_map = await self.analysis_repository.async_get_analysis_meta_map(
                db, track_ids, partner_id=partner_id
            )
            display_map = await self.track_repository.async_get_track_display_meta_map(
                db, track_ids
            )
            data: List[Dict[str, Any]] = [
                self._serialize_track_summary(
                    t, playlist_map.get(t.id), analysis_map.get(t.id), display_map.get(t.id)
                )
                for t in tracks
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
            analysis_map = await self.analysis_repository.async_get_analysis_meta_map(
                db, [track.id], partner_id=partner_id
            )
            display_map = await self.track_repository.async_get_track_display_meta_map(
                db, [track.id]
            )
            return {
                "success": True,
                "data": self._serialize_track_detail(
                    track, playlist_map.get(track.id), analysis_map.get(track.id),
                    display_map.get(track.id)
                ),
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
        """Soft-delete one of the user's own uploaded tracks and cascade the cleanup.

        On delete we:
          1. soft-delete the track (``is_active=False``),
          2. soft-delete any similarity playlist generated from this track (seed),
          3. (next sprint) soft-delete the track's analysis record once analysis exists,
          4. purge the track's media-server assets — peaks, segments, embeddings
             (maest + discogs), preview, cover, raw — in a background task so a slow/down
             media server never fails the user's delete.
        """
        try:
            track = await self.track_repository.async_soft_delete_user_track(
                db, uuid, user_id, partner_id=partner_id
            )
            if track is None:
                return {
                    "success": False,
                    "error": "Track not found",
                    "not_found": True,
                }

            # Cascade (same transaction): soft-delete the similarity playlist(s) seeded
            # from this track so they vanish from the user's library too.
            playlists_deleted = (
                await self.playlist_repository.async_soft_delete_playlists_by_seed_track(
                    db, track.id, partner_id=partner_id
                )
            )
            # TODO (next sprint): once track analysis exists, soft-delete the analysis
            # record for this track here (same transaction).

            await db.commit()

            # Media-server asset purge (peaks/segments/embeddings/preview/cover/raw) runs
            # off the request path. Best-effort dispatch — if the broker is unavailable the
            # DB delete still stands and the cleanup worker is the backstop.
            try:
                from app.tasks.track_tasks import purge_uploaded_track_assets

                purge_uploaded_track_assets.delay(partner_id, uuid)
            except Exception as dispatch_exc:
                print(f"Failed to enqueue asset purge for track {uuid}: {dispatch_exc}")

            return {
                "success": True,
                "data": {
                    "uuid": uuid,
                    "is_active": False,
                    "playlists_deleted": playlists_deleted,
                },
                "message": "Track deleted successfully",
            }
        except Exception as e:
            await db.rollback()
            print(f"Error deleting user track: {e}")
            return {
                "success": False,
                "error": "An error occurred while deleting the track",
            }
