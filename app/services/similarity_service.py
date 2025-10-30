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
import re
import asyncio
import json
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import asyncio
import io
from mutagen import File as MutagenFile, MutagenError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.repositories.track_repository import TrackRepository
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.similarity_repository import SimilarityRepository
from app.services.similarity_segment import SimilaritySegmentService
from app.core.config import settings
from app.services.metadata_service import MetadataService
from app.utils.similarity_utils import (
    get_duration_from_bytes_sync,
    normalize_artist_name,
    deduplicate_tracks,
    execute_playlist_peaks_request,
    send_playlist_peaks_request,
    generate_playlist_name_from_seed_track
)
from app.utils.similarity_filters import (
    filter_track_title,
    apply_response_filtering
)
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
        self.similarity_segment_service = SimilaritySegmentService(self.similarity_server_url)
        self.path_prefix_to_remove = "/home/usman/data/"  # Ensured this is the exact prefix.

    async def calculate_similarity_for_upload(
        self, 
        db: AsyncSession,
        audio_bytes: bytes, 
        original_filename: str, 
        track_uuid: str,
        top_k: int = 10, 
        similarity_duplication_threshold: int = 0,
        user_id: Optional[int] = None
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
            
        Returns:
            Dictionary containing similarity results or error information
        """
        if not audio_bytes:
            return {"success": False, "error": "Audio data is empty for similarity processing."}

        # Concurrently get duration and call similarity server
        duration_task = asyncio.to_thread(get_duration_from_bytes_sync, audio_bytes)

        # Use secure filename instead of original filename for security
        secure_filename = f"upload_{track_uuid}.tmp"
        files_data = {"file": (secure_filename, audio_bytes, "application/octet-stream")}
        request_data = {"top_k": top_k, "track_uuid": track_uuid}
        similarity_response_task = self._call_similarity_server("/similarity/query-by-upload/", data=request_data, files=files_data)

        # Await both tasks
        calculated_duration, similarity_response = await asyncio.gather(
            duration_task,
            similarity_response_task
        )

        # Check the status from the similarity server's response
        if similarity_response.get("status") == "success":
            raw_results = similarity_response.get("results", [])
            server_duration = similarity_response.get("duration")
            
            # Convert server paths to clean paths for database lookup
            abs_paths_from_server = [res.get("path") for res in raw_results if res.get("path")]
            clean_paths = []
            for abs_path in abs_paths_from_server:
                if abs_path.startswith(self.path_prefix_to_remove):
                    clean_path = abs_path[len(self.path_prefix_to_remove):]
                    clean_paths.append(clean_path)
                else:
                    clean_paths.append(abs_path)
            
            # Get track details from database
            db_details_map = await self.similarity_repository.async_get_track_details_by_paths(db, clean_paths)
            
            # Enrich similarity results with database details
            enriched_similar_tracks = []
            track_ids = []  # For playlist creation
            track_scores = []  # For playlist scores
            
            for res_item in raw_results:
                abs_path = res_item.get("path")
                if not abs_path: 
                    continue

                # Convert to clean path for database lookup
                clean_path = abs_path[len(self.path_prefix_to_remove):] if abs_path.startswith(self.path_prefix_to_remove) else abs_path
                
                details = db_details_map.get(clean_path)
                if details:
                    enriched_similar_tracks.append({
                        "rank": res_item.get("rank"),
                        "score": res_item.get("score"),
                        "id": details.get("id"),
                        "label": details.get("label"),
                        "duration": details.get("duration"),
                        "artist": details.get("artist"),
                        "title": details.get("title"),
                        "year": details.get("year")
                    })
                    # Collect track ID and score for playlist creation
                    track_ids.append(details.get("track_id"))
                    track_scores.append(res_item.get("score", 0.0))
                # else: track details not found in DB for this path, so it's omitted from results

            # Deduplicate tracks before returning
            target_count_after_deduplication = top_k - similarity_duplication_threshold
            if target_count_after_deduplication < 0: 
                target_count_after_deduplication = 0  # Ensure not negative
            
            # Apply response-level filtering to existing tracks before deduplication
            filtered_enriched_tracks = apply_response_filtering(enriched_similar_tracks)
            
            # NEW: Fetch uploaded track details to use as reference track and update duration
            try:
                uploaded_track_details = await self.similarity_repository.async_get_reference_track_details_by_uuid(db, track_uuid)
            except Exception as e:
                print(f"Error fetching uploaded track details: {e}")
                return {"success": False, "error": "Failed to retrieve uploaded track details"}
            
            if not uploaded_track_details:
                print(f"Warning: Could not fetch details for uploaded track {track_uuid}")
                return {"success": False, "error": "Could not retrieve uploaded track details"}
            
            final_duration = server_duration if server_duration is not None and server_duration > 0 else (calculated_duration if calculated_duration is not None and calculated_duration > 0 else None)
            uploaded_track_details["duration"] = final_duration
            if final_duration is not None and final_duration > 0:
                try:
                    await self.similarity_repository.async_update_track_duration(db, track_uuid, final_duration)
                    print(f"Updated track {track_uuid} duration to {final_duration} seconds")
                except Exception as e:
                    print(f"Warning: Could not update track duration in database: {e}")
            
            deduplicated_enriched_tracks = deduplicate_tracks(
                filtered_enriched_tracks, 
                target_count_after_deduplication,
                reference_track=uploaded_track_details,  # Passing reference track for upload similarity
                filter_title_func=filter_track_title
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
                            deduplicated_track_scores.append(track_scores[i] if i < len(track_scores) else 0.0)
                        break
            
            # Create similarity playlist if we have tracks
            playlist_info = None
            if deduplicated_track_ids:
                try:
                    # Get the uploaded track's database ID
                    uploaded_track = await self.track_repository.async_get_by_uuid(db, track_uuid)
                    if uploaded_track:
                        # Generate playlist name based on uploaded track details
                        playlist_name = generate_playlist_name_from_seed_track(uploaded_track_details)
                        
                        playlist_info = await self.playlist_repository.async_create_similarity_playlist(
                              db=db,
                              seed_track_id=uploaded_track.id,
                              track_ids=deduplicated_track_ids,
                              track_scores=deduplicated_track_scores,
                              name=playlist_name,
                              playlist_type=PlaylistType.SIMILARITY,
                              user_id=user_id
                        )
                        
                        # Send playlist peaks request (fire and forget)
                        # if playlist_info:
                        #     await send_playlist_peaks_request(self.similarity_server_url, track_uuid, deduplicated_enriched_tracks)
                except Exception as e:
                    print(f"Error creating playlist for upload similarity: {e}")
            
            # Format response like similarity by ID
            response_data = {
                "queried_track": uploaded_track_details,
                "similar_tracks": deduplicated_enriched_tracks
            }
            
            # Add playlist info if created
            if playlist_info:
                response_data["playlist"] = playlist_info
            
            # Apply filtering to queried track as well
            if response_data.get("queried_track"):
                filtered_queried_tracks = apply_response_filtering([response_data["queried_track"]])
                if filtered_queried_tracks:
                    response_data["queried_track"] = filtered_queried_tracks[0]
            
            # TEMPORARY FEATURE: Handle segment preview workflow (after step 8)
            # if playlist_info and len(deduplicated_enriched_tracks) > 0:
            #     # Collect all UUIDs: queried track first, then similar tracks
            #     all_uuids = [uploaded_track_details.get("id")]  # Reference track first
            #     all_uuids.extend([track.get("id") for track in deduplicated_enriched_tracks if track.get("id")])
            #     all_uuids = [uuid for uuid in all_uuids if uuid]  # Remove any None values
                
            #     if all_uuids:
            #         # Launch segment preview in background and return immediately
            #         asyncio.create_task(self.similarity_segment_service.handle_segment_preview_workflow(all_uuids, playlist_info.get("id", "unknown"), deduplicated_enriched_tracks))
            
            return response_data
        else:
            # Error reported by the similarity server or connection issue handled by _call_similarity_server
            error_message = similarity_response.get("message", "Unknown error during similarity processing.")
            return {"success": False, "error": error_message}

    async def get_similarity_by_path(
        self, 
        db: AsyncSession,
        server_track_path: str, 
        top_k: int = 10, 
        similarity_duplication_threshold: int = 0,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Gets similar tracks for a given server-side file path by calling the similarity server.
        
        Args:
            db: Database session
            server_track_path: The file path to the track file (without /home/usman/data/ prefix)
            top_k: Number of similar tracks to request from similarity server
            similarity_duplication_threshold: The threshold for removing duplicates before returning
            user_id: Optional user ID (internal BIGINT) to associate playlist with logged-in user
            
        Returns:
            Dictionary containing similarity results or error information
        """
        queried_track_data: Optional[Dict[str, Any]] = None
        try:
            queried_track_data = await self.similarity_repository.async_get_reference_track_details_by_path(db, server_track_path)
            if not queried_track_data:
                print(f"Warning: Details for queried path '{server_track_path}' not found in local DB.")
        except Exception as e:
            print(f"Error fetching details for queried path '{server_track_path}' from DB: {e}")

        payload = {"file_path": server_track_path, "top_k": top_k}
        similarity_response = await self._call_similarity_server("/similarity/query-by-path/", data=payload)

        if similarity_response.get("status") == "success":
            raw_results = similarity_response.get("results", [])
            
            # Convert server paths to clean paths for database lookup
            abs_paths_from_server = [res.get("path") for res in raw_results if res.get("path")]
            clean_paths = []
            for abs_path in abs_paths_from_server:
                if abs_path.startswith(self.path_prefix_to_remove):
                    clean_path = abs_path[len(self.path_prefix_to_remove):]
                    clean_paths.append(clean_path)
                else:
                    clean_paths.append(abs_path)
            
            # Get track details from database
            db_details_map = await self.similarity_repository.async_get_track_details_by_paths(db, clean_paths)
            
            # Enrich similarity results with database details
            enriched_similar_tracks = []
            track_ids = []  # For playlist creation
            track_scores = []  # For playlist scores
            
            for res_item in raw_results:
                abs_path = res_item.get("path")
                if not abs_path: 
                    continue

                # Convert to clean path for database lookup
                clean_path = abs_path[len(self.path_prefix_to_remove):] if abs_path.startswith(self.path_prefix_to_remove) else abs_path
                
                details = db_details_map.get(clean_path)
                if details:
                    enriched_similar_tracks.append({
                        "rank": res_item.get("rank"),
                        "score": res_item.get("score"),
                        "id": details.get("id"),
                        "label": details.get("label"),
                        "duration": details.get("duration"),
                        "artist": details.get("artist"),
                        "title": details.get("title"),
                        "year": details.get("year")
                    })
                    # Collect track ID and score for playlist creation
                    track_ids.append(details.get("track_id"))
                    track_scores.append(res_item.get("score", 0.0))
                # else: track details not found in DB for this path, so it's omitted from results

            # Deduplicate tracks before returning
            # The target count should be the original requested amount (top_k - threshold)
            target_count_after_deduplication = top_k - similarity_duplication_threshold
            if target_count_after_deduplication < 0: 
                target_count_after_deduplication = 0  # Ensure not negative
            
            # Apply response-level filtering to existing tracks before deduplication
            filtered_enriched_tracks = apply_response_filtering(enriched_similar_tracks)
            
            deduplicated_enriched_tracks = deduplicate_tracks(
                filtered_enriched_tracks, 
                target_count_after_deduplication,
                reference_track=queried_track_data,  # Use queried track for reference in deduplication
                filter_title_func=filter_track_title
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
                            deduplicated_track_scores.append(track_scores[i] if i < len(track_scores) else 0.0)
                        break

            # Create similarity playlist if we have tracks
            playlist_info = None
            if deduplicated_track_ids and queried_track_data:
                try:
                    # Get the queried track's database ID from its UUID
                    queried_track_uuid = queried_track_data.get("id")
                    if queried_track_uuid:
                        queried_track = await self.track_repository.async_get_by_uuid(db, queried_track_uuid)
                        if queried_track:
                            # Generate playlist name based on queried track details
                            playlist_name = generate_playlist_name_from_seed_track(queried_track_data)
                            
                            playlist_info = await self.playlist_repository.async_create_similarity_playlist(
                                db=db,
                                seed_track_id=queried_track.id,
                                track_ids=deduplicated_track_ids,
                                track_scores=deduplicated_track_scores,
                                name=playlist_name,
                                playlist_type=PlaylistType.SIMILARITY,
                                user_id=user_id
                            )
                            
                            # Send playlist peaks request (fire and forget) - COMMENTED OUT
                            # if playlist_info:
                            #     await send_playlist_peaks_request(self.similarity_server_url, queried_track_uuid, deduplicated_enriched_tracks)
                                
                except Exception as e:
                    print(f"Error creating playlist for path similarity: {e}")
                    # Don't fail the whole request if playlist creation fails

            response_data = {
                "queried_track": queried_track_data, 
                "similar_tracks": deduplicated_enriched_tracks
            }
            
            # Add playlist info if created
            if playlist_info:
                response_data["playlist"] = playlist_info
            
            # Apply filtering to queried track as well
            if response_data.get("queried_track"):
                filtered_queried_tracks = apply_response_filtering([response_data["queried_track"]])
                if filtered_queried_tracks:
                    response_data["queried_track"] = filtered_queried_tracks[0]
            
            # TEMPORARY FEATURE: Handle segment preview workflow (after step 8)
            # if playlist_info and len(deduplicated_enriched_tracks) > 0:
            #     # Collect all UUIDs: queried track first, then similar tracks
            #     all_uuids = [queried_track_data.get("id")]  # Reference track first
            #     all_uuids.extend([track.get("id") for track in deduplicated_enriched_tracks if track.get("id")])
            #     all_uuids = [uuid for uuid in all_uuids if uuid]  # Remove any None values
                
            #     if all_uuids:
            #         # Launch segment workflow in background
            #         asyncio.create_task(self.similarity_segment_service.handle_segment_preview_workflow(all_uuids, playlist_info.get("id", "unknown"), deduplicated_enriched_tracks))
            
            return response_data
        elif similarity_response.get("status") == "not_found":
            # Path not found on similarity server, but we might still have its duration from our DB.
            # Return success=True because the API call to main server was fine, but data reflects the finding.
            return {
                "queried_track": queried_track_data,
                "similar_tracks": [],
                "message": similarity_response.get("message", f"Track '{server_track_path}' not processed by similarity server.")
            }
        else:
            # Error from similarity server
            error_message = similarity_response.get("message", "Unknown error from similarity server.")
            return {"success": False, "error": error_message}


    async def _call_similarity_server(self, endpoint: str, data: Optional[Dict] = None, files: Optional[Dict] = None) -> Dict[str, Any]:
        """Helper function to call the similarity server. Returns the JSON response directly or a structured error."""
        if not self.similarity_server_url:
            print("ERROR: SIMILARITY_SERVER_URL is not set in environment variables.")
            return {"status": "error", "message": "Similarity server URL not configured on main server.", "results": []}

        target_url = f"{self.similarity_server_url.rstrip('/')}{endpoint}"
        print(f"Calling similarity server: {target_url} with data: {data}")

        async with httpx.AsyncClient(timeout=300.0, headers={"Origin": "https://bserver.resomix.com"}) as client:
            try:
                if files:
                    response = await client.post(target_url, files=files, data=data)
                else:
                    response = await client.post(target_url, json=data)
                
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                print(f"HTTP error calling similarity server {target_url}: {e.response.status_code} - {e.response.text}")
                try:
                    error_data = e.response.json()
                    if "detail" in error_data:
                        return {"status": "error", "message": str(error_data["detail"]), "results": []}
                    return {
                        "status": error_data.get("status", "error"), 
                        "message": error_data.get("message", f"Similarity service HTTP error: {e.response.status_code}"), 
                        "results": error_data.get("results", [])
                    }
                except ValueError:
                    return {"status": "error", "message": f"Similarity service HTTP error: {e.response.status_code}. Non-JSON response: {e.response.text[:200]}", "results": []}
            except httpx.RequestError as e:
                print(f"Request error calling similarity server {target_url}: {e}")
                return {"status": "error", "message": f"Could not connect to similarity service: {e}", "results": []}
            except Exception as e:
                print(f"Generic error calling similarity server {target_url}: {e}")
                return {"status": "error", "message": f"An unexpected error occurred: {e}", "results": []}

    # Convenience methods for different use cases
    async def find_similar_tracks_by_upload(
        self, 
        db: AsyncSession,
        audio_bytes: bytes, 
        filename: str, 
        max_results: int = 10
    ) -> Dict[str, Any]:
        """
        Simplified method to find similar tracks by uploaded audio.
        
        Args:
            db: Database session
            audio_bytes: Audio file bytes
            filename: Original filename
            max_results: Maximum number of results
            
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
            similarity_duplication_threshold=0
        )

    async def find_similar_tracks_by_file_path(
        self, 
        db: AsyncSession,
        file_path: str, 
        max_results: int = 10
    ) -> Dict[str, Any]:
        """
        Simplified method to find similar tracks by file path.
        
        Args:
            db: Database session
            file_path: Absolute file path
            max_results: Maximum number of results
            
        Returns:
            Similarity results
        """
        return await self.get_similarity_by_path(
            db=db,
            server_track_path=file_path,
            top_k=max_results,
            similarity_duplication_threshold=0
        )

    async def get_track_by_uuid_with_similarity(
        self, 
        db: AsyncSession,
        track_uuid: str, 
        max_similar: int = 10
    ) -> Dict[str, Any]:
        """
        Get track details and find similar tracks by UUID.
        
        Args:
            db: Database session
            track_uuid: Track UUID
            max_similar: Maximum number of similar tracks
            
        Returns:
            Track details with similar tracks
        """
        try:
            # Get track file path by UUID
            track_path = await self.track_repository.async_get_track_path_by_uuid(db, track_uuid)
            if not track_path:
                return {"success": False, "error": f"Track with UUID {track_uuid} not found"}
            
            # Convert relative path to absolute path for similarity server
            abs_path = self.path_prefix_to_remove + track_path if not track_path.startswith(self.path_prefix_to_remove) else track_path
            
            # Get similar tracks
            similarity_result = await self.get_similarity_by_path(
                db=db,
                server_track_path=abs_path,
                top_k=max_similar,
                similarity_duplication_threshold=0
            )
            
            return similarity_result
            
        except Exception as e:
            print(f"Error getting similarity for track UUID {track_uuid}: {e}")
            return {"success": False, "error": f"Error processing similarity request: {e}"}
