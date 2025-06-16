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
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import asyncio
import io
from mutagen import File as MutagenFile, MutagenError
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.track_repository import TrackRepository
from app.core.config import settings

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
        similarity_response_task = self._call_similarity_server("/similarity/query-by-upload/", data=request_data, files=files_data)

        # Await both tasks
        calculated_duration, similarity_response = await asyncio.gather(
            duration_task,
            similarity_response_task
        )

        # Check the status from the similarity server's response
        if similarity_response.get("status") == "success":
            raw_results = similarity_response.get("results", [])
            # Get paths from similarity server response (these may have /home/usman/data/ prefix)
            abs_paths_from_server = [res.get("path") for res in raw_results if res.get("path")]
            
            # Convert similarity server paths to clean paths for database lookup
            clean_paths_for_db = []
            for abs_path in abs_paths_from_server:
                if abs_path.startswith(self.path_prefix_to_remove):
                    clean_path = abs_path[len(self.path_prefix_to_remove):]
                    clean_paths_for_db.append(clean_path)
                else:
                    # Path already clean
                    clean_paths_for_db.append(abs_path)
            
            db_details_map = {}
            if clean_paths_for_db:
                db_details_map = await self._fetch_track_details_from_db_by_path(db, clean_paths_for_db)

            enriched_similar_tracks = []
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
                # else: track details not found in DB for this path, so it's omitted from results

            # Deduplicate tracks before returning
            # The target count should be the original requested amount (top_k - threshold)
            target_count_after_deduplication = top_k - similarity_duplication_threshold
            if target_count_after_deduplication < 0: 
                target_count_after_deduplication = 0  # Ensure not negative
            deduplicated_enriched_tracks = self._deduplicate_tracks(
                enriched_similar_tracks, 
                target_count_after_deduplication,
                reference_track=None  # No reference track for upload similarity
            )

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
            server_track_path: The file path to the track file (without /home/usman/data/ prefix)
            top_k: Number of similar tracks to request from similarity server
            similarity_duplication_threshold: The threshold for removing duplicates before returning
            
        Returns:
            Dictionary containing similarity results or error information
        """
        queried_track_data: Optional[Dict[str, Any]] = None
        try:
            queried_track_data = await self._fetch_reference_track_details_from_db_by_path(db, server_track_path)
            if not queried_track_data:
                print(f"Warning: Details for queried path '{server_track_path}' not found in local DB.")
        except Exception as e:
            print(f"Error fetching details for queried path '{server_track_path}' from DB: {e}")

        payload = {"file_path": server_track_path, "top_k": top_k}
        similarity_response = await self._call_similarity_server("/similarity/query-by-path/", data=payload)

        if similarity_response.get("status") == "success":
            raw_results = similarity_response.get("results", [])
            # Get paths from similarity server response (these may have /home/usman/data/ prefix)
            abs_paths_from_server = [res.get("path") for res in raw_results if res.get("path")]

            # Convert similarity server paths to clean paths for database lookup
            clean_paths_for_db = []
            for abs_path in abs_paths_from_server:
                if abs_path.startswith(self.path_prefix_to_remove):
                    clean_path = abs_path[len(self.path_prefix_to_remove):]
                    clean_paths_for_db.append(clean_path)
                else:
                    # Path already clean
                    clean_paths_for_db.append(abs_path)

            db_details_map = {}
            if clean_paths_for_db:
                db_details_map = await self._fetch_track_details_from_db_by_path(db, clean_paths_for_db)

            enriched_similar_tracks = []
            for res_item in raw_results:
                abs_path = res_item.get("path")
                if not abs_path: 
                    continue
                
                # Convert to clean path for database lookup
                clean_path = abs_path[len(self.path_prefix_to_remove):] if abs_path.startswith(self.path_prefix_to_remove) else abs_path
                
                # Skip if this is the same as the queried track
                if clean_path == server_track_path:
                    continue
                
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
                # else: track details not found in DB for this path, so it's omitted
            
            # Deduplicate tracks before returning
            # The target count should be the original requested amount (top_k - threshold)
            target_count_after_deduplication = top_k - similarity_duplication_threshold
            if target_count_after_deduplication < 0: 
                target_count_after_deduplication = 0  # Ensure not negative
            deduplicated_enriched_tracks = self._deduplicate_tracks(
                enriched_similar_tracks, 
                target_count_after_deduplication,
                reference_track=queried_track_data  # Pass reference track to exclude it from results
            )

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

    async def _fetch_reference_track_details_from_db_by_path(self, db: AsyncSession, track_path: str) -> Optional[Dict[str, Any]]:
        """
        Fetches full track details including album, label, and genre from MariaDB for a reference track.

        Args:
            db: Database session
            track_path: File path of the track
            
        Returns:
            Dictionary containing reference track details with all fields including all_artists, or None if not found
        """
        if not track_path:
            return None

        try:
            # Query track by file path using MariaDB repository
            tracks = await self.track_repository.async_get_tracks_by_file_paths(db, [track_path])
            
            if not tracks:
                return None
                
            track = tracks[0]  # Get the first (and should be only) track
            
            # Get primary artist (first artist in track_artists) for backward compatibility
            artist_name = "N/A"
            all_artists = []
            
            if track.track_artists:
                artist_name = track.track_artists[0].artist.name
                # Collect all artists for deduplication purposes
                all_artists = [ta.artist.name for ta in track.track_artists]
            
            # Extract filename from file_path
            filename = track.file_path.split('/')[-1] if track.file_path else "N/A"
            
            # Get album name
            album_name = track.album.title if track.album else "N/A"
            
            # Get label name
            label_name = track.label.name if track.label else "N/A"
            
            # Get genre name
            genre_name = track.genre.name if track.genre else "N/A"
            
            reference_track_data = {
                "id": track.uuid,  # Use UUID for compatibility with existing API
                "album": album_name,
                "label": label_name,
                "genre": genre_name,
                "duration": track.duration_sec or 0,
                "artist": artist_name,  # Primary artist for display
                "all_artists": all_artists  # All artists for deduplication
            }
            
            return reference_track_data
            
        except Exception as e:
            print(f"Error during MariaDB fetch for reference track details: {e}")
            return None

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
            Track_details_dict contains: id, filename, album, duration, artist, all_artists.
        """
        if not track_paths_from_similarity_server:
            return {}

        # Use paths as-is since they're already in the correct format
        paths_to_query = set(track_paths_from_similarity_server)
        
        if not paths_to_query:
            return {}

        details_map: Dict[str, Dict[str, Any]] = {}
        try:
            # Query tracks by file paths using MariaDB repository
            tracks = await self.track_repository.async_get_tracks_by_file_paths(db, list(paths_to_query))
            
            for track in tracks:
                # Get primary artist (first artist in track_artists) for backward compatibility
                artist_name = "N/A"
                all_artists = []
                
                if track.track_artists:
                    artist_name = track.track_artists[0].artist.name
                    # Collect all artists for deduplication purposes
                    all_artists = [ta.artist.name for ta in track.track_artists]
                
                # Extract filename from file_path
                filename = track.file_path.split('/')[-1] if track.file_path else "N/A"
                
                # Get album name
                album_name = track.album.title if track.album else "N/A"
                
                # Get label name
                label_name = track.label.name if track.label else "N/A"
                
                # Get genre name
                genre_name = track.genre.name if track.genre else "N/A"
                
                track_data = {
                    "id": track.uuid,  # Use UUID for compatibility with existing API
                    "label": label_name,
                    "duration": track.duration_sec or 0,
                    "artist": artist_name,  # Primary artist for display
                    "all_artists": all_artists,  # All artists for deduplication
                    "title": track.title or "N/A",
                    "year": track.year
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

    def _normalize_artist_name(self, artist_name: str) -> str:
        """
        Normalize artist name to handle variations in formatting.
        
        Examples:
        - "Jacob Stone" -> "jacob stone"
        - "jacob-stone" -> "jacob stone"  
        - "JACOB    STONE" -> "jacob stone"
        - "Artist A & Artist B" -> "artist a artist b"
        
        Args:
            artist_name: Raw artist name
            
        Returns:
            Normalized artist name
        """
        if not artist_name:
            return ""
        
        # Convert to lowercase
        normalized = artist_name.lower()
        
        # Replace common separators with spaces
        # Handle: hyphens, underscores, various types of dashes
        separators = ['-', '_', '–', '—', '•']
        for sep in separators:
            normalized = normalized.replace(sep, ' ')
        
        # Replace common connecting words/symbols with spaces for more aggressive matching
        # Handle: &, feat, ft, featuring, vs, x, +
        connectors = [' & ', ' feat ', ' feat. ', ' ft ', ' ft. ', ' featuring ', ' vs ', ' vs. ', ' x ', ' + ']
        for connector in connectors:
            normalized = normalized.replace(connector, ' ')
        
        # Normalize whitespace: multiple spaces to single space, strip ends
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        
        return normalized

    def _filter_track_title(self, title: str) -> str:
        """
        Filter track title by removing specified strings and stopping at certain markers.
        
        Processing order:
        1. Apply stopper strings (truncate at first occurrence)
        2. Apply removal strings (remove completely)
        
        Args:
            title: Original track title
            
        Returns:
            Filtered track title
        """
        if not title:
            return title
        
        filtered_title = title
        
        # Step 1: Apply stopper strings (case-insensitive)
        # Find the earliest occurrence of any stopper string
        earliest_stop_position = len(filtered_title)
        
        for stopper in settings.title_stopper_strings:
            # Case-insensitive search
            stop_position = filtered_title.lower().find(stopper.lower())
            if stop_position != -1 and stop_position < earliest_stop_position:
                earliest_stop_position = stop_position
        
        # Truncate at the earliest stopper position if found
        if earliest_stop_position < len(filtered_title):
            filtered_title = filtered_title[:earliest_stop_position]
        
        # Step 2: Apply removal strings (case-insensitive)
        for removal_string in settings.title_removal_strings:
            # Case-insensitive replacement
            filtered_title = re.sub(re.escape(removal_string), '', filtered_title, flags=re.IGNORECASE)
        
        # Clean up extra whitespace
        filtered_title = re.sub(r'\s+', ' ', filtered_title).strip()
        
        return filtered_title

    def _apply_title_filtering_to_tracks(self, tracks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Apply title filtering to a list of tracks.
        
        Args:
            tracks: List of track dictionaries
            
        Returns:
            List of tracks with filtered titles
        """
        filtered_tracks = []
        
        for track in tracks:
            # Create a copy of the track to avoid modifying the original
            filtered_track = track.copy()
            
            # Apply title filtering if title exists
            if "title" in filtered_track and filtered_track["title"]:
                filtered_track["title"] = self._filter_track_title(filtered_track["title"])
            
            filtered_tracks.append(filtered_track)
        
        return filtered_tracks

    def _deduplicate_tracks(self, tracks: List[Dict[str, Any]], target_count: int, reference_track: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Removes duplicate tracks based on:
        1. Filename (without extension) and duration (existing logic)
        2. Artist set and title combination (enhanced for multiple artists per track with robust normalization)
        3. Reference track exclusion (for track selection similarity)
        
        Then sorts by score, re-ranks, and returns up to target_count tracks.
        
        Args:
            tracks: List of track dictionaries to deduplicate
            target_count: Maximum number of tracks to return
            reference_track: Optional reference track to exclude from results
        """
        # First layer: Filename-based deduplication (existing logic)
        seen_filename_tracks = set()
        filename_deduplicated_list = []
        
        for track in tracks:
            filename_full = track.get("filename", "")
            # Remove extension from filename for the key
            filename_base, file_extension = os.path.splitext(filename_full)
            duration = track.get("duration", -1)
            track_key = (filename_base.lower().strip(), duration)  # Use lowercased base filename
            
            if track_key not in seen_filename_tracks:
                filename_deduplicated_list.append(track)
                seen_filename_tracks.add(track_key)
        
        # Second layer: Artist set and title-based deduplication (enhanced for multiple artists)
        seen_artist_title_tracks = set()
        final_deduplicated_list = []
        
        # Prepare reference track normalization if provided
        reference_normalized_key = None
        if reference_track:
            ref_title = reference_track.get("title", "").strip().lower()
            ref_all_artists = reference_track.get("all_artists", [])
            
            # If no all_artists field, fall back to primary artist field
            if not ref_all_artists:
                ref_primary_artist = reference_track.get("artist", "").strip()
                ref_all_artists = [ref_primary_artist] if ref_primary_artist else []
            
            # Create normalized reference key if we have title and artists
            if ref_title and ref_all_artists:
                ref_normalized_artists = []
                for artist in ref_all_artists:
                    normalized_artist = self._normalize_artist_name(artist)
                    if normalized_artist:
                        ref_normalized_artists.append(normalized_artist)
                
                if ref_normalized_artists:
                    ref_normalized_artists_tuple = tuple(sorted(ref_normalized_artists))
                    reference_normalized_key = (ref_normalized_artists_tuple, ref_title)
        
        for track in filename_deduplicated_list:
            title = track.get("title", "").strip().lower()
            
            # Get all artists for this track
            all_artists = track.get("all_artists", [])
            
            # If no all_artists field, fall back to primary artist field
            if not all_artists:
                primary_artist = track.get("artist", "").strip()
                all_artists = [primary_artist] if primary_artist else []
            
            # Skip tracks with empty title or no artists to avoid false positives
            if not title or not all_artists:
                final_deduplicated_list.append(track)
                continue
            
            # Create a normalized, sorted set of artists with robust normalization
            normalized_artists = []
            for artist in all_artists:
                normalized_artist = self._normalize_artist_name(artist)
                if normalized_artist:  # Only add non-empty normalized names
                    normalized_artists.append(normalized_artist)
            
            # Sort the normalized artists and convert to tuple for hashing
            normalized_artists_tuple = tuple(sorted(normalized_artists))
            
            # Create a key from normalized artist set and title
            artist_title_key = (normalized_artists_tuple, title)
            
            # Skip if this matches the reference track
            if reference_normalized_key and artist_title_key == reference_normalized_key:
                continue  # Skip the reference track itself
            
            if artist_title_key not in seen_artist_title_tracks:
                final_deduplicated_list.append(track)
                seen_artist_title_tracks.add(artist_title_key)
            # else: this track has the same artist set and title as a previous track, so skip it
        
        # Sort by score in descending order (higher score is better)
        # Ensure score exists and is a number, default to 0 or a very low number if missing/invalid
        final_deduplicated_list.sort(key=lambda x: float(x.get("score", 0)) if isinstance(x.get("score"), (int, float, str)) and str(x.get("score")).replace('.', '', 1).isdigit() else 0, reverse=True)
        
        # Re-rank the sorted list
        reranked_list = []
        for i, track_item in enumerate(final_deduplicated_list):
            track_item["rank"] = i + 1
            reranked_list.append(track_item)
        
        # Apply title filtering after deduplication and ranking
        filtered_tracks = self._apply_title_filtering_to_tracks(reranked_list[:target_count])
            
        # Return filtered tracks
        return filtered_tracks

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

    async def get_track_path_by_uuid(self, db: AsyncSession, track_uuid: str) -> Optional[str]:
        """
        Get track file path by UUID.
        
        Args:
            db: Database session
            track_uuid: Track UUID
            
        Returns:
            File path string or None if not found
        """
        return await self.track_repository.async_get_track_path_by_uuid(db, track_uuid)
