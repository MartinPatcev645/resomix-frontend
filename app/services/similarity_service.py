"""
Similarity Service
==================

This service provides functionality for calculating audio similarity by interacting with a dedicated similarity microservice.
It handles similarity calculations for uploaded audio files and server-side file paths,
with database integration using MariaDB repositories.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import os
import httpx
import asyncio
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.track_repository import TrackRepository
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.similarity_repository import SimilarityRepository
from app.repositories.operation_limit_repository import OperationLimitRepository
from app.services.similarity_segment import SimilaritySegmentService
from app.core.config import settings
from app.utils.demo_mode_utils import apply_demo_mode_redaction
from app.utils.similarity_utils import (
    get_duration_from_bytes_sync,
    deduplicate_tracks,
    generate_playlist_name_from_seed_track,
)
from app.utils.similarity_filters import filter_track_title, apply_response_filtering
from app.models.constants import PlaylistType

load_dotenv()


class SimilarityService:
    """
    Service for calculating audio similarity using external similarity microservice.
    """

    def __init__(self):
        """Initialize similarity service."""
        self.track_repository = TrackRepository()
        self.playlist_repository = PlaylistRepository()
        self.similarity_repository = SimilarityRepository()
        # Use centralized config (env already loaded & normalized in settings)
        self.similarity_server_url = settings.similarity_server_url
        self.similarity_segment_service = SimilaritySegmentService(
            self.similarity_server_url
        )

    async def calculate_similarity_for_upload(
        self,
        db: AsyncSession,
        audio_bytes: bytes,
        original_filename: str,
        track_uuid: str,
        top_k: int = 10,
        similarity_duplication_threshold: int = 0,
        user_id: Optional[int] = None,
        engine: Optional[str] = None,
        partner_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Sends uploaded audio bytes to the similarity server and returns enriched similar tracks.

        Args:
            db: Database session
            audio_bytes: The raw bytes of the audio file
            original_filename: The original filename, used for context/logging and passed to server
            track_uuid: The UUID of the uploaded track to send to similarity server
            top_k: Number of similar tracks to request from similarity server
            similarity_duplication_threshold: The threshold for removing duplicates before returning
            user_id: Optional user ID (internal BIGINT) to associate playlist with logged-in user
            engine: Similarity engine (E1-E6). Defaults to None (server side default).

        Returns:
            Dictionary containing similarity results or error information
        """
        if not audio_bytes:
            return {
                "success": False,
                "error": "Audio data is empty for similarity processing.",
            }

        # Concurrently get duration and call similarity server
        duration_task = asyncio.to_thread(get_duration_from_bytes_sync, audio_bytes)

        # Extract file extension from original filename to preserve format detection
        # Use secure filename with original extension for proper format detection by embedding service
        _, file_ext = os.path.splitext(original_filename)
        if not file_ext or file_ext.lower() not in [
            ".mp3",
            ".wav",
            ".flac",
            ".m4a",
            ".aac",
            ".ogg",
            ".wma",
            ".aiff",
            ".mp4",
        ]:
            # Default to .mp3 if extension is missing or invalid
            file_ext = ".mp3"
        secure_filename = f"upload_{track_uuid}{file_ext}"
        files_data = {
            "file": (secure_filename, audio_bytes, "application/octet-stream")
        }
        request_data = {"top_k": top_k, "track_uuid": track_uuid}
        if engine:
            request_data["engine"] = engine
        if partner_id is not None:
            request_data["partner_id"] = partner_id
            
        similarity_response_task = self._call_similarity_server(
            "/similarity/query-by-upload/", data=request_data, files=files_data
        )

        # Await both tasks
        calculated_duration, similarity_response = await asyncio.gather(
            duration_task, similarity_response_task
        )

        # Check the status from the similarity server's response
        if similarity_response.get("status") == "success":
            try:
                raw_results = similarity_response.get("results", [])
                server_duration = similarity_response.get("duration")
                if server_duration is not None and server_duration > 10000:
                    server_duration = server_duration / 1000.0

                # Extract UUIDs from similarity server response
                track_uuids = [res.get("uuid") for res in raw_results if res.get("uuid")]

                # Get track details from database using UUIDs
                db_details_map = (
                    await self.similarity_repository.async_get_track_details_by_uuids(
                        db, track_uuids
                    )
                )

                # Enrich similarity results with database details
                enriched_similar_tracks = []
                track_ids = []  # For playlist creation
                track_scores = []  # For playlist scores

                for res_item in raw_results:
                    sim_track_uuid = res_item.get("uuid")
                    if not sim_track_uuid:
                        continue

                    details = db_details_map.get(sim_track_uuid)
                    if details:
                        enriched_similar_tracks.append(
                            {
                                "rank": res_item.get("rank"),
                                "score": res_item.get("score"),
                                "id": details.get("id"),
                                "label": details.get("label"),
                                "duration": details.get("duration"),
                                "artist": details.get("artist"),
                                "title": details.get("title"),
                                "year": details.get("year"),
                                "type": details.get("type"),
                            }
                        )
                        # Collect track ID and score for playlist creation
                        track_ids.append(details.get("track_id"))
                        track_scores.append(res_item.get("score", 0.0))
                    # else: track details not found in DB for this UUID, so it's omitted from results

                # Deduplicate tracks before returning
                target_count_after_deduplication = top_k - similarity_duplication_threshold
                if target_count_after_deduplication < 0:
                    target_count_after_deduplication = 0  # Ensure not negative

                # Apply response-level filtering to existing tracks before deduplication
                filtered_enriched_tracks = apply_response_filtering(enriched_similar_tracks)

                # NEW: Fetch uploaded track details to use as reference track and update duration
                uploaded_track_details = await self.similarity_repository.async_get_reference_track_details_by_uuid(
                    db, track_uuid, partner_id=partner_id
                )

                if not uploaded_track_details:
                    print(
                        f"Warning: Could not fetch details for uploaded track {track_uuid}"
                    )
                    return {
                        "success": False,
                        "error": "Could not retrieve uploaded track details",
                    }

                final_duration = (
                    server_duration
                    if server_duration is not None and server_duration > 0
                    else (
                        calculated_duration
                        if calculated_duration is not None and calculated_duration > 0
                        else None
                    )
                )
                uploaded_track_details["duration"] = final_duration
                if final_duration is not None and final_duration > 0:
                    await self.similarity_repository.async_update_track_duration(
                        db, track_uuid, final_duration
                    )
                    print(
                        f"Updated track {track_uuid} duration to {final_duration} seconds"
                    )

                deduplicated_enriched_tracks = deduplicate_tracks(
                    filtered_enriched_tracks,
                    target_count_after_deduplication,
                    reference_track=uploaded_track_details,  # Passing reference track for upload similarity
                    filter_title_func=filter_track_title,
                )

                # Get corresponding track IDs and scores for deduplicated tracks
                deduplicated_track_ids = []
                deduplicated_track_scores = []
                for track in deduplicated_enriched_tracks:
                    # Find the track_id and score for this track
                    for i, enriched_track in enumerate(filtered_enriched_tracks):
                        if enriched_track.get("id") == track.get("id"):
                            if i < len(track_ids):
                                deduplicated_track_ids.append(track_ids[i])
                                deduplicated_track_scores.append(
                                    track_scores[i] if i < len(track_scores) else 0.0
                                )
                            break

                # Create similarity playlist if we have tracks
                playlist_info = None
                if deduplicated_track_ids:
                    # Get the uploaded track's database ID
                    uploaded_track = await self.track_repository.async_get_by_uuid(
                        db, track_uuid, partner_id=partner_id
                    )
                    if uploaded_track:
                        # Generate playlist name based on uploaded track details
                        playlist_name = generate_playlist_name_from_seed_track(
                            uploaded_track_details
                        )

                        playlist_info = await self.playlist_repository.async_create_similarity_playlist(
                            db=db,
                            seed_track_id=uploaded_track.id,
                            track_ids=deduplicated_track_ids,
                            track_scores=deduplicated_track_scores,
                            name=playlist_name,
                            playlist_type=PlaylistType.SIMILARITY,
                            user_id=user_id,
                            partner_id=partner_id,
                        )

                # Format response like similarity by ID
                response_data = {
                    "queried_track": uploaded_track_details,
                    "similar_tracks": deduplicated_enriched_tracks,
                }

                # Add playlist info if created
                if playlist_info:
                    # Enrich playlist with engagement data
                    try:
                        from app.services.playlist_engagement_service import (
                            PlaylistEngagementService,
                        )

                        engagement_service = PlaylistEngagementService()
                        playlist_info = (
                            await engagement_service.enrich_playlist_with_engagement(
                                db, playlist_info, user_id
                            )
                        )
                    except Exception as e:
                        # If enrichment fails, ensure defaults are set
                        playlist_info.setdefault("is_favorite", False)
                        playlist_info.setdefault("is_following", False)
                        print(f"Error enriching playlist with engagement: {e}")
                    response_data["playlist"] = playlist_info

                # Apply filtering to queried track as well
                if response_data.get("queried_track"):
                    filtered_queried_tracks = apply_response_filtering(
                        [response_data["queried_track"]]
                    )
                    if filtered_queried_tracks:
                        response_data["queried_track"] = filtered_queried_tracks[0]

                # Increment usage counter if user is available
                if user_id:
                    try:
                        await OperationLimitRepository().async_increment_usage(
                            db, user_id=user_id, operation_code="playlist_create"
                        )
                        print(f"SIMILARITY UPLOAD: Incremented usage for user_id={user_id}")
                    except Exception as inc_err:
                        print(f"SIMILARITY UPLOAD: Failed to increment usage: {str(inc_err)}")

                await db.commit()

                if settings.demo_mode:
                    apply_demo_mode_redaction(response_data)

                return response_data
            except Exception as e:
                await db.rollback()
                print(f"Error in similarity upload database processing: {e}")
                return {"success": False, "error": f"Database processing error: {e}"}
        else:
            # Error reported by the similarity server or connection issue handled by _call_similarity_server
            error_message = similarity_response.get(
                "message", "Unknown error during similarity processing."
            )
            return {"success": False, "error": error_message}

    async def get_similarity_by_path(
        self,
        db: AsyncSession,
        server_track_path: str,
        queried_track_uuid: str,
        top_k: int = 10,
        similarity_duplication_threshold: int = 0,
        user_id: Optional[int] = None,
        engine: Optional[str] = None,
        partner_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Gets similar tracks for a given server-side file path by calling the similarity server.

        Args:
            db: Database session
            server_track_path: The file path to the track file (without /home/usman/data/ prefix)
            queried_track_uuid: The UUID of the queried track (required for new similarity endpoint)
            top_k: Number of similar tracks to request from similarity server
            similarity_duplication_threshold: The threshold for removing duplicates before returning
            user_id: Optional user ID (internal BIGINT) to associate playlist with logged-in user
            engine: Similarity engine (E1-E6). Defaults to None.

        Returns:
            Dictionary containing similarity results or error information
        """
        queried_track_data: Optional[Dict[str, Any]] = None

        try:
            queried_track_data = await self.similarity_repository.async_get_reference_track_details_by_path(
                db, server_track_path, partner_id=partner_id
            )
            if not queried_track_data:
                print(
                    f"Warning: Details for queried path '{server_track_path}' not found in local DB."
                )
                return {
                    "success": False,
                    "error": f"Track at path '{server_track_path}' not found in database",
                }

            # Use provided UUID or valid from DB
            if not queried_track_uuid:
                queried_track_uuid = queried_track_data.get("id")

            if not queried_track_uuid:
                print(f"Warning: No UUID found for queried path '{server_track_path}'")
                return {"success": False, "error": "Track UUID not found"}

            # Use new UUID-based endpoint
            payload = {"track_uuid": queried_track_uuid, "top_k": top_k}
            if engine:
                payload["engine"] = engine
            if partner_id is not None:
                payload["partner_id"] = partner_id
                
            similarity_response = await self._call_similarity_server(
                "/similarity/query-by-uuid/", data=payload
            )

            if similarity_response.get("status") == "success":
                raw_results = similarity_response.get("results", [])

                # Extract UUIDs from similarity server response
                track_uuids = [res.get("uuid") for res in raw_results if res.get("uuid")]

                # Get track details from database using UUIDs
                db_details_map = (
                    await self.similarity_repository.async_get_track_details_by_uuids(
                        db, track_uuids, partner_id=partner_id
                    )
                )

                # Enrich similarity results with database details
                enriched_similar_tracks = []
                track_ids = []  # For playlist creation
                track_scores = []  # For playlist scores

                for res_item in raw_results:
                    track_uuid = res_item.get("uuid")
                    if not track_uuid:
                        continue

                    details = db_details_map.get(track_uuid)
                    if details:
                        enriched_similar_tracks.append(
                            {
                                "rank": res_item.get("rank"),
                                "score": res_item.get("score"),
                                "id": details.get("id"),
                                "label": details.get("label"),
                                "duration": details.get("duration"),
                                "artist": details.get("artist"),
                                "title": details.get("title"),
                                "year": details.get("year"),
                                "type": details.get("type"),
                            }
                        )
                        # Collect track ID and score for playlist creation
                        track_ids.append(details.get("track_id"))
                        track_scores.append(res_item.get("score", 0.0))

                # Deduplicate tracks before returning
                target_count_after_deduplication = top_k - similarity_duplication_threshold
                if target_count_after_deduplication < 0:
                    target_count_after_deduplication = 0  # Ensure not negative

                # Apply response-level filtering to existing tracks before deduplication
                filtered_enriched_tracks = apply_response_filtering(enriched_similar_tracks)

                deduplicated_enriched_tracks = deduplicate_tracks(
                    filtered_enriched_tracks,
                    target_count_after_deduplication,
                    reference_track=queried_track_data,  # Use queried track for reference in deduplication
                    filter_title_func=filter_track_title,
                )

                # Get corresponding track IDs and scores for deduplicated tracks
                deduplicated_track_ids = []
                deduplicated_track_scores = []
                for track in deduplicated_enriched_tracks:
                    # Find the track_id and score for this track
                    for i, enriched_track in enumerate(filtered_enriched_tracks):
                        if enriched_track.get("id") == track.get("id"):
                            if i < len(track_ids):
                                deduplicated_track_ids.append(track_ids[i])
                                deduplicated_track_scores.append(
                                    track_scores[i] if i < len(track_scores) else 0.0
                                )
                            break

                # Create similarity playlist if we have tracks
                playlist_info = None
                if deduplicated_track_ids and queried_track_data:
                    # Get the queried track's database ID from its UUID
                    queried_track_uuid = queried_track_data.get("id")
                    if queried_track_uuid:
                        queried_track = await self.track_repository.async_get_by_uuid(
                            db, queried_track_uuid, partner_id=partner_id
                        )
                        if queried_track:
                            # Generate playlist name based on queried track details
                            playlist_name = generate_playlist_name_from_seed_track(
                                queried_track_data
                            )

                            playlist_info = await self.playlist_repository.async_create_similarity_playlist(
                                db=db,
                                seed_track_id=queried_track.id,
                                track_ids=deduplicated_track_ids,
                                track_scores=deduplicated_track_scores,
                                name=playlist_name,
                                playlist_type=PlaylistType.SIMILARITY,
                                user_id=user_id,
                                partner_id=partner_id,
                            )

                response_data = {
                    "queried_track": queried_track_data,
                    "similar_tracks": deduplicated_enriched_tracks,
                }

                # Add playlist info if created
                if playlist_info:
                    # Enrich playlist with engagement data
                    try:
                        from app.services.playlist_engagement_service import (
                            PlaylistEngagementService,
                        )

                        engagement_service = PlaylistEngagementService()
                        playlist_info = (
                            await engagement_service.enrich_playlist_with_engagement(
                                db, playlist_info, user_id
                            )
                        )
                    except Exception as e:
                        # If enrichment fails, ensure defaults are set
                        playlist_info.setdefault("is_favorite", False)
                        playlist_info.setdefault("is_following", False)
                        print(f"Error enriching playlist with engagement: {e}")
                    response_data["playlist"] = playlist_info

                # Apply filtering to queried track as well
                if response_data.get("queried_track"):
                    filtered_queried_tracks = apply_response_filtering(
                        [response_data["queried_track"]]
                    )
                    if filtered_queried_tracks:
                        response_data["queried_track"] = filtered_queried_tracks[0]

                # Increment usage counter if user is available
                if user_id:
                    try:
                        await OperationLimitRepository().async_increment_usage(
                            db, user_id=user_id, operation_code="playlist_create"
                        )
                        print(f"SIMILARITY BY PATH: Incremented usage for user_id={user_id}")
                    except Exception as inc_err:
                        print(f"SIMILARITY BY PATH: Failed to increment usage: {str(inc_err)}")

                await db.commit()

                if settings.demo_mode:
                    apply_demo_mode_redaction(response_data)

                return response_data
            elif similarity_response.get("status") == "not_found":
                # UUID not found on similarity server, but we might still have its duration from our DB.
                # Return success=True because the API call to main server was fine, but data reflects the finding.
                return {
                    "queried_track": queried_track_data,
                    "similar_tracks": [],
                    "message": similarity_response.get(
                        "message",
                        f"Track UUID '{queried_track_uuid}' not processed by similarity server.",
                    ),
                }
            else:
                # Error from similarity server
                error_message = similarity_response.get(
                    "message", "Unknown error from similarity server."
                )
                return {"success": False, "error": error_message}

        except Exception as e:
            await db.rollback()
            print(f"Error in similarity by path service: {e}")
            return {"success": False, "error": f"Database error or server error: {str(e)}"}

    async def _call_similarity_server(
        self, endpoint: str, data: Optional[Dict] = None, files: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Helper function to call the similarity server. Returns the JSON response directly or a structured error."""
        if not self.similarity_server_url:
            print("ERROR: SIMILARITY_SERVER_URL is not set in environment variables.")
            return {
                "status": "error",
                "message": "Similarity server URL not configured on main server.",
                "results": [],
            }

        target_url = f"{self.similarity_server_url.rstrip('/')}{endpoint}"
        print(f"Calling similarity server: {target_url} with data: {data}")

        async with httpx.AsyncClient(
            timeout=300.0, headers={"Origin": settings.resomix_server_url}
        ) as client:
            try:
                if files:
                    response = await client.post(target_url, files=files, data=data)
                else:
                    response = await client.post(target_url, json=data)

                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                print(
                    f"HTTP error calling similarity server {target_url}: {e.response.status_code} - {e.response.text}"
                )
                try:
                    error_data = e.response.json()
                    if "detail" in error_data:
                        return {
                            "status": "error",
                            "message": str(error_data["detail"]),
                            "results": [],
                        }
                    return {
                        "status": error_data.get("status", "error"),
                        "message": error_data.get(
                            "message",
                            f"Similarity service HTTP error: {e.response.status_code}",
                        ),
                        "results": error_data.get("results", []),
                    }
                except ValueError:
                    return {
                        "status": "error",
                        "message": f"Similarity service HTTP error: {e.response.status_code}. Non-JSON response: {e.response.text[:200]}",
                        "results": [],
                    }
            except httpx.RequestError as e:
                print(f"Request error calling similarity server {target_url}: {e}")
                return {
                    "status": "error",
                    "message": f"Could not connect to similarity service: {e}",
                    "results": [],
                }
            except Exception as e:
                print(f"Generic error calling similarity server {target_url}: {e}")
                return {
                    "status": "error",
                    "message": f"An unexpected error occurred: {e}",
                    "results": [],
                }

    # Convenience methods for different use cases
    async def find_similar_tracks_by_upload(
        self,
        db: AsyncSession,
        audio_bytes: bytes,
        filename: str,
        max_results: int = 10,
        engine: str = "E4",
    ) -> Dict[str, Any]:
        """
        Simplified method to find similar tracks by uploaded audio.

        Args:
            db: Database session
            audio_bytes: Audio file bytes
            filename: Original filename
            max_results: Maximum number of results
            engine: Similarity engine (E1-E6)

        Returns:
            Similarity results
        """
        # This is a convenience method for backward compatibility
        # Use a placeholder UUID since this method doesn't store in database
        import secrets

        placeholder_uuid = secrets.token_hex(12)

        return await self.calculate_similarity_for_upload(
            db=db,
            audio_bytes=audio_bytes,
            original_filename=filename,
            track_uuid=placeholder_uuid,
            top_k=max_results,
            similarity_duplication_threshold=0,
            engine=engine,
        )

    async def find_similar_tracks_by_file_path(
        self,
        db: AsyncSession,
        file_path: str,
        max_results: int = 10,
        engine: str = "E4",
    ) -> Dict[str, Any]:
        """
        Simplified method to find similar tracks by file path.

        Args:
            db: Database session
            file_path: Absolute file path
            max_results: Maximum number of results
            engine: Similarity engine (E1-E6)

        Returns:
            Similarity results
        """
        return await self.get_similarity_by_path(
            db=db,
            server_track_path=file_path,
            top_k=max_results,
            similarity_duplication_threshold=0,
            engine=engine,
        )

    async def get_track_by_uuid_with_similarity(
        self,
        db: AsyncSession,
        track_uuid: str,
        max_similar: int = 10,
        engine: str = "E4",
    ) -> Dict[str, Any]:
        """
        Get track details and find similar tracks by UUID.

        Args:
            db: Database session
            track_uuid: Track UUID
            max_similar: Maximum number of similar tracks
            engine: Similarity engine (E1-E6)

        Returns:
            Track details with similar tracks
        """
        try:
            # Verify track exists in database
            track = await self.track_repository.async_get_by_uuid(db, track_uuid)
            if not track:
                return {
                    "success": False,
                    "error": f"Track with UUID {track_uuid} not found",
                }

            # Get similar tracks using UUID-based endpoint
            # We still use get_similarity_by_path but pass the file_path - it will internally convert to UUID
            similarity_result = await self.get_similarity_by_path(
                db=db,
                server_track_path=track.file_path,
                top_k=max_similar,
                similarity_duplication_threshold=0,
                engine=engine,
            )

            return similarity_result

        except Exception as e:
            print(f"Error getting similarity for track UUID {track_uuid}: {e}")
            return {
                "success": False,
                "error": f"Error processing similarity request: {e}",
            }

    async def rebuild_faiss_indexes(
        self, partner_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Trigger a rebuild of FAISS indexes on the similarity server.

        Args:
            partner_id: Optional partner ID to rebuild specifically.

        Returns:
            Status of the rebuild request
        """
        payload = {}
        if partner_id is not None:
            payload["partner_id"] = partner_id

        return await self._call_similarity_server(
            "/admin/similarity/rebuild-index/", data=payload
        )
