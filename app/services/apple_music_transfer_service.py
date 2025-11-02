"""
Apple Music Transfer Service
============================

This service handles the transfer of Resomix playlists to Apple Music.
It manages developer token generation (JWT ES256), track searching on Apple Music,
and playlist creation using the Apple Music API.

Provides functionality to search for tracks on Apple Music (by ISRC or title+artist),
create playlists, and handle the complete playlist transfer workflow.

Version: 3.0.1
Init Date: December 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
import jwt  # PyJWT
import time
import json
import logging
import requests
from concurrent.futures import ThreadPoolExecutor
import asyncio
import os

from app.core.config import settings
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository
from app.repositories.playlist_transfer_track_repository import PlaylistTransferTrackRepository

# Set up logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Apple Music API constants
APPLE_API = "https://api.music.apple.com"
APPLE_AUDIENCE = "https://music.apple.com"

# Token cache for developer tokens
_token_cache: Dict[str, Any] = {
    "token": None,
    "exp_ms": 0,
}


class AppleMusicTransferService:
    """Service for transferring Resomix playlists to Apple Music"""
    
    def __init__(self):
        """Initialize the Apple Music transfer service"""
        self.playlist_repository = PlaylistRepository()
        self.track_repository = TrackRepository()
        self.transfer_track_repository = PlaylistTransferTrackRepository()
        self.max_concurrent_searches = 2  # Process 2 tracks at a time
        
        logger.info("AppleMusicTransferService initialized")
    
    def _load_private_key(self) -> str:
        """
        Load Apple private key from file or environment variable
        
        Returns:
            Private key PEM content
            
        Raises:
            RuntimeError: If private key cannot be loaded
        """
        if settings.apple_private_key_pem:
            return settings.apple_private_key_pem
        if settings.apple_private_key_path:
            if os.path.exists(settings.apple_private_key_path):
                try:
                    with open(settings.apple_private_key_path, "r") as f:
                        return f.read()
                except Exception as e:
                    raise RuntimeError(f"Failed to read Apple private key from {settings.apple_private_key_path}: {e}")
            else:
                raise RuntimeError(
                    f"Apple private key file not found at {settings.apple_private_key_path}. "
                    f"Please ensure the file exists or set APPLE_PRIVATE_KEY_PEM environment variable."
                )
        raise RuntimeError("Missing Apple private key (set APPLE_PRIVATE_KEY_PATH or APPLE_PRIVATE_KEY_PEM)")
    
    def _generate_developer_token(self) -> Tuple[str, int]:
        """
        Generate Apple Music developer token (JWT ES256)
        
        Returns:
            Tuple of (token, expires_at_ms)
        """
        if not settings.apple_team_id or not settings.apple_key_id:
            raise RuntimeError("APPLE_TEAM_ID and APPLE_KEY_ID are required")
        if not settings.apple_team_id.strip() or not settings.apple_key_id.strip():
            raise RuntimeError("APPLE_TEAM_ID and APPLE_KEY_ID cannot be empty or whitespace-only")
        
        private_key = self._load_private_key()
        now = int(time.time())
        payload = {
            "iss": settings.apple_team_id,
            "iat": now,
            "exp": now + settings.apple_token_ttl,
            "aud": APPLE_AUDIENCE,
        }
        headers = {
            "alg": "ES256",
            "kid": settings.apple_key_id,
        }
        token = jwt.encode(payload, private_key, algorithm="ES256", headers=headers)
        if isinstance(token, bytes):
            token = token.decode("utf-8")
        expires_at_ms = (now + settings.apple_token_ttl) * 1000
        return token, expires_at_ms
    
    def get_or_create_dev_token(self) -> Tuple[str, int]:
        """
        Returns cached or newly generated developer token and expiry in ms.
        Regenerates if expiring within 5 minutes.
        
        Returns:
            Tuple of (token, expires_at_ms)
        """
        now_ms = int(time.time() * 1000)
        if _token_cache["token"] and now_ms < _token_cache["exp_ms"] - 5 * 60 * 1000:
            return _token_cache["token"], _token_cache["exp_ms"]
        
        token, exp_ms = self._generate_developer_token()
        _token_cache["token"] = token
        _token_cache["exp_ms"] = exp_ms
        return token, exp_ms
    
    def _apple_headers(self, dev_token: str, user_token: Optional[str] = None) -> Dict[str, str]:
        """
        Create headers for Apple Music API requests
        
        Args:
            dev_token: Developer token
            user_token: Optional user token for library operations
            
        Returns:
            Dictionary of headers
        """
        h = {
            "Authorization": f"Bearer {dev_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if user_token:
            h["Music-User-Token"] = user_token
        return h
    
    async def _search_song(self, dev_token: str, isrc: Optional[str] = None, 
                          title: Optional[str] = None, artist: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Search for a catalog song on Apple Music:
          1) By ISRC (fast and accurate)
          2) By search term "title artist" (best effort)
        
        Args:
            dev_token: Developer token
            isrc: ISRC code (optional)
            title: Track title (optional)
            artist: Artist name (optional)
            
        Returns:
            First matched song object with id and type 'songs' or None
        """
        loop = asyncio.get_event_loop()
        session = requests.Session()
        
        # 1) ISRC filter
        if isrc:
            url = f"{APPLE_API}/v1/catalog/{settings.apple_storefront}/songs"
            params = {"filter[isrc]": isrc, "limit": 1}
            try:
                r = await loop.run_in_executor(
                    None,
                    lambda: session.get(url, headers=self._apple_headers(dev_token), params=params, timeout=30)
                )
                if r.ok:
                    js = r.json()
                    items = js.get("data") or []
                    if items:
                        return items[0]
            except Exception as e:
                logger.warning("ISRC search failed: %s", str(e))
        
        # 2) Search by title+artist
        if title and artist:
            term = f"{title} {artist}"
        elif title:
            term = title
        else:
            return None
        
        if term:
            url = f"{APPLE_API}/v1/catalog/{settings.apple_storefront}/search"
            params = {"term": term, "limit": 3, "types": "songs"}
            try:
                r = await loop.run_in_executor(
                    None,
                    lambda: session.get(url, headers=self._apple_headers(dev_token), params=params, timeout=30)
                )
                if r.ok:
                    js = r.json()
                    songs = (((js.get("results") or {}).get("songs") or {}).get("data")) or []
                    if songs:
                        return songs[0]
            except Exception as e:
                logger.warning("Search failed for '%s' by '%s': %s", title, artist, str(e))
        
        return None
    
    async def _search_tracks_concurrently(self, dev_token: str, 
                                         track_data: List[Tuple[int, Optional[str], str, str]]) -> List[Tuple[int, Optional[str]]]:
        """
        Search for multiple tracks concurrently on Apple Music
        
        Args:
            dev_token: Developer token
            track_data: List of tuples (track_id, isrc, title, artist)
            
        Returns:
            List of tuples (track_id, apple_music_id or None)
        """
        logger.info("Searching %d tracks concurrently", len(track_data))
        
        start_time = time.time()
        
        def search_single_track(track_info):
            track_id, isrc, title, artist = track_info
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    self._search_song(dev_token, isrc=isrc, title=title, artist=artist)
                )
                apple_music_id = result.get("id") if result else None
                return (track_id, apple_music_id)
            finally:
                loop.close()
        
        # Use ThreadPoolExecutor for concurrent API calls
        with ThreadPoolExecutor(max_workers=self.max_concurrent_searches) as executor:
            future_to_track = {
                executor.submit(search_single_track, track_info): track_info[0] 
                for track_info in track_data
            }
            
            results = []
            for future in asyncio.as_completed([asyncio.wrap_future(f) for f in future_to_track]):
                try:
                    result = await future
                    results.append(result)
                except Exception as e:
                    track_id = future_to_track.get(future, 'unknown')
                    logger.error("Error searching track ID %s: %s", track_id, str(e))
                    results.append((track_id, None))
        
        total_time = time.time() - start_time
        successful_searches = sum(1 for _, result in results if result is not None)
        
        logger.info("Search completed: %d/%d tracks found in %.1fs", 
                   successful_searches, len(track_data), total_time)
        
        return results
    
    async def _get_cached_apple_music_ids(self, db: AsyncSession, track_ids: List[int]) -> Dict[int, str]:
        """
        Get cached Apple Music IDs for tracks
        
        Args:
            db: Database session
            track_ids: List of track IDs to check
            
        Returns:
            Dictionary mapping track_id -> apple_music_id for cached entries
        """
        try:
            cached_ids = await self.transfer_track_repository.async_get_apple_music_ids(db, track_ids)
            if cached_ids:
                logger.info("Found %d cached Apple Music IDs", len(cached_ids))
            return cached_ids
        except Exception as e:
            logger.error("Failed to get cached Apple Music IDs: %s", str(e))
            return {}
    
    async def _update_apple_music_cache(self, db: AsyncSession, track_apple_music_map: Dict[int, str]) -> None:
        """
        Update cache with newly found Apple Music IDs
        
        Args:
            db: Database session
            track_apple_music_map: Dictionary mapping track_id -> apple_music_id
        """
        if not track_apple_music_map:
            return
            
        try:
            await self.transfer_track_repository.async_batch_upsert_apple_music_ids(db, track_apple_music_map)
            logger.info("Cached %d new Apple Music IDs", len(track_apple_music_map))
        except Exception as e:
            logger.error("Failed to cache Apple Music IDs: %s", str(e))
    
    async def _create_playlist(self, dev_token: str, user_token: str, name: str, 
                              description: Optional[str] = None) -> str:
        """
        Creates a library playlist and returns its library id
        
        Args:
            dev_token: Developer token
            user_token: User token
            name: Playlist name
            description: Optional description
            
        Returns:
            Playlist ID
        """
        url = f"{APPLE_API}/v1/me/library/playlists"
        payload = {"attributes": {"name": name}}
        if description:
            payload["attributes"]["description"] = description
        
        loop = asyncio.get_event_loop()
        r = await loop.run_in_executor(
            None,
            lambda: requests.post(url, headers=self._apple_headers(dev_token, user_token), 
                                data=json.dumps(payload), timeout=30)
        )
        
        if not r.ok:
            raise ValueError(f"Failed to create playlist: {r.text}")
        
        js = r.json()
        data = js.get("data") or []
        if not data:
            raise ValueError(f"Empty response while creating playlist: {js}")
        playlist_id = data[0].get("id")
        if not playlist_id:
            raise ValueError(f"No playlist id returned: {js}")
        return playlist_id
    
    async def _add_tracks_to_playlist(self, dev_token: str, user_token: str, 
                                     playlist_id: str, catalog_song_ids: List[str]) -> int:
        """
        Adds catalog songs to a user library playlist in batches of 100
        
        Args:
            dev_token: Developer token
            user_token: User token
            playlist_id: Playlist ID
            catalog_song_ids: List of catalog song IDs
            
        Returns:
            Number of tracks added
        """
        if not catalog_song_ids:
            return 0
        
        url = f"{APPLE_API}/v1/me/library/playlists/{playlist_id}/tracks"
        batch_size = 100
        tracks_added = 0
        loop = asyncio.get_event_loop()
        
        for i in range(0, len(catalog_song_ids), batch_size):
            batch = catalog_song_ids[i:i + batch_size]
            payload = {"data": [{"id": sid, "type": "songs"} for sid in batch]}
            
            try:
                r = await loop.run_in_executor(
                    None,
                    lambda: requests.post(url, headers=self._apple_headers(dev_token, user_token), 
                                        data=json.dumps(payload), timeout=30)
                )
                if not r.ok:
                    logger.error("Failed to add tracks batch %d: %s", (i // batch_size) + 1, r.text)
                    continue
                tracks_added += len(batch)
            except Exception as e:
                logger.error("Exception adding tracks batch %d: %s", (i // batch_size) + 1, str(e))
        
        logger.info("Successfully added %d tracks to playlist", tracks_added)
        return tracks_added
    
    async def transfer_playlist_to_apple_music(self, db: AsyncSession, playlist_id: str, 
                                               music_user_token: str, 
                                               custom_playlist_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Transfer a Resomix playlist to Apple Music
        
        Args:
            db: Database session
            playlist_id: Resomix playlist UUID
            music_user_token: Apple Music User Token
            custom_playlist_name: Optional custom name for Apple Music playlist
            
        Returns:
            Transfer result with statistics and details
        """
        logger.info("Starting Apple Music playlist transfer...")
        
        transfer_start_time = time.time()
        
        try:
            # Step 1: Generate developer token (always generated server-side, never from client)
            dev_token, _ = self.get_or_create_dev_token()
            
            # Step 2: Get playlist from database
            logger.info("Fetching playlist from database...")
            playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            if not playlist:
                logger.error("Playlist not found: %s", playlist_id)
                raise ValueError(f"Playlist with ID {playlist_id} not found")
            
            # Step 3: Get tracks for playlist
            logger.info("Fetching tracks for playlist...")
            playlist_tracks = await self.playlist_repository.async_get_tracks_by_playlist_id(db, playlist.id)
            if not playlist_tracks:
                logger.warning("Playlist has no tracks: %s", playlist_id)
                raise ValueError(f"Playlist {playlist_id} has no tracks to transfer")
            
            logger.info("Found %d tracks in playlist '%s'", len(playlist_tracks), playlist.name)
            
            # Step 4: Get track information (title, artist, ISRC if available)
            track_data = []
            for playlist_track in playlist_tracks:
                track = await self.track_repository.async_get_by_id(db, playlist_track.track_id)
                if track:
                    artists = await self.track_repository.async_get_track_artists(db, track.id)
                    artist_names = [artist.name for artist in artists] if artists else ["Unknown Artist"]
                    # Note: ISRC is not currently stored in tracks table, but can be added later
                    isrc = None  # Could be track.isrc if added to model
                    track_data.append((track.id, isrc, track.title or "Unknown Track", artist_names[0]))
            
            # Step 5: Check cache for existing Apple Music IDs
            track_ids = [track_id for track_id, _, _, _ in track_data]
            cached_apple_music_ids = await self._get_cached_apple_music_ids(db, track_ids)
            
            # Step 6: Separate cached and uncached tracks
            cached_tracks = []
            uncached_tracks = []
            
            for track_id, isrc, title, artist in track_data:
                if track_id in cached_apple_music_ids:
                    cached_tracks.append((track_id, cached_apple_music_ids[track_id]))
                else:
                    uncached_tracks.append((track_id, isrc, title, artist))
            
            # Step 7: Search for uncached tracks
            search_results = []
            new_apple_music_ids = {}
            
            if uncached_tracks:
                search_results = await self._search_tracks_concurrently(dev_token, uncached_tracks)
                
                # Collect newly found Apple Music IDs for caching
                for track_id, apple_music_id in search_results:
                    if apple_music_id:
                        new_apple_music_ids[track_id] = apple_music_id
            
            # Step 8: Update cache with newly found Apple Music IDs
            if new_apple_music_ids:
                await self._update_apple_music_cache(db, new_apple_music_ids)
            
            # Step 9: Process all results (cached + searched)
            matched_ids = []
            unmatched_tracks = []
            
            # Add cached tracks
            for track_id, apple_music_id in cached_tracks:
                matched_ids.append(apple_music_id)
            
            # Add searched tracks
            for track_id, apple_music_id in search_results:
                if apple_music_id:
                    matched_ids.append(apple_music_id)
                else:
                    # Find original track info for not found list
                    original_track = next((t for t in track_data if t[0] == track_id), None)
                    if original_track:
                        _, _, title, artist = original_track
                        unmatched_tracks.append({"title": title, "artist": artist})
            
            logger.info("Found %d tracks (%d cached + %d searched), %d not found", 
                       len(matched_ids), len(cached_tracks), len(new_apple_music_ids), len(unmatched_tracks))
            
            # Step 10: Create Apple Music playlist
            playlist_name = custom_playlist_name or f"Resomix - {playlist.name}"
            logger.info("Creating Apple Music playlist...")
            apple_playlist_id = await self._create_playlist(
                dev_token, 
                music_user_token, 
                playlist_name, 
                description=f"Transferred from Resomix playlist '{playlist.name}'"
            )
            
            # Step 11: Add tracks to playlist
            tracks_added = 0
            if matched_ids:
                tracks_added = await self._add_tracks_to_playlist(
                    dev_token, 
                    music_user_token, 
                    apple_playlist_id, 
                    matched_ids
                )
            else:
                logger.warning("No tracks found on Apple Music to add to playlist")
            
            # Prepare response
            total_time = time.time() - transfer_start_time
            
            result = {
                "created_playlist_id": apple_playlist_id,
                "created_playlist_name": playlist_name,
                "storefront": settings.apple_storefront,
                "total_tracks": len(playlist_tracks),
                "matched": len(matched_ids),
                "tracks_added": tracks_added,
                "unmatched": len(unmatched_tracks),
                "unmatched_examples": unmatched_tracks[:5],
                "transfer_time_seconds": round(total_time, 2)
            }
            
            logger.info("Transfer completed successfully in %.1fs - %d/%d tracks added", 
                       total_time, tracks_added, len(playlist_tracks))
            
            return result
            
        except Exception as e:
            total_time = time.time() - transfer_start_time
            logger.error("Transfer failed after %.1fs: %s", total_time, str(e))
            raise

