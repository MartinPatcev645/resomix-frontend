"""
Playlist Service
================

This service handles playlist-related business logic including playlist management,
track organization, and similarity data formatting. It provides functionality for
rename operations, visibility changes, and similarity data retrieval.

Coordinates with playlist repository for database operations and formats
responses for playlist-related API endpoints.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import httpx
import json
import urllib.parse
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository
from app.repositories.operation_limit_repository import OperationLimitRepository
from app.services.admin_operation_log_service import AdminOperationLogService
from app.services.metadata_service import MetadataService
from app.utils.demo_mode_utils import apply_demo_mode_redaction, is_anonymous_frontend, ANON_VISIBLE_COUNT
from app.core.config import settings


class PlaylistService:
    """Service for playlist-related operations."""

    def __init__(self):
        """Initialize playlist service."""
        self.playlist_repository = PlaylistRepository()
        self.track_repository = TrackRepository()

    async def rename_playlist(
        self, db: AsyncSession, playlist_uuid: str, new_name: str, partner_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Rename a playlist by UUID with partner scoping.

        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            new_name: New playlist name
            partner_id: Optional partner ID for tenant scoping

        Returns:
            Dictionary with success status, message, and old_name
        """
        try:
            result = await self.playlist_repository.async_rename_playlist(
                db, playlist_uuid, new_name, partner_id=partner_id, user_id=user_id
            )

            if result["success"]:
                await db.commit()
                return {
                    "success": True,
                    "message": "Playlist renamed successfully",
                    "old_name": result["old_name"],
                }
            else:
                await db.rollback()
                return {
                    "success": False,
                    "error": "Playlist not found",
                    "old_name": None,
                }

        except Exception as e:
            await db.rollback()
            print(f"Error in playlist service rename: {e}")
            return {
                "success": False,
                "error": "An error occurred while renaming the playlist",
                "old_name": None,
            }

    async def change_playlist_visibility(
        self, db: AsyncSession, playlist_uuid: str, is_public: bool, partner_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Change playlist visibility (public/private) by UUID with partner scoping.

        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            is_public: Whether to make the playlist public
            partner_id: Optional partner ID for tenant scoping
            user_id: When provided, only the owning user may change visibility.

        Returns:
            Dictionary with success status and message
        """
        try:
            success = await self.playlist_repository.async_make_playlist_public(
                db, playlist_uuid, is_public, partner_id=partner_id, user_id=user_id
            )

            if success:
                visibility = "public" if is_public else "private"
                await db.commit()
                return {
                    "success": True,
                    "message": f"Playlist visibility changed to {visibility} successfully",
                }
            else:
                await db.rollback()
                return {"success": False, "error": "Playlist not found"}

        except Exception as e:
            await db.rollback()
            print(f"Error in playlist service visibility change: {e}")
            return {
                "success": False,
                "error": "An error occurred while changing playlist visibility",
            }

    async def delete_playlist(
        self, db: AsyncSession, playlist_uuid: str, user_id: int,
        partner_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Soft-delete one of the user's own playlists (owner-only).

        Returns ``{"success": True}`` on delete, or ``{"success": False, "not_found": True}``
        when the playlist doesn't exist / isn't owned by the user / is already deleted.
        """
        try:
            # Capture the custom-cover info BEFORE the delete so we can clean the media-server file
            # up afterwards (the soft-delete only returns a bool). Owner-checked so we never touch a
            # cover we don't own; this read is non-fatal (worst case: an orphaned cover file remains).
            cover_partner_id: Optional[int] = None
            has_custom_cover = False
            try:
                existing = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_uuid)
                if existing and existing.user_id == user_id and bool(getattr(existing, "has_custom_cover", False)):
                    has_custom_cover = True
                    cover_partner_id = existing.partner_id
            except Exception as e:
                print(f"delete_playlist: could not read cover flag for {playlist_uuid}: {e}")

            deleted = await self.playlist_repository.async_soft_delete_user_playlist(
                db, playlist_uuid, user_id, partner_id=partner_id
            )
            if not deleted:
                await db.rollback()
                return {"success": False, "error": "Playlist not found", "not_found": True}
            await db.commit()

            # Best-effort cleanup of the custom cover on the media server. Mirrors the resilience in
            # upload_custom_cover: the delete is already committed, so a media-server error must never
            # fail or undo it — we only log. The DELETE endpoint is idempotent.
            if has_custom_cover and cover_partner_id is not None:
                try:
                    from app.services.hetzner_service import HetznerService
                    res = await HetznerService().delete_playlist_cover(cover_partner_id, playlist_uuid)
                    if not res.get("success"):
                        print(f"delete_playlist: cover cleanup did not succeed for {playlist_uuid}: {res.get('error')}")
                except Exception as e:
                    print(f"delete_playlist: cover cleanup failed for {playlist_uuid} (ignored): {e}")

            return {"success": True, "message": "Playlist deleted successfully"}
        except Exception as e:
            await db.rollback()
            print(f"Error in playlist service delete: {e}")
            return {
                "success": False,
                "error": "An error occurred while deleting the playlist",
            }

    def _apply_playlist_response_filtering(
        self, similarity_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Apply metadata filtering to playlist similarity data.
        This ensures existing tracks in playlists get filtered even if they weren't filtered during upload.

        Args:
            similarity_data: Playlist similarity data dictionary

        Returns:
            Filtered similarity data
        """
        filtered_data = similarity_data.copy()

        # Filter queried_track if it exists
        if filtered_data.get("queried_track"):
            track = filtered_data["queried_track"]
            if track.get("title"):
                track["title"] = MetadataService._filter_title_field(track["title"])
            if track.get("artist"):
                track["artist"] = MetadataService._filter_metadata_field(
                    track["artist"], "Artist"
                )
            if track.get("label"):
                track["label"] = MetadataService._filter_metadata_field(
                    track["label"], "Label"
                )

        # Filter similar_tracks
        if filtered_data.get("similar_tracks"):
            for track in filtered_data["similar_tracks"]:
                if track.get("title"):
                    track["title"] = MetadataService._filter_title_field(track["title"])
                if track.get("artist"):
                    track["artist"] = MetadataService._filter_metadata_field(
                        track["artist"], "Artist"
                    )
                if track.get("label"):
                    track["label"] = MetadataService._filter_metadata_field(
                        track["label"], "Label"
                    )

        return filtered_data

    async def _call_media_server(
        self, endpoint: str, data: Optional[Dict] = None
    ) -> str:
        """
        Helper function to call the media server for HLS M3U8 generation.
        Returns the M3U8 content as string or raises exception on error.
        """
        if not settings.hls_media_base_url:
            raise ValueError("HLS media base URL not configured")

        # Build target URL. This is an internal Alwyzon → Hetzner media-server call: the media
        # server authenticates it by IP allowlist and reads the authoritative ``partner_id`` from
        # the query string (see the media server's ``require_partner_id``). No api_key is sent —
        # the retired static key was never validated there, and playback by the browser is
        # authorised separately by the Edge Authorization JWT (``?token=``).
        base_url = settings.hls_media_base_url.rstrip("/")
        signed_url = f"{base_url}{endpoint}"

        print(f"Calling media server: {signed_url}")

        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                response = await client.post(
                    signed_url,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/vnd.apple.mpegurl",
                        "Origin": settings.resomix_server_url,
                    },
                    content=json.dumps(data) if data else None,
                )
                response.raise_for_status()
                return response.text
            except httpx.HTTPStatusError as e:
                print(
                    f"HTTP error calling media server {signed_url}: {e.response.status_code} - {e.response.text}"
                )
                raise ValueError(f"Media server HTTP error: {e.response.status_code}")
            except httpx.RequestError as e:
                print(f"Request error calling media server {signed_url}: {e}")
                raise ValueError(f"Could not connect to media server: {e}")
            except Exception as e:
                print(f"Generic error calling media server {signed_url}: {e}")
                raise ValueError(f"An unexpected error occurred: {e}")

    async def get_playlist_similarity_data(
        self, db: AsyncSession, playlist_uuid: str, user_id: Optional[int] = None, partner_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get playlist with similarity data formatted like similarity endpoints.
        Only returns data for public playlists, or private playlists if user is the owner.
        Enforces partner scoping.

        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            user_id: Optional user ID - if provided, allows access to user's own private playlists
            partner_id: Optional partner ID for tenant scoping

        Returns:
            Dictionary with similarity-formatted data or error
        """
        try:
            similarity_data = (
                await self.playlist_repository.async_get_playlist_similarity_data(
                    db, playlist_uuid, user_id=user_id, partner_id=partner_id
                )
            )

            if similarity_data is None:
                return {"success": False, "error": "Playlist not found"}
            elif (
                isinstance(similarity_data, dict)
                and similarity_data.get("error") == "playlist_not_public"
            ):
                return {
                    "success": False,
                    "error": "Playlist is not public. Only public playlists can be accessed.",
                }
            else:
                # Join Apple Music preview/metadata onto the seed + members (playback layer).
                # Must run BEFORE redaction so hidden tracks get their Apple fields stripped too.
                from app.services.apple_music_enrichment import enrich_similarity_data_with_apple
                await enrich_similarity_data_with_apple(db, similarity_data)

                filtered_data = self._apply_playlist_response_filtering(similarity_data)
                if is_anonymous_frontend(user_id is not None, partner_id, settings.system_partner_id):
                    apply_demo_mode_redaction(filtered_data, visible_count=ANON_VISIBLE_COUNT)
                return {"success": True, "data": filtered_data}

        except Exception as e:
            print(f"Error in playlist service get similarity data: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving playlist data",
            }

    async def fork_playlist(
        self, db: AsyncSession, playlist_uuid: str, user_id: int
    ) -> Dict[str, Any]:
        """
        Fork (copy) a public playlist for a user.

        Args:
            db: Database session
            playlist_uuid: UUID of the playlist to fork
            user_id: ID of the user forking the playlist

        Returns:
            Dictionary with success status and forked playlist data or error message
        """
        try:
            # Call repository method
            result = await self.playlist_repository.async_fork_playlist(
                db, playlist_uuid, user_id
            )

            # Handle response cases
            if result is None:
                return {"success": False, "error": "Playlist not found"}
            elif isinstance(result, dict) and result.get("error") == "not_public":
                return {
                    "success": False,
                    "error": "Cannot fork private playlists. Only public playlists can be forked.",
                }
            elif isinstance(result, dict) and result.get("error") == "already_owner":
                return {
                    "success": False,
                    "error": "You already own this playlist. No need to fork it.",
                }
            else:
                # Valid data returned - apply metadata filtering
                filtered_data = self._apply_playlist_response_filtering(result)
                # Fork requires an authenticated user, so the caller is never anonymous → full data.
                return {"success": True, "data": filtered_data}

        except Exception as e:
            print(f"Error in playlist service fork playlist: {e}")
            return {
                "success": False,
                "error": "An error occurred while forking the playlist",
            }

    async def get_playlist_hls_data(
        self, db: AsyncSession, playlist_uuid: str, token: Optional[str] = None, partner_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Get playlist as HLS M3U8 format by calling media server.
        Only works with public playlists. Enforces partner scoping.

        Args:
            db: Database session
            playlist_uuid: Playlist UUID
            token: Optional Edge Authorization JWT to propagate to segments
            partner_id: Optional partner ID for tenant scoping

        Returns:
            Dictionary with M3U8 content or error
        """
        try:
            # Get playlist tracks with metadata (includes public check and partner scoping)
            hls_data = await self.playlist_repository.async_get_playlist_hls_data(
                db, playlist_uuid, partner_id=partner_id
            )

            if not hls_data:
                return {"success": False, "error": "Playlist not found"}

            tracks = hls_data.get("tracks", [])
            if not tracks:
                return {"success": False, "error": "Playlist has no tracks"}

            # Playback split (see docs/PLAYBACK_APPLE_MUSIC_PLAN.md): catalogue tracks play from Apple
            # Music previews client-side, so the HLS manifest carries ONLY the HLS-playable tracks —
            # the user's own uploads (typically just the seed). Everything else has no segments.
            tracks = [t for t in tracks if t.get("type") == "upload"]
            if not tracks:
                return {"success": False, "error": "Playlist has no HLS-playable tracks"}

            # Extract ordered UUIDs (seed track first, then similar tracks by position)
            uuid_list = [track.get("uuid") for track in tracks if track.get("uuid")]

            # Freemium gate: the play-session bakes a signed `max_tracks` claim into the edge
            # token for anonymous frontend sessions. The HLS player request carries only that
            # token (no user JWT), so we read the preview cap from the token and truncate the
            # manifest. Authenticated/B2B sessions carry no cap → full manifest.
            from app.utils.edge_auth import decode_edge_token
            max_tracks = decode_edge_token(token).get("max_tracks") if token else None
            if max_tracks:
                uuid_list = uuid_list[: int(max_tracks)]

            # Get the seed track type (it's the first track in the list)
            seed_track_type = (
                tracks[0].get("type", "internal") if tracks else "internal"
            )

            # Call media server to generate segmented M3U8.
            # partner_id is passed as a query param so the Hetzner edge-auth
            # middleware (which reads from request.query_params) can resolve
            # the partner-scoped assets correctly.
            # NB: hls_media_base_url already ends in ".../signed-audio/" (config default; also what
            # hls_utils appends to), so this endpoint is relative to it — do NOT re-prefix
            # "/signed-audio/" here or the URL doubles to /signed-audio/signed-audio/hls-m3u8/ (404).
            hls_endpoint = "/hls-m3u8/"
            if partner_id is not None:
                hls_endpoint = f"{hls_endpoint}?partner_id={partner_id}"
            m3u8_content = await self._call_media_server(
                hls_endpoint,
                {"uuids": uuid_list, "reference_track_type": seed_track_type},
            )

            # Phase 3.5: Edge Authorization - Propagate the token to all URLs in the manifest
            if token and m3u8_content:
                lines = []
                for line in m3u8_content.splitlines():
                    # If line is a URL or path (not a comment/tag)
                    if line and not line.startswith("#"):
                        # Append token - handle existing query params
                        separator = "&" if "?" in line else "?"
                        lines.append(f"{line}{separator}token={token}")
                    else:
                        lines.append(line)
                m3u8_content = "\n".join(lines)

            return {
                "success": True,
                "m3u8_content": m3u8_content,
                "playlist_name": hls_data.get("playlist_name", "Unknown Playlist"),
                "track_count": len(uuid_list),
            }

        except Exception as e:
            print(f"Error in playlist service get HLS data: {e}")
            return {
                "success": False,
                "error": "An error occurred while generating HLS playlist",
            }

    # ============================================================================
    # Admin Methods
    # ============================================================================

    async def get_playlist_list_admin(
        self, db: AsyncSession, filters: Dict[str, Any], partner_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get paginated playlist list for admin with filters and partner scoping.

        Args:
            db: Database session
            filters: Dictionary containing filter parameters
            partner_id: Optional partner ID for tenant scoping

        Returns:
            Dictionary with success status and playlist data
        """
        try:
            result = await self.playlist_repository.async_get_playlist_list_admin(
                db, filters, partner_id=partner_id
            )
            return {"success": True, **result}
        except Exception as e:
            print(f"Error getting playlist list for admin: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving playlists",
            }

    async def get_playlist_by_id_admin(
        self, db: AsyncSession, playlist_id: int
    ) -> Dict[str, Any]:
        """
        Fetch a single playlist by its integer ID (admin).

        Used for capturing the audit "before state" prior to a mutation (delete /
        visibility change). Returns the raw Playlist model in ``data``.

        Args:
            db: Database session
            playlist_id: Playlist ID

        Returns:
            Dictionary with success status and the playlist model (or an error)
        """
        try:
            playlist = await self.playlist_repository.async_get_by_id(db, playlist_id)
            if playlist:
                return {"success": True, "data": playlist}
            return {"success": False, "error": "Playlist not found"}
        except Exception as e:
            print(f"Error getting playlist by id for admin: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving the playlist",
            }

    async def delete_playlist_admin(
        self, db: AsyncSession, playlist_id: int, partner_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Delete a playlist by ID with partner scoping.

        Args:
            db: Database session
            playlist_id: Playlist ID to delete
            partner_id: Optional partner ID for tenant scoping

        Returns:
            Dictionary with success status and message
        """
        try:
            deleted = await self.playlist_repository.async_delete_playlist_admin(
                db, playlist_id, partner_id=partner_id
            )

            if deleted:
                return {"success": True, "message": "Playlist deleted successfully"}
            else:
                return {"success": False, "error": "Playlist not found"}

        except Exception as e:
            print(f"Error deleting playlist: {e}")
            return {
                "success": False,
                "error": "An error occurred while deleting the playlist",
            }

    async def batch_delete_playlists_admin(
        self, db: AsyncSession, playlist_ids: list
    ) -> Dict[str, Any]:
        """
        Delete multiple playlists.

        Args:
            db: Database session
            playlist_ids: List of playlist IDs to delete

        Returns:
            Dictionary with success status, count, and message
        """
        try:
            deleted_count = (
                await self.playlist_repository.async_batch_delete_playlists_admin(
                    db, playlist_ids
                )
            )

            if deleted_count > 0:
                message = f"Successfully deleted {deleted_count} playlist{'s' if deleted_count > 1 else ''}"
            else:
                message = "No playlists were deleted"

            return {"success": True, "deleted_count": deleted_count, "message": message}

        except Exception as e:
            print(f"Error batch deleting playlists: {e}")
            return {
                "success": False,
                "error": "An error occurred while batch deleting playlists",
            }

    async def change_playlist_visibility_admin(
        self, db: AsyncSession, playlist_id: int, is_public: bool
    ) -> Dict[str, Any]:
        """
        Change playlist visibility by ID (admin).

        Args:
            db: Database session
            playlist_id: Playlist ID
            is_public: Whether to make the playlist public

        Returns:
            Dictionary with success status and message
        """
        try:
            success = (
                await self.playlist_repository.async_change_playlist_visibility_by_id(
                    db, playlist_id, is_public
                )
            )

            if success:
                visibility = "public" if is_public else "private"
                return {
                    "success": True,
                    "message": f"Playlist made {visibility} successfully",
                }
            else:
                return {"success": False, "error": "Playlist not found"}

        except Exception as e:
            print(f"Error changing playlist visibility: {e}")
            return {
                "success": False,
                "error": "An error occurred while changing playlist visibility",
            }

    async def batch_change_playlist_visibility_admin(
        self, db: AsyncSession, playlist_ids: List[int], is_public: bool
    ) -> Dict[str, Any]:
        """
        Change visibility for multiple playlists (admin).

        Args:
            db: Database session
            playlist_ids: List of playlist IDs to update
            is_public: Whether to make the playlists public

        Returns:
            Dictionary with success status, updated count, and message
        """
        try:
            updated_count = (
                await self.playlist_repository.async_batch_change_playlist_visibility(
                    db, playlist_ids, is_public
                )
            )

            total_requested = len(playlist_ids)

            if updated_count == total_requested:
                message = f"Successfully updated {updated_count} playlist{'s' if updated_count > 1 else ''}"
            elif updated_count > 0:
                message = f"Updated {updated_count} out of {total_requested} playlists. {total_requested - updated_count} not found."
            else:
                message = (
                    "No playlists were updated. None of the provided IDs were found."
                )

            return {"success": True, "updated_count": updated_count, "message": message}

        except Exception as e:
            print(f"Error batch changing playlist visibility: {e}")
            return {
                "success": False,
                "error": "An error occurred while batch changing playlist visibility",
                "updated_count": 0,
            }

    async def export_playlists_csv_admin(
        self, db: AsyncSession, filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Export playlists to CSV.

        Args:
            db: Database session
            filters: Dictionary containing filter parameters

        Returns:
            Dictionary with download URL, filename, and expiry
        """
        try:
            import csv
            import os
            from datetime import datetime, timedelta

            # Get all playlists matching filters
            playlists = (
                await self.playlist_repository.async_get_all_playlists_for_export(
                    db, filters
                )
            )

            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"playlist_export_{timestamp}.csv"

            # Ensure exports directory exists
            exports_dir = os.path.join("exports")
            os.makedirs(exports_dir, exist_ok=True)

            filepath = os.path.join(exports_dir, filename)

            # Write CSV with UTF-8 BOM for Excel compatibility
            with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)

                # Write header
                writer.writerow(
                    [
                        "ID",
                        "UUID",
                        "User ID",
                        "Name",
                        "Visibility",
                        "Type",
                        "Seed Track ID",
                        "Fork ID",
                        "Forked At",
                        "Fork Count",
                        "Created At",
                    ]
                )

                # Write data
                for playlist in playlists:
                    writer.writerow(
                        [
                            playlist.get("id", ""),
                            playlist.get("uuid", ""),
                            playlist.get("user_id", ""),
                            playlist.get("name", ""),
                            playlist.get("is_public", ""),
                            playlist.get("type", ""),
                            playlist.get("seed_track_id", ""),
                            playlist.get("fork_id", ""),
                            playlist.get("forked_at", ""),
                            playlist.get("fork_count", ""),
                            playlist.get("created_at", ""),
                        ]
                    )

            # Generate download URL (expires in 1 hour)
            download_url = f"/exports/{filename}"
            expires_at = (datetime.now() + timedelta(hours=1)).isoformat()

            return {
                "success": True,
                "download_url": download_url,
                "filename": filename,
                "expires_at": expires_at,
            }

        except Exception as e:
            print(f"Error exporting playlists to CSV: {e}")
            return {
                "success": False,
                "error": "An error occurred while exporting playlists",
            }

    async def get_playlist_detail_by_uuid_admin(
        self, db: AsyncSession, playlist_uuid: str
    ) -> Dict[str, Any]:
        """
        Get detailed playlist information by UUID for admin.

        Args:
            db: Database session
            playlist_uuid: Playlist UUID

        Returns:
            Dictionary with success status and playlist details
        """
        try:
            # Validate UUID format
            import re

            uuid_pattern = (
                r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
            )
            if not re.match(uuid_pattern, playlist_uuid.lower()):
                return {"success": False, "error": "Invalid playlist UUID format"}

            result = (
                await self.playlist_repository.async_get_playlist_detail_by_uuid_admin(
                    db, playlist_uuid
                )
            )

            if result:
                return {"success": True, "data": result}
            else:
                return {"success": False, "error": "Playlist not found"}

        except Exception as e:
            print(f"Error getting playlist detail by UUID: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving playlist details",
            }

    async def get_all_user_playlists(
        self,
        db: AsyncSession,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        filters=None,
        partner_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Get all playlists owned by a user with optional filters and partner scoping.

        Args:
            db: Database session
            user_id: User ID to get playlists for
            page: Page number
            page_size: Items per page
            filters: Optional UserPlaylistsFilters object
            partner_id: Optional partner ID for tenant scoping

        Returns:
            Dictionary with success status and list of playlists
        """
        try:
            playlists, total = (
                await self.playlist_repository.async_get_all_user_playlists(
                    db, user_id, page, page_size, filters, partner_id=partner_id
                )
            )
            return {"success": True, "data": playlists, "total": total}
        except Exception as e:
            print(f"Error getting all user playlists: {e}")
            return {
                "success": False,
                "error": "An error occurred while retrieving playlists",
                "data": [],
                "total": 0,
            }

    async def upload_custom_cover(
        self, db: AsyncSession, playlist_uuid: str, user_id: int, image_bytes: bytes, content_type: str
    ) -> Dict[str, Any]:
        """Owner-checked custom playlist cover upload.

        Ownership is enforced HERE (mirrors rename): a playlist not owned by ``user_id`` is treated
        as not found. Then: optional ClamAV scan → forward to the media server (which does the
        authoritative image validation with Pillow and stores it by playlist uuid) → flip
        ``has_custom_cover``. Returns ``{success, error?, status?}``.
        """
        from app.utils.clamav import scan_bytes
        from app.services.hetzner_service import HetznerService

        playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_uuid)
        if not playlist or playlist.user_id != user_id:
            return {"success": False, "error": "Playlist not found or not owned by you", "status": 404}

        clean, threat = scan_bytes(image_bytes)
        if not clean:
            return {"success": False, "error": "The file failed a security scan and was rejected.", "status": 400}

        res = await HetznerService().store_playlist_cover(
            playlist.partner_id, playlist_uuid, image_bytes, content_type
        )
        if not res.get("success"):
            # A 400 from the media server = image validation (not square / wrong resolution).
            status = 400 if res.get("status") == 400 else 502
            return {"success": False, "error": res.get("error", "Failed to save the cover."), "status": status}

        playlist.has_custom_cover = True
        await db.commit()
        return {"success": True}

    async def get_playlist_playback_session(
        self, playlist_id: str, client_ip: str, partner_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> dict:
        """
        Evaluate territory restrictions and generate an Edge Authorization session token
        for playing a server-stitched playlist.

        For an anonymous frontend session (no user_id, System Partner) we bake a signed
        ``max_tracks`` cap into the token so the HLS manifest is truncated to a preview —
        the m3u8 request itself carries no user auth, so the cap must travel in the token.
        """
        # TODO: Phase 3.1 Integration
        # Once Redis deal_terms and GeoIP are integrated, evaluate takedowns
        # and territory restrictions here for all tracks in the playlist.
        # For now, we mock the territory check to True.

        from app.utils.edge_auth import generate_edge_token
        from app.core.config import settings

        try:
            # Embed the owning partner so the Hetzner edge can resolve partner-scoped
            # assets directly from the verified token claim (defaults to the system
            # partner / partner 1 for frontend/B2C traffic).
            # Anonymous frontend → cap the manifest to a preview. The HLS track list is
            # [seed, similar_1, similar_2, …], so to make the first ANON_VISIBLE_COUNT *similar*
            # tracks (the ones shown un-scrambled in the metadata) all playable we keep the seed
            # plus that many → ANON_VISIBLE_COUNT + 1 uuids.
            max_tracks = (
                ANON_VISIBLE_COUNT + 1
                if is_anonymous_frontend(user_id is not None, partner_id, settings.system_partner_id)
                else None
            )
            token = generate_edge_token(
                playlist_id, client_ip, partner_id=partner_id, scope="playback",
                max_tracks=max_tracks,
            )

            # The Similarity server handles the stitched HLS playlists
            base_url = settings.public_alwyzon_url.rstrip("/")
            playback_url = (
                f"{base_url}/api/v1/playlists/similarity-hls/{playlist_id}.m3u8?token={token}"
            )

            return {"success": True, "playback_url": playback_url}
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to generate playback session: {e}",
            }
