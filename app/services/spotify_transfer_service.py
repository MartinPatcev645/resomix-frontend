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
import logging
from concurrent.futures import ThreadPoolExecutor
import time

from app.core.config import settings
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository
from app.utils.logging_utils import log_request

# Set up logger specifically for Spotify transfer
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Create console handler with formatting
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [SPOTIFY_TRANSFER] %(message)s'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)


class SpotifyTransferService:
    """Service for transferring ResomiX playlists to Spotify"""
    
    def __init__(self):
        """Initialize the Spotify transfer service"""
        self.playlist_repository = PlaylistRepository()
        self.track_repository = TrackRepository()
        
        # Concurrent processing settings
        self.max_concurrent_searches = 10  # Maximum concurrent Spotify API calls
        self.batch_size = 100  # Spotify's limit for adding tracks to playlist
        
        logger.info("SpotifyTransferService initialized with max_concurrent_searches=%d", 
                   self.max_concurrent_searches)

    def _create_spotify_client(self, access_token: str) -> spotipy.Spotify:
        """
        Create Spotify client with user's access token
        
        Args:
            access_token: Valid Spotify OAuth access token
            
        Returns:
            Configured Spotify client
        """
        logger.info("Creating Spotify client with provided access token")
        try:
            client = spotipy.Spotify(auth=access_token)
            # Test the token by getting user info
            user_info = client.me()
            logger.info("Successfully authenticated with Spotify for user: %s (ID: %s)", 
                       user_info.get('display_name', 'Unknown'), user_info.get('id'))
            return client
        except Exception as e:
            logger.error("Failed to create Spotify client: %s", str(e))
            raise

    def _clean_track_title(self, title: str) -> str:
        """
        Clean track title for better Spotify search results
        
        Args:
            title: Raw track title
            
        Returns:
            Cleaned track title
        """
        if not title:
            return ""
            
        # Remove common unwanted strings
        unwanted_patterns = [
            r'\(Original Mix\)',
            r'\(Radio Edit\)',
            r'\(Extended Mix\)',
            r'\(Club Mix\)',
            r'\(Remix\)',
            r'\[.*?\]',  # Remove anything in square brackets
            r'\(feat\..*?\)',  # Remove featuring info
            r'\(ft\..*?\)',
        ]
        
        cleaned = title
        for pattern in unwanted_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
        
        # Clean up extra spaces and trim
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        # Limit length for Spotify search (Spotify has query limits)
        if len(cleaned) > 100:
            cleaned = cleaned[:100].rsplit(' ', 1)[0]  # Cut at word boundary
            
        return cleaned

    def _search_track_on_spotify(self, spotify_client: spotipy.Spotify, 
                                track_title: str, artist_names: List[str], 
                                track_id: int) -> Optional[Dict[str, Any]]:
        """
        Search for a single track on Spotify with fallback strategies
        
        Args:
            spotify_client: Authenticated Spotify client
            track_title: Track title to search for
            artist_names: List of artist names
            track_id: Internal track ID for logging
            
        Returns:
            Best matching Spotify track or None
        """
        start_time = time.time()
        cleaned_title = self._clean_track_title(track_title)
        
        logger.info("Searching track ID %d: '%s' by %s", 
                   track_id, cleaned_title, ', '.join(artist_names))
        
        # Strategy 1: Search with title and primary artist
        if artist_names and cleaned_title:
            primary_artist = artist_names[0]
            query = f"track:\"{cleaned_title}\" artist:\"{primary_artist}\""
            logger.debug("Strategy 1 - Searching with query: %s", query)
            
            try:
                results = spotify_client.search(q=query, type='track', limit=10)
                tracks = results.get('tracks', {}).get('items', [])
                
                if tracks:
                    best_match = self._find_best_track_match(tracks, cleaned_title, artist_names)
                    if best_match:
                        search_time = time.time() - start_time
                        logger.info("✅ Found match for track ID %d using Strategy 1 (%.2fs): %s - %s", 
                                   track_id, search_time, best_match['name'], 
                                   ', '.join([artist['name'] for artist in best_match['artists']]))
                        return best_match
                        
            except Exception as e:
                logger.warning("Strategy 1 failed for track ID %d: %s", track_id, str(e))
        
        # Strategy 2: Search with title and all artists
        if artist_names and cleaned_title:
            all_artists = ' '.join(artist_names)
            query = f"track:\"{cleaned_title}\" artist:\"{all_artists}\""
            logger.debug("Strategy 2 - Searching with query: %s", query)
            
            try:
                results = spotify_client.search(q=query, type='track', limit=10)
                tracks = results.get('tracks', {}).get('items', [])
                
                if tracks:
                    best_match = self._find_best_track_match(tracks, cleaned_title, artist_names)
                    if best_match:
                        search_time = time.time() - start_time
                        logger.info("✅ Found match for track ID %d using Strategy 2 (%.2fs): %s - %s", 
                                   track_id, search_time, best_match['name'],
                                   ', '.join([artist['name'] for artist in best_match['artists']]))
                        return best_match
                        
            except Exception as e:
                logger.warning("Strategy 2 failed for track ID %d: %s", track_id, str(e))
        
        # Strategy 3: Search with title only (broader search)
        if cleaned_title:
            query = f"track:\"{cleaned_title}\""
            logger.debug("Strategy 3 - Searching with query: %s", query)
            
            try:
                results = spotify_client.search(q=query, type='track', limit=20)
                tracks = results.get('tracks', {}).get('items', [])
                
                if tracks:
                    best_match = self._find_best_track_match(tracks, cleaned_title, artist_names)
                    if best_match:
                        search_time = time.time() - start_time
                        logger.info("✅ Found match for track ID %d using Strategy 3 (%.2fs): %s - %s", 
                                   track_id, search_time, best_match['name'],
                                   ', '.join([artist['name'] for artist in best_match['artists']]))
                        return best_match
                        
            except Exception as e:
                logger.warning("Strategy 3 failed for track ID %d: %s", track_id, str(e))
        
        # Strategy 4: Simple search without quotes (most permissive)
        if cleaned_title and artist_names:
            query = f"{cleaned_title} {artist_names[0]}"[:100]  # Limit query length
            logger.debug("Strategy 4 - Searching with query: %s", query)
            
            try:
                results = spotify_client.search(q=query, type='track', limit=20)
                tracks = results.get('tracks', {}).get('items', [])
                
                if tracks:
                    best_match = self._find_best_track_match(tracks, cleaned_title, artist_names)
                    if best_match:
                        search_time = time.time() - start_time
                        logger.info("✅ Found match for track ID %d using Strategy 4 (%.2fs): %s - %s", 
                                   track_id, search_time, best_match['name'],
                                   ', '.join([artist['name'] for artist in best_match['artists']]))
                        return best_match
                        
            except Exception as e:
                logger.warning("Strategy 4 failed for track ID %d: %s", track_id, str(e))
        
        search_time = time.time() - start_time
        logger.warning("❌ No match found for track ID %d after all strategies (%.2fs): '%s' by %s", 
                      track_id, search_time, cleaned_title, ', '.join(artist_names))
        return None

    def _find_best_track_match(self, spotify_tracks: List[Dict], 
                              target_title: str, target_artists: List[str]) -> Optional[Dict[str, Any]]:
        """
        Find the best matching track from Spotify search results
        
        Args:
            spotify_tracks: List of Spotify track objects
            target_title: Target track title
            target_artists: List of target artist names
            
        Returns:
            Best matching track or None
        """
        if not spotify_tracks:
            return None
            
        best_match = None
        best_score = 0
        
        target_title_lower = target_title.lower()
        target_artists_lower = [artist.lower() for artist in target_artists]
        
        for track in spotify_tracks:
            score = 0
            track_title = track['name'].lower()
            track_artists = [artist['name'].lower() for artist in track['artists']]
            
            # Title similarity (60% weight)
            if target_title_lower in track_title or track_title in target_title_lower:
                score += 0.6
            elif any(word in track_title for word in target_title_lower.split() if len(word) > 3):
                score += 0.3
            
            # Artist similarity (40% weight)
            for target_artist in target_artists_lower:
                for track_artist in track_artists:
                    if target_artist in track_artist or track_artist in target_artist:
                        score += 0.4 / len(target_artists_lower)
                        break
            
            if score > best_score:
                best_score = score
                best_match = track
        
        # Only return matches with reasonable confidence
        if best_score >= 0.3:  # At least 30% similarity
            return best_match
            
        return None

    async def _search_tracks_concurrently(self, spotify_client: spotipy.Spotify, 
                                        track_data: List[Tuple[int, str, List[str]]]) -> List[Tuple[int, Optional[Dict[str, Any]]]]:
        """
        Search for multiple tracks concurrently on Spotify
        
        Args:
            spotify_client: Authenticated Spotify client
            track_data: List of tuples (track_id, title, artist_names)
            
        Returns:
            List of tuples (track_id, spotify_track_data or None)
        """
        logger.info("Starting concurrent track search for %d tracks with max_concurrent=%d", 
                   len(track_data), self.max_concurrent_searches)
        
        start_time = time.time()
        
        def search_single_track(track_info):
            track_id, title, artists = track_info
            return (track_id, self._search_track_on_spotify(spotify_client, title, artists, track_id))
        
        # Use ThreadPoolExecutor for concurrent API calls
        with ThreadPoolExecutor(max_workers=self.max_concurrent_searches) as executor:
            # Submit all search tasks
            future_to_track = {
                executor.submit(search_single_track, track_info): track_info[0] 
                for track_info in track_data
            }
            
            results = []
            completed = 0
            
            # Collect results as they complete
            for future in asyncio.as_completed([asyncio.wrap_future(f) for f in future_to_track]):
                try:
                    result = await future
                    results.append(result)
                    completed += 1
                    
                    # Log progress every 10 tracks or at the end
                    if completed % 10 == 0 or completed == len(track_data):
                        logger.info("Search progress: %d/%d tracks completed (%.1f%%)", 
                                   completed, len(track_data), (completed / len(track_data)) * 100)
                        
                except Exception as e:
                    track_id = future_to_track.get(future, 'unknown')
                    logger.error("Error searching track ID %s: %s", track_id, str(e))
                    results.append((track_id, None))
        
        total_time = time.time() - start_time
        successful_searches = sum(1 for _, result in results if result is not None)
        
        logger.info("Concurrent search completed: %d/%d tracks found (%.1f%%) in %.2fs (avg %.2fs per track)", 
                   successful_searches, len(track_data), 
                   (successful_searches / len(track_data)) * 100 if track_data else 0,
                   total_time, total_time / len(track_data) if track_data else 0)
        
        return results

    async def _add_tracks_to_playlist(self, spotify_client: spotipy.Spotify, 
                                    playlist_id: str, track_uris: List[str]) -> None:
        """
        Add tracks to Spotify playlist in batches
        
        Args:
            spotify_client: Authenticated Spotify client
            playlist_id: Spotify playlist ID
            track_uris: List of Spotify track URIs to add
        """
        logger.info("Adding %d tracks to Spotify playlist %s", len(track_uris), playlist_id)
        
        # Add tracks in batches (Spotify limit is 100 tracks per request)
        for i in range(0, len(track_uris), self.batch_size):
            batch = track_uris[i:i + self.batch_size]
            batch_num = (i // self.batch_size) + 1
            total_batches = (len(track_uris) + self.batch_size - 1) // self.batch_size
            
            logger.info("Adding batch %d/%d (%d tracks) to playlist", 
                       batch_num, total_batches, len(batch))
            
            try:
                spotify_client.playlist_add_items(playlist_id, batch)
                logger.info("✅ Successfully added batch %d/%d to playlist", batch_num, total_batches)
            except Exception as e:
                logger.error("❌ Failed to add batch %d/%d to playlist: %s", batch_num, total_batches, str(e))
                raise

    async def transfer_playlist_to_spotify(self, db: AsyncSession, playlist_id: str, 
                                         access_token: str, custom_playlist_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Transfer a ResomiX playlist to Spotify
        
        Args:
            db: Database session
            playlist_id: ResomiX playlist UUID
            access_token: Spotify OAuth access token
            custom_playlist_name: Optional custom name for Spotify playlist
            
        Returns:
            Transfer result with statistics and details
        """
        logger.info("=== STARTING SPOTIFY PLAYLIST TRANSFER ===")
        logger.info("Playlist ID: %s", playlist_id)
        logger.info("Custom name: %s", custom_playlist_name or "None (will use ResomiX playlist name)")
        
        transfer_start_time = time.time()
        
        try:
            # Step 1: Get playlist from database
            logger.info("Step 1: Fetching playlist from database...")
            playlist = await self.playlist_repository.get_playlist_by_id(db, playlist_id)
            if not playlist:
                logger.error("❌ Playlist not found: %s", playlist_id)
                raise ValueError(f"Playlist with ID {playlist_id} not found")
            
            logger.info("✅ Found playlist: '%s' (ID: %s)", playlist.name, playlist.id)
            
            # Step 2: Get tracks for playlist
            logger.info("Step 2: Fetching tracks for playlist...")
            tracks = await self.playlist_repository.get_tracks_for_playlist(db, playlist_id)
            if not tracks:
                logger.warning("❌ Playlist has no tracks: %s", playlist_id)
                raise ValueError(f"Playlist {playlist_id} has no tracks to transfer")
            
            logger.info("✅ Found %d tracks in playlist", len(tracks))
            
            # Step 3: Get artist information for each track
            logger.info("Step 3: Fetching artist information for tracks...")
            track_data = []
            for track in tracks:
                artists = await self.track_repository.async_get_track_artists(db, track.id)
                artist_names = [artist.name for artist in artists] if artists else ["Unknown Artist"]
                track_data.append((track.id, track.title or "Unknown Track", artist_names))
                
            logger.info("✅ Prepared %d tracks with artist information", len(track_data))
            
            # Step 4: Create Spotify client
            logger.info("Step 4: Authenticating with Spotify...")
            spotify_client = self._create_spotify_client(access_token)
            
            # Step 5: Create Spotify playlist
            logger.info("Step 5: Creating Spotify playlist...")
            playlist_name = custom_playlist_name or f"ResomiX - {playlist.name}"
            user_info = spotify_client.me()
            user_id = user_info['id']
            
            logger.info("Creating playlist '%s' for user %s", playlist_name, user_id)
            
            spotify_playlist = spotify_client.user_playlist_create(
                user=user_id,
                name=playlist_name,
                public=False,  # Create as private by default
                description=f"Transferred from ResomiX playlist '{playlist.name}'"
            )
            
            spotify_playlist_id = spotify_playlist['id']
            spotify_playlist_url = spotify_playlist['external_urls']['spotify']
            
            logger.info("✅ Created Spotify playlist: %s (ID: %s)", playlist_name, spotify_playlist_id)
            logger.info("Playlist URL: %s", spotify_playlist_url)
            
            # Step 6: Search for tracks on Spotify (concurrent)
            logger.info("Step 6: Searching for tracks on Spotify...")
            search_results = await self._search_tracks_concurrently(spotify_client, track_data)
            
            # Step 7: Process search results
            logger.info("Step 7: Processing search results...")
            found_tracks = []
            not_found_tracks = []
            
            for track_id, spotify_track in search_results:
                if spotify_track:
                    found_tracks.append(spotify_track['uri'])
                else:
                    # Find original track info for not found list
                    original_track = next((t for t in track_data if t[0] == track_id), None)
                    if original_track:
                        _, title, artists = original_track
                        not_found_tracks.append(f"{', '.join(artists)} - {title}")
            
            logger.info("Search results: %d found, %d not found", len(found_tracks), len(not_found_tracks))
            
            # Step 8: Add found tracks to Spotify playlist
            if found_tracks:
                logger.info("Step 8: Adding %d tracks to Spotify playlist...", len(found_tracks))
                await self._add_tracks_to_playlist(spotify_client, spotify_playlist_id, found_tracks)
                logger.info("✅ Successfully added tracks to Spotify playlist")
            else:
                logger.warning("⚠️  No tracks were found on Spotify to add to playlist")
            
            # Step 9: Prepare response
            total_time = time.time() - transfer_start_time
            logger.info("Step 9: Preparing response...")
            
            result = {
                "spotify_playlist_id": spotify_playlist_id,
                "spotify_playlist_url": spotify_playlist_url,
                "spotify_playlist_name": playlist_name,
                "total_tracks": len(tracks),
                "tracks_added": len(found_tracks),
                "tracks_not_found": len(not_found_tracks),
                "not_found_tracks": not_found_tracks[:10],  # Limit to first 10 for response size
                "transfer_time_seconds": round(total_time, 2)
            }
            
            logger.info("=== TRANSFER COMPLETED SUCCESSFULLY ===")
            logger.info("Total time: %.2f seconds", total_time)
            logger.info("Success rate: %.1f%% (%d/%d tracks found)", 
                       (len(found_tracks) / len(tracks)) * 100, len(found_tracks), len(tracks))
            logger.info("Spotify playlist: %s", spotify_playlist_url)
            
            return result
            
        except Exception as e:
            total_time = time.time() - transfer_start_time
            logger.error("=== TRANSFER FAILED ===")
            logger.error("Error after %.2f seconds: %s", total_time, str(e))
            logger.error("Exception type: %s", type(e).__name__)
            raise
