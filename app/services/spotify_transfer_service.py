"""
Spotify Transfer Service
========================

This service handles the transfer of ResomiX playlists to Spotify.
It manages OAuth authentication, track searching on Spotify, and playlist creation
using the Spotify Web API through the spotipy library.

Provides functionality to search for tracks on Spotify, create playlists,
and handle the complete playlist transfer workflow.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import asyncio
import re

from app.core.config import settings
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository


class SpotifyTransferService:
    """Service for transferring ResomiX playlists to Spotify."""
    
    def __init__(self):
        """Initialize the Spotify transfer service."""
        self.playlist_repository = PlaylistRepository()
        self.track_repository = TrackRepository()
    
    def _create_spotify_client(self, access_token: str) -> spotipy.Spotify:
        """
        Create a Spotify client with the provided access token.
        
        Args:
            access_token: User's Spotify OAuth access token
            
        Returns:
            Configured Spotify client
        """
        return spotipy.Spotify(auth=access_token)
    
    def _clean_search_query(self, title: str, artist: str) -> str:
        """
        Clean and format the search query for Spotify.
        
        Args:
            title: Track title
            artist: Track artist
            
        Returns:
            Cleaned search query string
        """
        # Remove common strings that might interfere with search
        title_clean = title
        for remove_str in settings.title_removal_strings:
            title_clean = re.sub(re.escape(remove_str), '', title_clean, flags=re.IGNORECASE)
        
        # Remove stopper strings
        for stopper in settings.title_stopper_strings:
            if stopper.lower() in title_clean.lower():
                title_clean = title_clean.split(stopper)[0]
                break
        
        # Clean up extra spaces and special characters
        title_clean = re.sub(r'[^\w\s\-\(\)]', ' ', title_clean).strip()
        title_clean = re.sub(r'\s+', ' ', title_clean)
        
        # Clean artist name similarly
        artist_clean = artist
        for stopper in settings.meta_stopper_strings:
            if stopper.lower() in artist_clean.lower():
                artist_clean = artist_clean.split(stopper)[0]
                break
        
        artist_clean = re.sub(r'[^\w\s\-]', ' ', artist_clean).strip()
        artist_clean = re.sub(r'\s+', ' ', artist_clean)
        
        # Create search query
        query = f"{title_clean} {artist_clean}".strip()
        return query[:100]  # Limit query length
    
    async def _search_spotify_track(self, sp: spotipy.Spotify, title: str, artist: str) -> Optional[str]:
        """
        Search for a track on Spotify and return the best match URI.
        
        Args:
            sp: Spotify client
            title: Track title
            artist: Track artist
            
        Returns:
            Spotify track URI if found, None otherwise
        """
        try:
            # Create search query
            query = self._clean_search_query(title, artist)
            
            if not query.strip():
                return None
            
            # Run the search in a thread to avoid blocking
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                None, 
                lambda: sp.search(q=query, type='track', limit=10)
            )
            
            if not results['tracks']['items']:
                # Try searching with just the title if no results
                title_only_query = self._clean_search_query(title, "")
                if title_only_query.strip() and title_only_query != query:
                    results = await loop.run_in_executor(
                        None,
                        lambda: sp.search(q=title_only_query, type='track', limit=10)
                    )
            
            if not results['tracks']['items']:
                return None
            
            # Find the best match
            best_match = None
            best_score = 0
            
            for track in results['tracks']['items']:
                score = 0
                track_title = track['name'].lower()
                track_artists = [artist['name'].lower() for artist in track['artists']]
                
                # Score based on title similarity
                if title.lower() in track_title or track_title in title.lower():
                    score += 3
                elif any(word in track_title for word in title.lower().split()):
                    score += 1
                
                # Score based on artist similarity
                for track_artist in track_artists:
                    if artist.lower() in track_artist or track_artist in artist.lower():
                        score += 2
                        break
                    elif any(word in track_artist for word in artist.lower().split()):
                        score += 1
                        break
                
                if score > best_score:
                    best_score = score
                    best_match = track
            
            return best_match['uri'] if best_match else results['tracks']['items'][0]['uri']
            
        except Exception as e:
            print(f"Error searching for track '{title}' by '{artist}': {e}")
            return None
    
    async def transfer_playlist_to_spotify(
        self, 
        db: AsyncSession, 
        playlist_id: str, 
        access_token: str,
        custom_playlist_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transfer a ResomiX playlist to Spotify.
        
        Args:
            db: Database session
            playlist_id: ResomiX playlist UUID
            access_token: User's Spotify OAuth access token
            custom_playlist_name: Optional custom name for the Spotify playlist
            
        Returns:
            Dictionary with transfer results
        """
        try:
            # Get the playlist from database
            playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            if not playlist:
                return {
                    "success": False,
                    "error": "Playlist not found"
                }
            
            # Get playlist tracks
            playlist_tracks = await self.playlist_repository.async_get_tracks_by_playlist_id(db, playlist.id)
            if not playlist_tracks:
                return {
                    "success": False,
                    "error": "Playlist has no tracks"
                }
            
            # Get track details
            track_details = []
            for pt in playlist_tracks:
                track = await self.track_repository.async_get_by_id(db, pt.track_id)
                if track:
                    # Get track artists
                    artists = await self.track_repository.async_get_track_artists(db, track.id)
                    artist_names = [artist.name for artist in artists] if artists else ["Unknown Artist"]
                    
                    track_details.append({
                        "title": track.title,
                        "artist": ", ".join(artist_names),
                        "track_id": track.id
                    })
            
            if not track_details:
                return {
                    "success": False,
                    "error": "No valid tracks found in playlist"
                }
            
            # Create Spotify client
            try:
                sp = self._create_spotify_client(access_token)
                
                # Test the token by getting user info
                loop = asyncio.get_event_loop()
                user_info = await loop.run_in_executor(None, sp.current_user)
                
            except Exception as e:
                return {
                    "success": False,
                    "error": "Invalid or expired Spotify access token",
                    "details": {"spotify_error": str(e)}
                }
            
            # Create Spotify playlist
            spotify_playlist_name = custom_playlist_name or f"ResomiX - {playlist.name}"
            
            try:
                spotify_playlist = await loop.run_in_executor(
                    None,
                    lambda: sp.user_playlist_create(
                        user_info['id'],
                        spotify_playlist_name,
                        public=True,
                        description="Playlist created from ResomiX audio similarity platform"
                    )
                )
            except Exception as e:
                return {
                    "success": False,
                    "error": "Failed to create Spotify playlist",
                    "details": {"spotify_error": str(e)}
                }
            
            # Search for tracks on Spotify and collect URIs
            spotify_track_uris = []
            tracks_not_found = []
            
            for track_detail in track_details:
                spotify_uri = await self._search_spotify_track(
                    sp, 
                    track_detail["title"], 
                    track_detail["artist"]
                )
                
                if spotify_uri:
                    spotify_track_uris.append(spotify_uri)
                else:
                    tracks_not_found.append(f"{track_detail['artist']} - {track_detail['title']}")
            
            # Add tracks to Spotify playlist in batches (Spotify limits to 100 tracks per request)
            tracks_added = 0
            if spotify_track_uris:
                batch_size = 100
                for i in range(0, len(spotify_track_uris), batch_size):
                    batch = spotify_track_uris[i:i + batch_size]
                    try:
                        await loop.run_in_executor(
                            None,
                            lambda: sp.playlist_add_items(spotify_playlist['id'], batch)
                        )
                        tracks_added += len(batch)
                    except Exception as e:
                        print(f"Error adding batch {i//batch_size + 1} to Spotify playlist: {e}")
            
            # Prepare response
            return {
                "success": True,
                "data": {
                    "spotify_playlist_id": spotify_playlist['id'],
                    "spotify_playlist_url": spotify_playlist['external_urls']['spotify'],
                    "spotify_playlist_name": spotify_playlist_name,
                    "total_tracks": len(track_details),
                    "tracks_added": tracks_added,
                    "tracks_not_found": len(tracks_not_found),
                    "not_found_tracks": tracks_not_found[:10]  # Limit to first 10 for response size
                },
                "message": f"Successfully transferred playlist to Spotify. {tracks_added} tracks added, {len(tracks_not_found)} tracks not found."
            }
            
        except Exception as e:
            print(f"Error in transfer_playlist_to_spotify: {e}")
            return {
                "success": False,
                "error": "An internal error occurred during playlist transfer",
                "details": {"error": str(e)}
            }
