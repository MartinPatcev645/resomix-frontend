"""
Tidal Transfer Service
======================

This service handles the transfer of ResomiX playlists to Tidal.
It manages authentication, track searching on Tidal, and playlist creation
using unofficial Tidal API endpoints with proper OAuth2 PKCE flow.

Provides functionality to search for tracks on Tidal, create playlists,
and handle the complete playlist transfer workflow.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import aiohttp
import json
import logging
import time
from urllib.parse import urlencode, quote

from app.core.config import settings
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository
from app.repositories.playlist_transfer_track_repository import PlaylistTransferTrackRepository
from app.utils.playlist_transfer_utils import (
    clean_search_query, calculate_similarity_score, search_tracks_concurrently,
    format_transfer_response, format_success_message, validate_track_data,
    batch_list, get_platform_error_message, log_transfer_progress
)
from app.utils.logging_utils import log_request

# Set up logger specifically for Tidal transfer
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Create console handler with formatting
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [TIDAL_TRANSFER] %(message)s'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)


class TidalTransferService:
    """Service for transferring ResomiX playlists to Tidal"""
    
    def __init__(self):
        """Initialize the Tidal transfer service"""
        self.playlist_repository = PlaylistRepository()
        self.track_repository = TrackRepository()
        self.transfer_track_repository = PlaylistTransferTrackRepository()
        
        # Tidal API configuration
        self.api_base_url = "https://openapi.tidal.com"
        self.listen_base_url = "https://listen.tidal.com"
        self.api_version = "v2"
        self.client_id = settings.tidal_client_id
        
        # Concurrent processing settings
        self.max_concurrent_searches = 2  # Process 2 tracks at a time
        
        logger.info("TidalTransferService initialization complete")

    def _get_headers(self, access_token: str) -> Dict[str, str]:
        """
        Get headers for Tidal API requests
        
        Args:
            access_token: Valid Tidal OAuth access token
            
        Returns:
            Headers dictionary
        """
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "User-Agent": "ResomiX/1.0"
        }

    async def _make_api_request(self, session: aiohttp.ClientSession, method: str, 
                              url: str, headers: Dict[str, str], **kwargs) -> Dict[str, Any]:
        """
        Make an API request to Tidal
        
        Args:
            session: aiohttp session
            method: HTTP method
            url: Request URL
            headers: Request headers
            **kwargs: Additional request parameters
            
        Returns:
            Response JSON data
            
        Raises:
            Exception: If request fails
        """
        try:
            async with session.request(method, url, headers=headers, **kwargs) as response:
                if response.status == 401:
                    raise ValueError("Invalid or expired Tidal access token")
                elif response.status == 403:
                    raise ValueError("Tidal access denied. Please check your permissions.")
                elif response.status == 429:
                    raise ValueError("Tidal API rate limit exceeded. Please try again later.")
                elif response.status >= 400:
                    error_text = await response.text()
                    raise Exception(f"Tidal API error {response.status}: {error_text}")
                
                return await response.json()
                
        except aiohttp.ClientError as e:
            raise Exception(f"Network error connecting to Tidal: {str(e)}")

    async def _search_tidal_track(self, session: aiohttp.ClientSession, access_token: str, 
                                title: str, artist: str) -> Optional[str]:
        """
        Search for a track on Tidal and return the best match ID.
        
        Args:
            session: aiohttp session
            access_token: Tidal access token
            title: Track title
            artist: Track artist
            
        Returns:
            Tidal track ID if found, None otherwise
        """
        try:
            # Create search query
            query = clean_search_query(title, artist)
            
            if not query.strip():
                return None
            
            # Tidal search endpoint (using official API v2)
            search_url = f"{self.api_base_url}/{self.api_version}/searchresults"
            params = {
                "query": query,
                "type": "track",
                "limit": 10,
                "countryCode": "US"  # Default to US, could be configurable
            }
            
            headers = self._get_headers(access_token)
            
            response_data = await self._make_api_request(
                session, "GET", search_url, headers, params=params
            )
            
            # Parse Tidal API v2 response format
            tracks = response_data.get("data", [])
            if not tracks:
                # Try searching with just the title if no results
                title_only_query = clean_search_query(title, "")
                if title_only_query.strip() and title_only_query != query:
                    params["query"] = title_only_query
                    response_data = await self._make_api_request(
                        session, "GET", search_url, headers, params=params
                    )
                    tracks = response_data.get("data", [])
            
            if not tracks:
                return None
            
            # Find the best match
            best_match = None
            best_score = 0
            
            for track in tracks:
                # Get track details
                track_title = track.get("attributes", {}).get("title", "")
                
                # Get artist names from relationships
                track_artists = []
                if "relationships" in track and "artists" in track["relationships"]:
                    artists_data = track["relationships"]["artists"].get("data", [])
                    # We need to get artist names from included data or make separate requests
                    # For now, we'll use a simplified approach
                    if artists_data:
                        track_artists = [f"Artist_{artist.get('id', '')}" for artist in artists_data]
                
                track_artist = ", ".join(track_artists) if track_artists else ""
                
                # Calculate similarity score
                similarity = calculate_similarity_score(title, artist, track_title, track_artist)
                
                if similarity > best_score:
                    best_score = similarity
                    best_match = track
            
            # Return the best match if similarity is above threshold
            if best_match and best_score > 0.5:  # 50% similarity threshold
                return best_match.get("id")
            
            return None
            
        except Exception as e:
            logger.error(f"Error searching Tidal for '{artist} - {title}': {str(e)}")
            return None

    async def _get_cached_tidal_ids(self, db: AsyncSession, track_ids: List[int]) -> Dict[int, str]:
        """
        Get cached Tidal IDs for tracks
        
        Args:
            db: Database session
            track_ids: List of track IDs
            
        Returns:
            Dictionary mapping track_id -> tidal_id
        """
        try:
            return await self.transfer_track_repository.async_get_tidal_ids(db, track_ids)
        except Exception as e:
            logger.error(f"Failed to get cached Tidal IDs: {str(e)}")
            return {}

    async def _search_tracks_concurrently(self, access_token: str, 
                                        track_data: List[Tuple[int, str, str]]) -> List[Tuple[int, Optional[str]]]:
        """
        Search for multiple tracks on Tidal concurrently
        
        Args:
            access_token: Tidal access token
            track_data: List of tuples (track_id, title, artist)
            
        Returns:
            List of tuples (track_id, tidal_id) where tidal_id is None if not found
        """
        if not track_data:
            return []
        
        # Validate track data
        valid_tracks = validate_track_data(track_data)
        if not valid_tracks:
            return []
        
        logger.info(f"Searching for {len(valid_tracks)} tracks on Tidal...")
        
        async with aiohttp.ClientSession() as session:
            # Create search function for concurrent execution
            async def search_function(title: str, artist: str) -> Optional[str]:
                return await self._search_tidal_track(session, access_token, title, artist)
            
            # Execute concurrent searches
            results = await search_tracks_concurrently(
                search_function, valid_tracks, self.max_concurrent_searches
            )
        
        return results

    async def _update_tidal_cache(self, db: AsyncSession, track_tidal_map: Dict[int, str]) -> None:
        """
        Update cache with newly found Tidal IDs
        
        Args:
            db: Database session
            track_tidal_map: Dictionary mapping track_id -> tidal_id
        """
        if not track_tidal_map:
            return
            
        try:
            await self.transfer_track_repository.async_batch_upsert_tidal_ids(db, track_tidal_map)
            logger.info("Cached %d new Tidal IDs", len(track_tidal_map))
        except Exception as e:
            logger.error("Failed to cache Tidal IDs: %s", str(e))

    async def _get_user_info(self, access_token: str) -> dict:
        """
        Get the Tidal user info from /users/me endpoint (id and subscriptionStatus).
        """
        async with aiohttp.ClientSession() as session:
            url = "https://api.tidal.com/v2/users/me"
            headers = self._get_headers(access_token)
            response = await self._make_api_request(session, "GET", url, headers)
            logger.info("/users/me API response: %s", response)
            return response

    async def _check_subscription_status(self, user_info: dict) -> None:
        """
        Check the user's Tidal subscription status using the user info dict.
        Raises an exception if the user is not ACTIVE or TRIAL.
        """
        status = user_info.get("subscriptionStatus")
        if status not in ("ACTIVE", "TRIAL"):
            raise ValueError(f"Tidal user does not have an active or trial subscription. Subscription status: {status}")

    async def _create_tidal_playlist(self, session: aiohttp.ClientSession, access_token: str,
                                   playlist_name: str, description: str = "", user_id: str = None) -> Dict[str, Any]:
        """
        Create a new playlist on Tidal using the official API v2 endpoint.
        """
        if not user_id:
            user_info = await self._get_user_info(access_token)
            user_id = user_info.get("id")
            if not user_id:
                raise Exception("Failed to retrieve Tidal userId from /users/me.")
        create_url = f"https://api.tidal.com/v2/users/{user_id}/playlists"
        payload = {
            "title": playlist_name,
            "description": description,
            "publicPlaylist": False  # Create as private by default
        }
        headers = self._get_headers(access_token)
        response_data = await self._make_api_request(
            session, "POST", create_url, headers, json=payload
        )
        playlist_id = response_data.get("id")
        if not playlist_id:
            raise Exception("Failed to create Tidal playlist: No playlist ID returned")
        return {
            "id": playlist_id,
            "name": playlist_name,
            "url": f"https://listen.tidal.com/playlist/{playlist_id}"
        }

    async def _add_tracks_to_tidal_playlist(self, session: aiohttp.ClientSession, 
                                          access_token: str, playlist_id: str, 
                                          track_ids: List[str]) -> int:
        """
        Add tracks to Tidal playlist using the official API v2 endpoint.
        """
        if not track_ids:
            return 0
        logger.info("Adding %d tracks to Tidal playlist", len(track_ids))
        add_url = f"https://api.tidal.com/v2/playlists/{playlist_id}/items"
        headers = self._get_headers(access_token)
        tracks_added = 0
        batch_size = 100  # Official API allows up to 100 per call
        batches = batch_list(track_ids, batch_size)
        for i, batch in enumerate(batches):
            try:
                payload = {
                    "trackIds": batch
                }
                await self._make_api_request(
                    session, "POST", add_url, headers, json=payload
                )
                tracks_added += len(batch)
                log_transfer_progress(logger, "Adding tracks to playlist", i + 1, len(batches))
            except Exception as e:
                logger.error(f"Failed to add batch {i + 1}: {str(e)}")
        logger.info("Successfully added %d tracks to Tidal playlist", tracks_added)
        return tracks_added

    async def exchange_authorization_code(self, authorization_code: str, redirect_uri: str, 
                                        code_verifier: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token using server-side client credentials
        Also checks the user's subscription status after token exchange.
        """
        if not self.client_id:
            raise ValueError("Tidal client ID not configured")
        
        logger.info("Exchanging authorization code for access token")
        
        async with aiohttp.ClientSession() as session:
            token_url = "https://auth.tidal.com/v1/oauth2/token"
            
            # Prepare token exchange request (PKCE: no client_secret)
            token_data = {
                "grant_type": "authorization_code",
                "client_id": self.client_id,
                "code": authorization_code,
                "redirect_uri": redirect_uri,  # must be raw, unencoded
                "code_verifier": code_verifier
            }
            token_payload = urlencode(token_data)
            logger.info("Token exchange payload (decoded): %s", token_data)
            logger.info("Token exchange payload (encoded): %s", token_payload)
            
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "ResomiX/1.0"
            }
            
            try:
                async with session.post(token_url, data=token_payload, headers=headers) as response:
                    response_text = await response.text()
                    response_headers = dict(response.headers)
                    logger.info("Tidal token exchange raw response: status=%d, headers=%s, body=%s", response.status, response_headers, response_text)
                    # Try to parse JSON, but log if it fails
                    try:
                        token_response = json.loads(response_text)
                        logger.info("Tidal token exchange parsed JSON: %s", token_response)
                    except Exception as e:
                        logger.error("Failed to parse Tidal token response as JSON: %s", e)
                        token_response = None
                    
                    # Validate response has required fields
                    if not token_response.get("access_token"):
                        logger.error("Token exchange response missing access_token: %s", token_response)
                        raise ValueError("Invalid token response from Tidal")
                    
                    # Get user info once and check subscription
                    try:
                        user_info = await self._get_user_info(token_response["access_token"])
                        logger.info("Tidal /users/me response: %s", user_info)
                        logger.info("Tidal subscription status: %s", user_info.get("subscriptionStatus"))
                        await self._check_subscription_status(user_info)
                    except Exception as e:
                        logger.error("Error during user info fetch or subscription check: %s", e, exc_info=True)
                        raise
                    
                    # Log the successful token response for debugging
                    logger.info("Successfully obtained Tidal access token")
                    logger.info("Access token (first 20 chars): %s...", token_response["access_token"][:20])
                    logger.info("Token type: %s", token_response.get("token_type", "Bearer"))
                    logger.info("Expires in: %s seconds", token_response.get("expires_in", 3600))
                    logger.info("Refresh token available: %s", bool(token_response.get("refresh_token")))
                    logger.info("Granted scopes: %s", token_response.get("scope", "N/A"))
                    
                    response_data = {
                        "access_token": token_response["access_token"],
                        "token_type": token_response.get("token_type", "Bearer"),
                        "expires_in": token_response.get("expires_in", 3600),
                        "refresh_token": token_response.get("refresh_token"),
                        "scope": token_response.get("scope"),
                        "user_id": user_info.get("id")
                    }
                    
                    # Log the complete response data being returned
                    logger.info("Returning token response data: %s", {
                        "access_token": f"{response_data['access_token'][:20]}..." if response_data['access_token'] else None,
                        "token_type": response_data['token_type'],
                        "expires_in": response_data['expires_in'],
                        "refresh_token": f"{response_data['refresh_token'][:20]}..." if response_data['refresh_token'] else None,
                        "scope": response_data['scope'],
                        "user_id": response_data['user_id']
                    })
                    
                    return response_data
                    
            except aiohttp.ClientError as e:
                logger.error("Network error during token exchange: %s", str(e))
                raise Exception(f"Network error connecting to Tidal: {str(e)}")

    async def transfer_playlist_to_tidal(self, db: AsyncSession, playlist_id: str, 
                                       access_token: str, custom_playlist_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Transfer a ResomiX playlist to Tidal
        
        Args:
            db: Database session
            playlist_id: ResomiX playlist UUID
            access_token: Tidal OAuth access token
            custom_playlist_name: Optional custom name for Tidal playlist
            
        Returns:
            Transfer result with statistics and details
        """
        logger.info("Starting Tidal playlist transfer...")
        
        transfer_start_time = time.time()
        
        try:
            # Step 1: Get playlist from database
            logger.info("Fetching playlist from database...")
            playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            if not playlist:
                logger.error("Playlist not found: %s", playlist_id)
                raise ValueError(f"Playlist with ID {playlist_id} not found")
            
            # Step 2: Get tracks for playlist
            logger.info("Fetching tracks for playlist...")
            playlist_tracks = await self.playlist_repository.async_get_tracks_by_playlist_id(db, playlist.id)
            if not playlist_tracks:
                logger.warning("Playlist has no tracks: %s", playlist_id)
                raise ValueError(f"Playlist {playlist_id} has no tracks to transfer")
            
            logger.info("Found %d tracks in playlist '%s'", len(playlist_tracks), playlist.name)
            
            # Step 3: Get track and artist information for each playlist track
            track_data = []
            for playlist_track in playlist_tracks:
                # Get the actual track object
                track = await self.track_repository.async_get_by_id(db, playlist_track.track_id)
                if track:
                    artists = await self.track_repository.async_get_track_artists(db, track.id)
                    artist_names = [artist.name for artist in artists] if artists else ["Unknown Artist"]
                    track_data.append((track.id, track.title or "Unknown Track", artist_names[0]))
            
            # Step 4: Create Tidal session and playlist
            logger.info("Creating Tidal playlist...")
            playlist_name = custom_playlist_name or f"ResomiX - {playlist.name}"
            
            async with aiohttp.ClientSession() as session:
                # Create playlist
                tidal_playlist = await self._create_tidal_playlist(
                    session, access_token, playlist_name, 
                    f"Transferred from ResomiX playlist '{playlist.name}'"
                )
                
                tidal_playlist_id = tidal_playlist['id']
                tidal_playlist_url = tidal_playlist['url']
                
                logger.info("Created Tidal playlist: %s", playlist_name)
                
                # Step 5: Search for tracks on Tidal (concurrent)
                logger.info("Searching for tracks on Tidal...")
                
                # Check cache for existing Tidal IDs
                track_ids = [track_id for track_id, _, _ in track_data]
                cached_tidal_ids = await self._get_cached_tidal_ids(db, track_ids)
                
                # Separate cached and uncached tracks
                cached_tracks = []
                uncached_tracks = []
                
                for track_id, title, artist in track_data:
                    if track_id in cached_tidal_ids:
                        cached_tracks.append((track_id, cached_tidal_ids[track_id]))
                    else:
                        uncached_tracks.append((track_id, title, artist))
                
                # Search for uncached tracks only
                search_results = []
                new_tidal_ids = {}  # For caching newly found IDs
                
                if uncached_tracks:
                    search_results = await self._search_tracks_concurrently(access_token, uncached_tracks)
                    
                    # Collect newly found Tidal IDs for caching
                    for track_id, tidal_id in search_results:
                        if tidal_id:
                            new_tidal_ids[track_id] = tidal_id
                
                # Update cache with newly found Tidal IDs
                if new_tidal_ids:
                    await self._update_tidal_cache(db, new_tidal_ids)
                
                # Process all results (cached + searched)
                found_tracks = []
                not_found_tracks = []
                
                # Add cached tracks to found_tracks
                for track_id, tidal_id in cached_tracks:
                    found_tracks.append(tidal_id)
                
                # Add searched tracks to appropriate lists
                for track_id, tidal_id in search_results:
                    if tidal_id:
                        found_tracks.append(tidal_id)
                    else:
                        # Find original track info for not found list
                        original_track = next((t for t in track_data if t[0] == track_id), None)
                        if original_track:
                            _, title, artist = original_track
                            not_found_tracks.append(f"{artist} - {title}")
                
                logger.info("Found %d tracks (%d cached + %d searched), %d not found", 
                           len(found_tracks), len(cached_tracks), len(new_tidal_ids), len(not_found_tracks))
                
                # Step 6: Add found tracks to Tidal playlist
                tracks_added = 0
                if found_tracks:
                    tracks_added = await self._add_tracks_to_tidal_playlist(
                        session, access_token, tidal_playlist_id, found_tracks
                    )
                else:
                    logger.warning("No tracks found on Tidal to add to playlist")
            
            # Prepare response
            total_time = time.time() - transfer_start_time
            
            playlist_data = {
                'id': tidal_playlist_id,
                'url': tidal_playlist_url,
                'name': playlist_name
            }
            
            transfer_stats = {
                'total_tracks': len(playlist_tracks),
                'tracks_added': tracks_added,
                'tracks_not_found': len(not_found_tracks),
                'not_found_tracks': not_found_tracks[:10],  # Limit to first 10 for response size
                'transfer_time_seconds': round(total_time, 2)
            }
            
            result = format_transfer_response("Tidal", playlist_data, transfer_stats)
            
            logger.info("Transfer completed successfully in %.1fs - %d/%d tracks added", 
                       total_time, tracks_added, len(playlist_tracks))
            
            return result
            
        except Exception as e:
            total_time = time.time() - transfer_start_time
            error_message = get_platform_error_message("Tidal", str(e))
            logger.error("Transfer failed after %.1fs: %s", total_time, error_message)
            raise Exception(error_message) 