"""
Search Service
==============

This service provides comprehensive track search functionality across multiple criteria.
It handles text-based searches, artist/album/genre filtering, BPM range queries,
and musical key searches using MariaDB repositories.

Coordinates with track repository to perform complex queries and format results
for API consumption with proper error handling and data validation.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import re
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.track_repository import TrackRepository


class SearchService:
    """
    Service for searching tracks using MariaDB instead of MongoDB.
    Maintains the same API interface as the original MongoDB-based search.
    """
    
    def __init__(self):
        """Initialize search service."""
        self.track_repository = TrackRepository()
    
    async def search_tracks(self, db: AsyncSession, query: str, limit: int = 20) -> Dict[str, Any]:
        """
        Search for tracks based on a query string.
        
        Maintains the same API interface as the original MongoDB search_tracks function.
        Searches across title, artist names, and filenames using case-insensitive matching.
        
        Args:
            db: Database session
            query: Search query string
            limit: Maximum number of results to return (default: 20)
            
        Returns:
            Dictionary with 'tracks' key containing list of track dictionaries
        """
        if not query or not query.strip():
            return {"tracks": []}
        
        try:
            print(f"MariaDB: Searching for tracks with query: {query}")
            
            # Use the repository's async search method
            results = await self.track_repository.async_search_tracks(db, query.strip(), limit)
            
            # Format results to match the original MongoDB API
            formatted_results = []
            for track_data in results:
                # Ensure the format matches the original MongoDB response exactly
                formatted_track = {
                    "id": track_data.get("id"),  # UUID from track
                    "artist": track_data.get("artist", "N/A"),
                    "duration": track_data.get("duration", 0),
                    "filename": track_data.get("filename", "N/A")
                }
                formatted_results.append(formatted_track)
            
            print(f"MariaDB: Found {len(formatted_results)} tracks for query: {query}")
            return {"tracks": formatted_results}
            
        except Exception as e:
            print(f"Error during MariaDB search: {e}")
            return {"tracks": []}

    def search_tracks_sync(self, db: Session, query: str, limit: int = 20) -> Dict[str, Any]:
        """
        Synchronous version of search_tracks.
        
        Args:
            db: Database session
            query: Search query string
            limit: Maximum number of results to return
            
        Returns:
            Dictionary with 'tracks' key containing list of track dictionaries
        """
        if not query or not query.strip():
            return {"tracks": []}
        
        try:
            print(f"MariaDB: Searching for tracks with query: {query}")
            
            # Use the repository's sync search method
            results = self.track_repository.search_tracks(db, query.strip(), limit)
            
            # Format results to match the original MongoDB API
            formatted_results = []
            for track_data in results:
                formatted_track = {
                    "id": track_data.get("id"),
                    "artist": track_data.get("artist", "N/A"),
                    "duration": track_data.get("duration", 0),
                    "filename": track_data.get("filename", "N/A")
                }
                formatted_results.append(formatted_track)
            
            print(f"MariaDB: Found {len(formatted_results)} tracks for query: {query}")
            return {"tracks": formatted_results}
            
        except Exception as e:
            print(f"Error during MariaDB search: {e}")
            return {"tracks": []}

    async def get_track_path_by_id(self, db: AsyncSession, track_id: str) -> Optional[str]:
        """
        Fetches the file path of a track by its UUID.
        
        Maintains the same API interface as the original MongoDB get_track_path_by_id function.
        
        Args:
            db: Database session
            track_id: The UUID of the track (equivalent to MongoDB ObjectId)
            
        Returns:
            The file path if found, else None
        """
        if not track_id or not track_id.strip():
            print(f"Invalid track_id format: {track_id}")
            return None
        
        try:
            file_path = await self.track_repository.async_get_track_path_by_uuid(db, track_id.strip())
            if file_path:
                print(f"Path found for track_id {track_id}: {file_path}")
                return file_path
            else:
                print(f"Track with ID '{track_id}' not found.")
                return None
        except Exception as e:
            print(f"Error fetching track path for ID {track_id}: {e}")
            return None

    def get_track_path_by_id_sync(self, db: Session, track_id: str) -> Optional[str]:
        """
        Synchronous version of get_track_path_by_id.
        
        Args:
            db: Database session  
            track_id: The UUID of the track
            
        Returns:
            The file path if found, else None
        """
        if not track_id or not track_id.strip():
            print(f"Invalid track_id format: {track_id}")
            return None
        
        try:
            file_path = self.track_repository.get_track_path_by_uuid(db, track_id.strip())
            if file_path:
                print(f"Path found for track_id {track_id}: {file_path}")
                return file_path
            else:
                print(f"Track with ID '{track_id}' not found.")
                return None
        except Exception as e:
            print(f"Error fetching track path for ID {track_id}: {e}")
            return None

    # Advanced search methods leveraging repository functionality
    
    async def search_by_artist(self, db: AsyncSession, artist_name: str, limit: int = 100) -> Dict[str, Any]:
        """
        Search tracks by artist name.
        
        Args:
            db: Database session
            artist_name: Artist name to search for
            limit: Maximum number of results
            
        Returns:
            Dictionary with 'tracks' key containing list of track dictionaries
        """
        if not artist_name or not artist_name.strip():
            return {"tracks": []}
        
        try:
            # Use sync method and convert manually since no async version exists for this specific search
            tracks = self.track_repository.search_by_artist(db, artist_name.strip(), limit)
            
            # Format results
            formatted_results = []
            for track in tracks:
                # Get primary artist
                artist_name_result = "N/A"
                if track.track_artists:
                    artist_name_result = track.track_artists[0].artist.name
                
                filename = track.file_path.split('/')[-1] if track.file_path else "N/A"
                
                formatted_track = {
                    "id": track.uuid,
                    "artist": artist_name_result,
                    "duration": track.duration_sec or 0,
                    "filename": filename,
                    "title": track.title,
                    "album": track.album.title if track.album else "N/A"
                }
                formatted_results.append(formatted_track)
            
            return {"tracks": formatted_results}
            
        except Exception as e:
            print(f"Error during artist search: {e}")
            return {"tracks": []}

    async def search_by_album(self, db: AsyncSession, album_title: str, limit: int = 100) -> Dict[str, Any]:
        """
        Search tracks by album title.
        
        Args:
            db: Database session
            album_title: Album title to search for
            limit: Maximum number of results
            
        Returns:
            Dictionary with 'tracks' key containing list of track dictionaries
        """
        if not album_title or not album_title.strip():
            return {"tracks": []}
        
        try:
            tracks = self.track_repository.search_by_album(db, album_title.strip(), limit)
            
            # Format results
            formatted_results = []
            for track in tracks:
                # Get primary artist
                artist_name = "N/A"
                if track.track_artists:
                    artist_name = track.track_artists[0].artist.name
                
                filename = track.file_path.split('/')[-1] if track.file_path else "N/A"
                
                formatted_track = {
                    "id": track.uuid,
                    "artist": artist_name,
                    "duration": track.duration_sec or 0,
                    "filename": filename,
                    "title": track.title,
                    "album": track.album.title if track.album else "N/A"
                }
                formatted_results.append(formatted_track)
            
            return {"tracks": formatted_results}
            
        except Exception as e:
            print(f"Error during album search: {e}")
            return {"tracks": []}

    async def search_by_genre(self, db: AsyncSession, genre_name: str, limit: int = 100) -> Dict[str, Any]:
        """
        Search tracks by genre name.
        
        Args:
            db: Database session
            genre_name: Genre name to search for
            limit: Maximum number of results
            
        Returns:
            Dictionary with 'tracks' key containing list of track dictionaries
        """
        if not genre_name or not genre_name.strip():
            return {"tracks": []}
        
        try:
            tracks = self.track_repository.search_by_genre(db, genre_name.strip(), limit)
            
            # Format results
            formatted_results = []
            for track in tracks:
                # Get primary artist
                artist_name = "N/A"
                if track.track_artists:
                    artist_name = track.track_artists[0].artist.name
                
                filename = track.file_path.split('/')[-1] if track.file_path else "N/A"
                
                formatted_track = {
                    "id": track.uuid,
                    "artist": artist_name,
                    "duration": track.duration_sec or 0,
                    "filename": filename,
                    "title": track.title,
                    "album": track.album.title if track.album else "N/A",
                    "genre": track.genre.name if track.genre else "N/A"
                }
                formatted_results.append(formatted_track)
            
            return {"tracks": formatted_results}
            
        except Exception as e:
            print(f"Error during genre search: {e}")
            return {"tracks": []}

    async def search_by_bpm_range(self, db: AsyncSession, min_bpm: int, max_bpm: int, limit: int = 100) -> Dict[str, Any]:
        """
        Search tracks by BPM range.
        
        Args:
            db: Database session
            min_bpm: Minimum BPM
            max_bpm: Maximum BPM
            limit: Maximum number of results
            
        Returns:
            Dictionary with 'tracks' key containing list of track dictionaries
        """
        try:
            tracks = self.track_repository.get_by_bpm_range(db, min_bpm, max_bpm, limit)
            
            # Format results
            formatted_results = []
            for track in tracks:
                # Get primary artist
                artist_name = "N/A"
                if track.track_artists:
                    artist_name = track.track_artists[0].artist.name
                
                filename = track.file_path.split('/')[-1] if track.file_path else "N/A"
                
                formatted_track = {
                    "id": track.uuid,
                    "artist": artist_name,
                    "duration": track.duration_sec or 0,
                    "filename": filename,
                    "title": track.title,
                    "bpm": track.bpm
                }
                formatted_results.append(formatted_track)
            
            return {"tracks": formatted_results}
            
        except Exception as e:
            print(f"Error during BPM range search: {e}")
            return {"tracks": []}

    async def search_by_musical_key(self, db: AsyncSession, musical_key: str, limit: int = 100) -> Dict[str, Any]:
        """
        Search tracks by musical key.
        
        Args:
            db: Database session
            musical_key: Musical key (e.g., "C#m")
            limit: Maximum number of results
            
        Returns:
            Dictionary with 'tracks' key containing list of track dictionaries
        """
        if not musical_key or not musical_key.strip():
            return {"tracks": []}
        
        try:
            tracks = self.track_repository.get_by_key(db, musical_key.strip(), limit)
            
            # Format results
            formatted_results = []
            for track in tracks:
                # Get primary artist
                artist_name = "N/A"
                if track.track_artists:
                    artist_name = track.track_artists[0].artist.name
                
                filename = track.file_path.split('/')[-1] if track.file_path else "N/A"
                
                formatted_track = {
                    "id": track.uuid,
                    "artist": artist_name,
                    "duration": track.duration_sec or 0,
                    "filename": filename,
                    "title": track.title,
                    "musical_key": track.musical_key
                }
                formatted_results.append(formatted_track)
            
            return {"tracks": formatted_results}
            
        except Exception as e:
            print(f"Error during musical key search: {e}")
            return {"tracks": []}

    # Utility methods for enhanced search functionality
    
    async def get_track_details_with_relationships(self, db: AsyncSession, track_id: str) -> Optional[Dict[str, Any]]:
        """
        Get complete track details with all relationships.
        
        Args:
            db: Database session
            track_id: Track UUID
            
        Returns:
            Complete track details dictionary or None
        """
        try:
            track = await self.track_repository.async_get_with_relationships(db, track_id)
            if not track:
                return None
            
            # Get all artists for this track
            artists = []
            if track.track_artists:
                artists = [ta.artist.name for ta in track.track_artists]
            
            filename = track.file_path.split('/')[-1] if track.file_path else "N/A"
            
            track_details = {
                "id": track.uuid,
                "title": track.title,
                "filename": filename,
                "file_path": track.file_path,
                "duration": track.duration_sec or 0,
                "bpm": track.bpm,
                "musical_key": track.musical_key,
                "album": track.album.title if track.album else None,
                "label": track.label.name if track.label else None,
                "genre": track.genre.name if track.genre else None,
                "artists": artists,
                "primary_artist": artists[0] if artists else "N/A"
            }
            
            return track_details
            
        except Exception as e:
            print(f"Error getting track details for ID {track_id}: {e}")
            return None

    def validate_search_query(self, query: str) -> bool:
        """
        Validate search query to prevent potential issues.
        
        Args:
            query: Search query string
            
        Returns:
            True if query is valid, False otherwise
        """
        if not query or not isinstance(query, str):
            return False
        
        # Remove leading/trailing whitespace
        query = query.strip()
        
        # Check minimum length
        if len(query) < 1:
            return False
        
        # Check maximum length to prevent excessive queries
        if len(query) > 100:
            return False
        
        return True 