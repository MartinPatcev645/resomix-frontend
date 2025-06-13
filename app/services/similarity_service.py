"""
Similarity Service
==================

This service provides functionality for calculating audio similarity by interacting with a dedicated similarity microservice.
It handles similarity calculations for uploaded audio files and server-side file paths,
with database integration using MariaDB repositories instead of MongoDB.

Moved from: src/similarity.py
Updated: Database calls to use MariaDB repositories instead of MongoDB
Version: 1.0.0
Date: May 6, 2025
"""

import os
import httpx
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import re
import asyncio
import io
from mutagen import File as MutagenFile, MutagenError
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.repositories.track_repository import TrackRepository
from app.models.track import Track, TrackArtist
from app.models.artist import Artist
from app.models.album import Album

load_dotenv()


class SimilarityService:
    """
    Service for calculating audio similarity using external similarity microservice.
    """
    
    def __init__(self):
        """Initialize similarity service."""
        self.track_repository = TrackRepository()
        self.similarity_server_url = os.getenv("SIMILARITY_SERVER_URL")
        self.path_prefix_to_remove = "/home/usman/data/"  # Ensured this is the exact prefix.

    async def calculate_similarity_for_upload(
        self, 
        db: AsyncSession,
        audio_bytes: bytes, 
        original_filename: str, 
        top_k: int = 10, 
        similarity_duplication_threshold: int = 0
    ) -> Dict[str, Any]:
        """
        Sends uploaded audio bytes to the similarity server and returns enriched similar tracks.
        
        Args:
            db: Database session
            audio_bytes: The raw bytes of the audio file
            original_filename: The original filename, used for context/logging and passed to server
            top_k: Number of similar tracks to request from similarity server
            similarity_duplication_threshold: The threshold for removing duplicates before returning
            
        Returns:
            Dictionary containing similarity results or error information
        """
        if not audio_bytes:
            return {"success": False, "error": "Audio data is empty for similarity processing."}

        # Concurrently get duration and call similarity server
        duration_task = asyncio.to_thread(self._get_duration_from_bytes_sync, audio_bytes)

        files_data = {"file": (original_filename, audio_bytes, "application/octet-stream")}
        request_data = {"top_k": top_k}
        similarity_response_task = self._call_similarity_server("/query-by-upload/", data=request_data, files=files_data)

        # Await both tasks
        calculated_duration, similarity_response = await asyncio.gather(
            duration_task,
            similarity_response_task
        )

        # Check the status from the similarity server's response
        if similarity_response.get("status") == "success":
            raw_results = similarity_response.get("results", [])
            abs_paths_from_server = [res.get("path") for res in raw_results if res.get("path")]
            
            db_details_map = {}
            if abs_paths_from_server:
                db_details_map = await self._fetch_track_details_from_db_by_path(db, abs_paths_from_server)

            enriched_similar_tracks = []
            for res_item in raw_results:
                abs_path = res_item.get("path")
                if not abs_path: 
                    continue

                relative_path = ""
                if abs_path.startswith(self.path_prefix_to_remove):
                    relative_path = abs_path[len(self.path_prefix_to_remove):]
                else:
                    relative_path = abs_path  # Should have prefix
                
                details = db_details_map.get(relative_path)
                if details:
                    enriched_similar_tracks.append({
                        "rank": res_item.get("rank"),
                        "score": res_item.get("score"),
                        "id": details.get("id"),
                        "filename": details.get("filename"),
                        "album": details.get("album"),
                        "duration": details.get("duration"),
                        "artist": details.get("artist")
                    })
                # else: track details not found in DB for this path, so it's omitted from results

            # Deduplicate tracks before returning
            # The target count should be the original requested amount (top_k - threshold)
            target_count_after_deduplication = top_k - similarity_duplication_threshold
            if target_count_after_deduplication < 0: 
                target_count_after_deduplication = 0  # Ensure not negative
            deduplicated_enriched_tracks = self._deduplicate_tracks(enriched_similar_tracks, target_count_after_deduplication)

            # Use the locally calculated duration
            final_duration = calculated_duration if calculated_duration is not None else 0  # Default to 0 if None

            return {
                "original_filename": original_filename,
                "duration": final_duration, 
                "similar_tracks": deduplicated_enriched_tracks
            }
        else:
            # Error reported by the similarity server or connection issue handled by _call_similarity_server
            error_message = similarity_response.get("message", "Unknown error during similarity processing.")
            return {"success": False, "error": error_message}

    async def get_similarity_by_path(
        self, 
        db: AsyncSession,
        server_track_path: str, 
        top_k: int = 10, 
        similarity_duplication_threshold: int = 0
    ) -> Dict[str, Any]:
        """
        Gets similar tracks for a given server-side file path by calling the similarity server.
        
        Args:
            db: Database session
            server_track_path: The absolute path to the track file on the server
            top_k: Number of similar tracks to request from similarity server
            similarity_duplication_threshold: The threshold for removing duplicates before returning
            
        Returns:
            Dictionary containing similarity results or error information
        """
        queried_track_data: Optional[Dict[str, Any]] = None
        try:
            details_map_for_queried_track = await self._fetch_track_details_from_db_by_path(db, [server_track_path])
            queried_track_data = details_map_for_queried_track.get(server_track_path)
            if not queried_track_data:
                print(f"Warning: Details for queried path '{server_track_path}' not found in local DB.")
        except Exception as e:
            print(f"Error fetching details for queried path '{server_track_path}' from DB: {e}")

        payload = {"file_path": server_track_path, "top_k": top_k}
        similarity_response = await self._call_similarity_server("/query-by-path/", data=payload)

        if similarity_response.get("status") == "success":
            raw_results = similarity_response.get("results", [])
            abs_paths_from_server = [res.get("path") for res in raw_results if res.get("path")]

            db_details_map = {}
            if abs_paths_from_server:
                db_details_map = await self._fetch_track_details_from_db_by_path(db, abs_paths_from_server)

            enriched_similar_tracks = []
            for res_item in raw_results:
                abs_path = res_item.get("path")
                if not abs_path or abs_path == server_track_path: 
                    continue  # Exclude queried track
                
                # Use path as-is since it's already in correct format
                details = db_details_map.get(abs_path)
                if details:
                    enriched_similar_tracks.append({
                        "rank": res_item.get("rank"),
                        "score": res_item.get("score"),
                        "id": details.get("id"),
                        "filename": details.get("filename"),
                        "album": details.get("album"),
                        "duration": details.get("duration"),
                        "artist": details.get("artist")
                    })
                # else: track details not found in DB for this path, so it's omitted
            
            # Deduplicate tracks before returning
            # The target count should be the original requested amount (top_k - threshold)
            target_count_after_deduplication = top_k - similarity_duplication_threshold
            if target_count_after_deduplication < 0: 
                target_count_after_deduplication = 0  # Ensure not negative
            deduplicated_enriched_tracks = self._deduplicate_tracks(enriched_similar_tracks, target_count_after_deduplication)

            return {
                "queried_track": queried_track_data, 
                "similar_tracks": deduplicated_enriched_tracks
            }
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

    async def _fetch_track_details_from_db_by_path(self, db: AsyncSession, track_paths_from_similarity_server: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Fetches full track details from MariaDB based on a list of file paths 
        returned by the similarity server.

        Args:
            db: Database session
            track_paths_from_similarity_server: A list of file paths 
                                                (e.g., veggera/public_html/audio.mp3).
            
        Returns:
            A dictionary mapping file_path to track_details_dict.
            Track_details_dict contains: id, filename, album, duration, artist.
        """
        if not track_paths_from_similarity_server:
            return {}

        # Use paths as-is since they're already in the correct format
        paths_to_query = set(track_paths_from_similarity_server)
        
        if not paths_to_query:
            return {}

        details_map: Dict[str, Dict[str, Any]] = {}
        try:
            # Query tracks by file paths using MariaDB
            stmt = (
                select(Track)
                .options(
                    # Load relationships for complete track data
                    joinedload(Track.album),
                    joinedload(Track.track_artists).joinedload(TrackArtist.artist)
                )
                .where(Track.file_path.in_(list(paths_to_query)))
            )
            result = await db.execute(stmt)
            # Use unique() to deduplicate rows when using joinedload with collections
            tracks = result.scalars().unique().all()
            
            for track in tracks:
                # Get primary artist (first artist in track_artists)
                artist_name = "N/A"
                if track.track_artists:
                    artist_name = track.track_artists[0].artist.name
                
                # Extract filename from file_path
                filename = track.file_path.split('/')[-1] if track.file_path else "N/A"
                
                # Get album name
                album_name = track.album.title if track.album else "N/A"
                
                track_data = {
                    "id": track.uuid,  # Use UUID for compatibility with existing API
                    "filename": filename,
                    "album": album_name,
                    "duration": track.duration_sec or 0,
                    "artist": artist_name
                }
                details_map[track.file_path] = track_data
            
            print(f"MariaDB: Fetched details for {len(details_map)} out of {len(paths_to_query)} unique paths.")
            
        except Exception as e:
            print(f"Error during MariaDB fetch for track details: {e}")
            return {} 
            
        return details_map

    def _get_duration_from_bytes_sync(self, audio_bytes: bytes) -> Optional[int]:
        """Calculates the duration of audio from bytes using mutagen."""
        try:
            file_like_object = io.BytesIO(audio_bytes)
            audio = MutagenFile(file_like_object)
            if audio and audio.info and hasattr(audio.info, 'length') and audio.info.length is not None:
                return int(round(audio.info.length))
        except MutagenError:
            print("MutagenError: Could not load audio from bytes to get duration.")
        except Exception as e:
            print(f"Error getting duration from bytes: {e}")
        return None  # Return None if duration can't be determined

    def _deduplicate_tracks(self, tracks: List[Dict[str, Any]], target_count: int) -> List[Dict[str, Any]]:
        """
        Removes duplicate tracks based on filename and duration, sorts by score,
        re-ranks, and then returns up to target_count tracks.
        """
        seen_tracks = set()
        deduplicated_list = []
        for track in tracks:
            filename_full = track.get("filename", "")
            # Remove extension from filename for the key
            filename_base, file_extension = os.path.splitext(filename_full)
            duration = track.get("duration", -1)
            track_key = (filename_base.lower().strip(), duration)  # Use lowercased base filename
            
            if track_key not in seen_tracks:
                deduplicated_list.append(track)
                seen_tracks.add(track_key)
        
        # Sort by score in descending order (higher score is better)
        # Ensure score exists and is a number, default to 0 or a very low number if missing/invalid
        deduplicated_list.sort(key=lambda x: float(x.get("score", 0)) if isinstance(x.get("score"), (int, float, str)) and str(x.get("score")).replace('.', '', 1).isdigit() else 0, reverse=True)
        
        # Re-rank the sorted list
        reranked_list = []
        for i, track_item in enumerate(deduplicated_list):
            track_item["rank"] = i + 1
            reranked_list.append(track_item)
            
        # Return up to target_count tracks
        return reranked_list[:target_count]

    async def _call_similarity_server(self, endpoint: str, data: Optional[Dict] = None, files: Optional[Dict] = None) -> Dict[str, Any]:
        """Helper function to call the similarity server. Returns the JSON response directly or a structured error."""
        if not self.similarity_server_url:
            print("ERROR: SIMILARITY_SERVER_URL is not set in environment variables.")
            return {"status": "error", "message": "Similarity server URL not configured on main server.", "results": []}

        target_url = f"{self.similarity_server_url.rstrip('/')}{endpoint}"
        print(f"Calling similarity server: {target_url} with data: {data}")

        async with httpx.AsyncClient(timeout=60.0) as client:
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
        return await self.calculate_similarity_for_upload(
            db=db,
            audio_bytes=audio_bytes,
            original_filename=filename,
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