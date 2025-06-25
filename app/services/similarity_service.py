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
from sqlalchemy import text

from app.repositories.track_repository import TrackRepository
from app.repositories.playlist_repository import PlaylistRepository
from app.core.config import settings
from app.services.metadata_service import MetadataService

load_dotenv()


class SimilarityService:
    """
    Service for calculating audio similarity using external similarity microservice.
    """
    
    def __init__(self):
        """Initialize similarity service."""
        self.track_repository = TrackRepository()
        self.playlist_repository = PlaylistRepository()
        self.similarity_server_url = os.getenv("SIMILARITY_SERVER_URL")
        self.path_prefix_to_remove = "/home/usman/data/"  # Ensured this is the exact prefix.

    async def calculate_similarity_for_upload(
        self, 
        db: AsyncSession,
        audio_bytes: bytes, 
        original_filename: str, 
        track_uuid: str,
        top_k: int = 10, 
        similarity_duplication_threshold: int = 0
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
            
        Returns:
            Dictionary containing similarity results or error information
        """
        if not audio_bytes:
            return {"success": False, "error": "Audio data is empty for similarity processing."}

        # Concurrently get duration and call similarity server
        duration_task = asyncio.to_thread(self._get_duration_from_bytes_sync, audio_bytes)

        files_data = {"file": (original_filename, audio_bytes, "application/octet-stream")}
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
            db_details_map = await self._fetch_track_details_from_db_by_path(db, clean_paths)
            
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
            filtered_enriched_tracks = self._apply_response_filtering(enriched_similar_tracks)
            
            deduplicated_enriched_tracks = self._deduplicate_tracks(
                filtered_enriched_tracks, 
                target_count_after_deduplication,
                reference_track=None  # No reference track for upload similarity
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

            # NEW: Get uploaded track details to construct response similar to similarity by ID
            try:
                uploaded_track_details = await self._fetch_reference_track_details_from_db_by_uuid(db, track_uuid)
                if uploaded_track_details:
                    # Use server duration if available, otherwise fall back to calculated duration
                    final_duration = server_duration if server_duration is not None and server_duration > 0 else (calculated_duration if calculated_duration is not None and calculated_duration > 0 else None)
                    uploaded_track_details["duration"] = final_duration
                    
                    # Update the track's duration in the database if we have a valid duration
                    if final_duration is not None and final_duration > 0:
                        try:
                            await self._update_track_duration_in_db(db, track_uuid, final_duration)
                            print(f"Updated track {track_uuid} duration to {final_duration} seconds")
                        except Exception as e:
                            print(f"Warning: Could not update track duration in database: {e}")
                            # Don't fail the request if duration update fails
                    
                    # Create similarity playlist if we have tracks
                    playlist_info = None
                    if deduplicated_track_ids:
                        try:
                            # Get the uploaded track's database ID
                            uploaded_track = await self.track_repository.async_get_by_uuid(db, track_uuid)
                            if uploaded_track:
                                # Generate playlist name based on uploaded track details
                                playlist_name = self._generate_playlist_name_from_seed_track(uploaded_track_details)
                                
                                playlist_info = await self.playlist_repository.async_create_similarity_playlist(
                                    db=db,
                                    seed_track_id=uploaded_track.id,
                                    track_ids=deduplicated_track_ids,
                                    track_scores=deduplicated_track_scores,
                                    name=playlist_name
                                )
                                
                                # Send playlist peaks request (fire and forget)
                                if playlist_info:
                                    await self._send_playlist_peaks_request(track_uuid, deduplicated_enriched_tracks)
                                    
                        except Exception as e:
                            print(f"Error creating playlist for upload similarity: {e}")
                            # Don't fail the whole request if playlist creation fails
                    
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
                        filtered_queried_tracks = self._apply_response_filtering([response_data["queried_track"]])
                        if filtered_queried_tracks:
                            response_data["queried_track"] = filtered_queried_tracks[0]
                    
                    return response_data
                else:
                    print(f"Warning: Could not fetch details for uploaded track {track_uuid}")
                    return {"success": False, "error": "Could not retrieve uploaded track details"}
            except Exception as e:
                print(f"Error fetching uploaded track details: {e}")
                return {"success": False, "error": "Failed to retrieve uploaded track details"}
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
            db_details_map = await self._fetch_track_details_from_db_by_path(db, clean_paths)
            
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
            filtered_enriched_tracks = self._apply_response_filtering(enriched_similar_tracks)
            
            deduplicated_enriched_tracks = self._deduplicate_tracks(
                filtered_enriched_tracks, 
                target_count_after_deduplication,
                reference_track=queried_track_data  # Use queried track for reference in deduplication
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
                            playlist_name = self._generate_playlist_name_from_seed_track(queried_track_data)
                            
                            playlist_info = await self.playlist_repository.async_create_similarity_playlist(
                                db=db,
                                seed_track_id=queried_track.id,
                                track_ids=deduplicated_track_ids,
                                track_scores=deduplicated_track_scores,
                                name=playlist_name
                            )
                            
                            # Send playlist peaks request (fire and forget)
                            if playlist_info:
                                await self._send_playlist_peaks_request(queried_track_uuid, deduplicated_enriched_tracks)
                                
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
                filtered_queried_tracks = self._apply_response_filtering([response_data["queried_track"]])
                if filtered_queried_tracks:
                    response_data["queried_track"] = filtered_queried_tracks[0]
            
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

    async def _fetch_reference_track_details_from_db_by_path(self, db: AsyncSession, track_path: str) -> Optional[Dict[str, Any]]:
        """
        Fetch complete track details from the database by path for reference track formatting.
        
        Args:
            db: Database session
            track_path: The file path to lookup in the database
            
        Returns:
            Dictionary with track details or None if not found
        """
        query = text("""
            SELECT 
                t.uuid as id,
                t.title,
                t.year,
                t.duration_sec as duration,
                COALESCE(l.name, '') as label,
                COALESCE(
                    GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', '),
                    ''
                ) as artist
            FROM tracks t
            LEFT JOIN labels l ON t.label_id = l.id
            LEFT JOIN track_artists ta ON t.id = ta.track_id
            LEFT JOIN artists a ON ta.artist_id = a.id
            WHERE t.file_path = :track_path OR t.preview_path = :track_path
            GROUP BY t.id, t.uuid, t.title, t.year, t.duration_sec, l.name
            LIMIT 1
        """)
        
        result = await db.execute(query, {"track_path": track_path})
        row = result.first()
        
        if row:
            return {
                "id": row.id,
                "title": row.title or "Unknown",
                "year": row.year,
                "duration": row.duration,
                "label": row.label,
                "artist": row.artist or "Unknown"
            }
        return None

    async def _fetch_reference_track_details_from_db_by_uuid(self, db: AsyncSession, track_uuid: str) -> Optional[Dict[str, Any]]:
        """
        Fetch complete track details from the database by UUID for reference track formatting.
        
        Args:
            db: Database session
            track_uuid: The UUID to lookup in the database
            
        Returns:
            Dictionary with track details or None if not found
        """
        query = text("""
            SELECT 
                t.uuid as id,
                t.title,
                t.year,
                t.duration_sec as duration,
                COALESCE(l.name, '') as label,
                COALESCE(
                    GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', '),
                    ''
                ) as artist
            FROM tracks t
            LEFT JOIN labels l ON t.label_id = l.id
            LEFT JOIN track_artists ta ON t.id = ta.track_id
            LEFT JOIN artists a ON ta.artist_id = a.id
            WHERE t.uuid = :track_uuid
            GROUP BY t.id, t.uuid, t.title, t.year, t.duration_sec, l.name
            LIMIT 1
        """)
        
        result = await db.execute(query, {"track_uuid": track_uuid})
        row = result.first()
        
        if row:
            return {
                "id": row.id,
                "title": row.title or "Unknown",
                "year": row.year,
                "duration": row.duration,
                "label": row.label,
                "artist": row.artist or "Unknown"
            }
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
            Track_details_dict contains: id, track_id, filename, album, duration, artist, all_artists.
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
                    "track_id": track.id,  # Add database ID for playlist creation
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
        1. Apply meta regex check (if entire title matches domain/URL pattern, return empty string)
        2. Apply title stopper strings (truncate at first occurrence)
        3. Apply title removal strings (remove completely)
        
        Args:
            title: Original track title
            
        Returns:
            Filtered track title
        """
        return MetadataService._filter_title_field(title)

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
        # STEP 0: Apply title filtering BEFORE deduplication to normalize titles
        # This ensures tracks like "Junior Gee" and "Junior Gee (Original Mix)" are seen as duplicates
        preprocessed_tracks = []
        for track in tracks:
            # Create a copy to avoid modifying the original
            processed_track = track.copy()
            
            # Apply title filtering if title exists
            if "title" in processed_track and processed_track["title"]:
                processed_track["title"] = self._filter_track_title(processed_track["title"]).strip()
            
            preprocessed_tracks.append(processed_track)
        
        # First layer: Filename-based deduplication (existing logic)
        seen_filename_tracks = set()
        filename_deduplicated_list = []
        
        for track in preprocessed_tracks:
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
            # Apply title filtering to reference track as well for consistent comparison
            ref_title = reference_track.get("title", "").strip()
            if ref_title:
                ref_title = self._filter_track_title(ref_title).strip().lower()
            
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
            # Title is already filtered, just need to normalize case and trim
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
        
        # Title filtering is now done BEFORE deduplication, so just return the tracks
        # Limited to target_count
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

    def _apply_response_filtering(self, tracks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Apply metadata filtering to track data returned from database.
        This ensures existing tracks get filtered even if they weren't filtered during upload.
        
        Args:
            tracks: List of track dictionaries from database
            
        Returns:
            List of tracks with filtered metadata
        """
        filtered_tracks = []
        
        for track in tracks:
            filtered_track = track.copy()
            
            # Apply filtering to relevant fields
            if "title" in filtered_track and filtered_track["title"]:
                filtered_track["title"] = MetadataService._filter_title_field(filtered_track["title"])
            
            if "artist" in filtered_track and filtered_track["artist"]:
                filtered_track["artist"] = MetadataService._filter_metadata_field(filtered_track["artist"], "Artist")
            
            if "label" in filtered_track and filtered_track["label"]:
                filtered_track["label"] = MetadataService._filter_metadata_field(filtered_track["label"], "Label")
            
            # Note: Album and Genre are not typically returned in similarity responses,
            # but we can add them if needed in the future
            
            filtered_tracks.apend(filtered_track)
        
        return filtered_tracks

    def _generate_playlist_name_from_seed_track(self, seed_track_data: Dict[str, Any]) -> str:
        """
        Generate a playlist name based on the seed track's artist and title information.
        
        Format:
        - Single artist: "Artist - Title"
        - Multiple artists (up to max_artists): "Artist1, Artist2, Artist3 - Title"
        - More than max_artists: "VA - Title"
        
        Args:
            seed_track_data: Dictionary containing seed track information with 'artist' and 'title' keys
            
        Returns:
            Generated playlist name string
        """
        from app.core.config import settings
        
        if not seed_track_data:
            return "Playlist"
        
        title = seed_track_data.get("title", "Unknown")
        artist_string = seed_track_data.get("artist", "Unknown")
        
        # Handle empty or unknown values
        if not title or title.lower() in ["unknown", "n/a", ""]:
            title = "Unknown"
        if not artist_string or artist_string.lower() in ["unknown", "n/a", ""]:
            return "Playlist"
        
        # Split artists by comma and clean them up
        artists = [artist.strip() for artist in artist_string.split(",") if artist.strip()]
        
        # Remove duplicates while preserving order
        unique_artists = []
        seen = set()
        for artist in artists:
            if artist.lower() not in seen:
                unique_artists.append(artist)
                seen.add(artist.lower())
        
        if not unique_artists:
            return "Playlist"
        
        # Determine artist part of the name
        max_artists = settings.default_similarity_playlist_max_artists
        
        if len(unique_artists) == 1:
            artist_part = unique_artists[0]
        elif len(unique_artists) <= max_artists:
            artist_part = ", ".join(unique_artists)
        else:
            artist_part = "VA"  # Various Artists
        
        # Generate the final playlist name
        playlist_name = f"{artist_part} - {title}"
        
        # Ensure the name doesn't exceed the database limit (100 characters for playlist names)
        if len(playlist_name) > 100:
            # Truncate the title part if needed, keeping the artist part intact
            max_title_length = 100 - len(artist_part) - 3  # 3 for " - "
            if max_title_length > 10:  # Ensure we have at least some title
                truncated_title = title[:max_title_length-3] + "..."
                playlist_name = f"{artist_part} - {truncated_title}"
            else:
                # If artist part is too long, just use a simple format
                playlist_name = f"{artist_part[:90]}... - {title[:5]}..."
        
        return playlist_name

    async def _update_track_duration_in_db(self, db: AsyncSession, track_uuid: str, duration: float) -> None:
        """
        Updates the duration of a track in the database.
        
        Args:
            db: Database session
            track_uuid: Track UUID
            duration: New duration in seconds
        """
        # Convert to integer since database field is INT UNSIGNED
        duration_int = int(round(duration)) if duration is not None else None
        
        query = text("""
            UPDATE tracks
            SET duration_sec = :duration
            WHERE uuid = :track_uuid
        """)
        
        await db.execute(query, {"duration": duration_int, "track_uuid": track_uuid})
        await db.commit()

    async def _send_playlist_peaks_request(self, reference_track_uuid: str, similar_tracks: List[Dict[str, Any]]) -> None:
        """
        Sends a playlist peaks request to the similarity server (fire and forget).
        This is a background request that triggers processing on the similarity server.
        
        Args:
            reference_track_uuid: UUID of the reference/queried track
            similar_tracks: List of similar track dictionaries
        """
        if not self.similarity_server_url:
            print("Warning: SIMILARITY_SERVER_URL is not set, skipping playlist peaks request")
            return

        try:
            # Collect all track UUIDs including the reference track
            track_uuids = [reference_track_uuid]  # Start with reference track
            
            # Add similar track UUIDs
            for track in similar_tracks:
                track_uuid = track.get("id")
                if track_uuid:
                    track_uuids.append(track_uuid)
            
            if len(track_uuids) <= 1:  # Only reference track, no similar tracks
                print("No similar tracks found, skipping playlist peaks request")
                return
            
            # Prepare the request
            target_url = f"{self.similarity_server_url.rstrip('/')}/playlist_peaks"
            payload = {"track_uuids": track_uuids}
            
            print(f"Sending playlist peaks request to {target_url} with {len(track_uuids)} tracks")
            
            # Fire and forget request - don't await the response
            asyncio.create_task(self._execute_playlist_peaks_request(target_url, payload))
            
        except Exception as e:
            print(f"Error preparing playlist peaks request: {e}")
            # Don't fail the main request if this background task fails

    async def _execute_playlist_peaks_request(self, target_url: str, payload: Dict[str, Any]) -> None:
        """
        Execute the playlist peaks request in the background.
        
        Args:
            target_url: The full URL to send the request to
            payload: The request payload
        """
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(target_url, json=payload)
                print(f"Playlist peaks request completed with status: {response.status_code}")
            except httpx.HTTPStatusError as e:
                print(f"HTTP error in playlist peaks request: {e.response.status_code} - {e.response.text}")
            except httpx.RequestError as e:
                print(f"Request error in playlist peaks request: {e}")
            except Exception as e:
                print(f"Unexpected error in playlist peaks request: {e}")
