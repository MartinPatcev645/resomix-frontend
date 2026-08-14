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
from app.models.track_artifact_status import (
    ARTIFACT_READY,
    ARTIFACT_STATES,
    ARTIFACT_UNAVAILABLE,
)
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_analysis_result_repository import TrackAnalysisResultRepository
from app.repositories.track_artifact_status_repository import TrackArtifactStatusRepository
from app.repositories.track_repository import TrackRepository

# Reported for a track with no ``track_artifact_status`` row. Not a state the pipeline can write —
# it means "we have no record", which is true of uploads that predate the table. `unknown` rather
# than `pending` on purpose: pending is an instruction to keep polling, and polling for an artifact
# nothing is building is exactly the forever-spinner this work exists to remove.
ARTIFACT_UNKNOWN = "unknown"


class TrackService:
    """Service for a user's own uploaded tracks (library page)."""

    def __init__(self):
        self.track_repository = TrackRepository()
        self.playlist_repository = PlaylistRepository()
        self.analysis_repository = TrackAnalysisResultRepository()
        self.artifact_status_repository = TrackArtifactStatusRepository()

    # ------------------------------------------------------------------ #
    # Serialization helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _resolve_artifact_state(
        recorded: Optional[str], *, artifact_exists: bool
    ) -> str:
        """Reconcile the recorded state with what is actually there.

        The artifact itself is the higher authority, in both directions:

        * a uuid present while the state says otherwise means a status write was lost (Redis blip,
          worker killed between the artifact and the bookkeeping) — the artifact is openable, so
          report ``ready``;
        * a state of ``ready`` with no uuid means the artifact was deleted afterwards, and
          promising the client something it will 404 on is worse than saying it is gone.

        Anything unrecognised — an older row, a value from a future deploy — degrades to
        ``unknown``, which renders as "no artifact" rather than as an error or a spinner.
        """
        if artifact_exists:
            return ARTIFACT_READY
        if recorded == ARTIFACT_READY:
            return ARTIFACT_UNAVAILABLE
        if recorded in ARTIFACT_STATES:
            return recorded
        return ARTIFACT_UNKNOWN

    @classmethod
    def _serialize_track_summary(
        cls,
        track: Track,
        playlist_meta: Optional[Dict[str, Any]] = None,
        analysis_meta: Optional[Dict[str, Any]] = None,
        display_meta: Optional[Dict[str, Any]] = None,
        artifact_status: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Lightweight representation for the library list view (reshaped 2026-07-22).

        Only scalar columns and the eager-loaded genre relationships are touched, so this is
        safe on rows fetched without eager-loading lazy collections — ``display_meta`` (artist /
        album / label, batch-resolved via ``async_get_track_display_meta_map``) and
        ``analysis_meta`` (``async_get_analysis_meta_map``) carry everything relationship-bound.

        Shape notes:
          * ``playlist_uuid`` / ``analysis_uuid`` themselves signal existence — the old
            ``has_similarity`` / ``has_analysis`` booleans were redundant and are gone.
          * ``artifacts`` says what is *happening* to each of those two, which a uuid cannot: its
            absence covers queued, running, produced-nothing and failed at once. Without this the
            client was inferring the difference from ``created_at`` (anything under 15 minutes old
            was called "generating"), so a slow analysis was reported to the user as an unbuilt
            feature and a failed one looked identical to a healthy one.
          * Track-level ``bpm`` / ``musical_key`` / ``sub_genre`` are never populated for uploads
            — the analysis-derived values live in the ``analysis`` block instead.
          * ``duration_ms`` falls back to the analysis-measured duration (upload meta rarely
            carries one); shop/internal flags (price, explicit, active…) are not the library's
            business.
        """
        a = analysis_meta or {}
        d = display_meta or {}
        s = artifact_status or {}
        pl = playlist_meta or {}
        # Withheld by the repository when the playlist is beyond the owner's Library cap, so this
        # is already None for a locked row — the gate is upstream, not here.
        playlist_uuid = pl.get("uuid")
        duration_ms = track.duration_ms
        if duration_ms is None and a.get("duration_ms"):
            duration_ms = int(a["duration_ms"])
        playlist_state = cls._resolve_artifact_state(
            # `pl` is present iff a playlist row exists — NOT `playlist_uuid`, which is withheld
            # for a locked one. Testing the uuid here would report a perfectly good playlist as
            # `unavailable` the moment it fell outside the Library cap, so the capsule would say
            # "no matches" about a playlist that was built and is sitting there. Existence and
            # reachability are different questions; only the second one the cap answers.
            s.get("playlist_state"), artifact_exists=bool(pl)
        )
        analysis_state = cls._resolve_artifact_state(
            s.get("analysis_state"), artifact_exists=bool(a.get("analysis_uuid"))
        )
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
            # …which is why this exists. Once the uuid can be absent for two reasons — never built,
            # or built but beyond the Library cap — its absence stops being self-explanatory, and
            # the two cases need different copy ("generating" vs "upgrade to open this").
            "playlist_locked": bool(pl.get("locked")),
            "analysis_uuid": a.get("analysis_uuid"),
            # …and this is what the absence of one MEANS. The error text is only ever populated on
            # `failed`/`unavailable`, and is written by the workers for display — it never carries
            # an internal reason (those stay in the logs, keyed by job/analysis id).
            "artifacts": {
                "playlist": {
                    "state": playlist_state,
                    "error": s.get("playlist_error") if playlist_state != ARTIFACT_READY else None,
                },
                "analysis": {
                    "state": analysis_state,
                    "error": s.get("analysis_error") if analysis_state != ARTIFACT_READY else None,
                },
            },
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
        playlist_meta: Optional[Dict[str, Any]] = None,
        analysis_meta: Optional[Dict[str, Any]] = None,
        display_meta: Optional[Dict[str, Any]] = None,
        artifact_status: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Full metadata for the single-track view.

        Requires ``audio_files`` and ``recording_contributors`` (with ``contributor``)
        to be eager-loaded. Internal-only fields such as the storage ``stored_path`` and
        file checksums are deliberately not exposed to the client.
        """
        detail = cls._serialize_track_summary(
            track, playlist_meta, analysis_meta, display_meta, artifact_status
        )
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
        search: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        library_cap: Optional[int] = None,
    ) -> Dict[str, Any]:
        """List the user's own uploaded tracks (paginated, newest first, filterable).

        ``library_cap`` is the owner's ``library_playlists_max``. It gates the Sonic Discovery
        capsule the same way it gates the Library: a playlist beyond the cap comes back with no
        uuid and ``playlist_locked``. ``None`` means unlimited / unresolved and nothing is locked.
        """
        try:
            tracks, total = await self.track_repository.async_get_user_uploaded_tracks(
                db, user_id, page, page_size, partner_id=partner_id,
                search=search, start_date=start_date, end_date=end_date,
            )
            # One batch query each to tell which tracks already have a similarity playlist / analysis.
            track_ids = [t.id for t in tracks]
            # Resolved once for the page, not per row — the same set the Library listing uses, so
            # a playlist cannot read as locked on one screen and open on the other.
            visible_ids = await self.playlist_repository.async_visible_playlist_ids(
                db, user_id, library_cap
            )
            playlist_map = await self.playlist_repository.async_get_similarity_playlist_map(
                db, track_ids, partner_id=partner_id, visible_playlist_ids=visible_ids
            )
            analysis_map = await self.analysis_repository.async_get_analysis_meta_map(
                db, track_ids, partner_id=partner_id
            )
            display_map = await self.track_repository.async_get_track_display_meta_map(
                db, track_ids
            )
            # One more batch query alongside the three above — never one per row. A 20-row page
            # costs four queries total, and adding a per-track lookup here would put twenty on the
            # Library's 5-second poll.
            status_map = await self.artifact_status_repository.async_get_artifact_status_map(
                db, track_ids, partner_id=partner_id
            )
            data: List[Dict[str, Any]] = [
                self._serialize_track_summary(
                    t, playlist_map.get(t.id), analysis_map.get(t.id), display_map.get(t.id),
                    status_map.get(t.id),
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
        library_cap: Optional[int] = None,
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
            visible_ids = await self.playlist_repository.async_visible_playlist_ids(
                db, user_id, library_cap
            )
            playlist_map = await self.playlist_repository.async_get_similarity_playlist_map(
                db, [track.id], partner_id=partner_id, visible_playlist_ids=visible_ids
            )
            analysis_map = await self.analysis_repository.async_get_analysis_meta_map(
                db, [track.id], partner_id=partner_id
            )
            display_map = await self.track_repository.async_get_track_display_meta_map(
                db, [track.id]
            )
            status_map = await self.artifact_status_repository.async_get_artifact_status_map(
                db, [track.id], partner_id=partner_id
            )
            return {
                "success": True,
                "data": self._serialize_track_detail(
                    track, playlist_map.get(track.id), analysis_map.get(track.id),
                    display_map.get(track.id), status_map.get(track.id)
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
