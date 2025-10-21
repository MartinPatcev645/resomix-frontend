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
from urllib.parse import urlencode

from app.core.config import settings
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository
from app.repositories.playlist_transfer_track_repository import (
    PlaylistTransferTrackRepository,
)
from app.utils.playlist_transfer_utils import (
    validate_track_data,
    search_tracks_concurrently,
    format_transfer_response,
    batch_list,
    get_platform_error_message,
    log_transfer_progress,
)
from app.core.exceptions import PublicHttpError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - [TIDAL_TRANSFER] %(message)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)


def _redact(value: Optional[str]) -> Optional[str]:
    """Redact sensitive values before logging/returning to client."""
    if not value:
        return value
    if len(value) <= 8:
        return "***"
    return value[:6] + "...redacted..."


class TidalTransferService:
    """Service for transferring ResomiX playlists to Tidal."""

    def __init__(self):
        self.playlist_repository = PlaylistRepository()
        self.track_repository = TrackRepository()
        self.transfer_track_repository = PlaylistTransferTrackRepository()

        self.api_base_url = "https://openapi.tidal.com"
        self.listen_base_url = "https://listen.tidal.com"
        self.api_version = "v2"
        self.client_id = settings.tidal_client_id

        self.max_concurrent_searches = 2  # Process 2 tracks at a time

        logger.info("TidalTransferService initialization complete")

    def _get_headers(self, access_token: str) -> Dict[str, str]:
        """Return headers consistent with Tidal JSON:API v2."""
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/vnd.api+json",
            "Accept": "application/vnd.api+json",
            "User-Agent": "ResomiX/1.0",
        }

    async def _make_api_request(
        self,
        session: aiohttp.ClientSession,
        method: str,
        url: str,
        headers: Dict[str, str],
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Unified HTTP call with robust handling of non-JSON and 204 No Content.
        Raises PublicHttpError with safe details on failure.
        """
        try:
            async with session.request(
                method, url, headers=headers, **kwargs
            ) as response:
                text = await response.text()
                content_type = response.headers.get("Content-Type", "")

                # 204 No Content or empty response body
                if response.status == 204 or not text.strip():
                    if response.status >= 400:
                        raise PublicHttpError(
                            f"Tidal API error {response.status}",
                            code="TIDAL_HTTP_ERROR",
                            status=response.status,
                            details={
                                "method": method,
                                "url": url,
                                "params": kwargs.get("params"),
                            },
                        )
                    return {}

                # Try to parse JSON for JSON/JSON:API content types
                is_json = (
                    "application/json" in content_type
                    or "application/vnd.api+json" in content_type
                )
                data: Any
                if is_json:
                    try:
                        data = json.loads(text)
                    except Exception:
                        raise PublicHttpError(
                            f"Tidal returned non-parseable JSON (status {response.status})",
                            code="TIDAL_BAD_JSON",
                            status=response.status,
                            details={
                                "method": method,
                                "url": url,
                                "params": kwargs.get("params"),
                                "body_snippet": text[:2000],
                            },
                        )
                else:
                    # Unexpected content type: return raw for debugging (safe snippet)
                    data = {"raw": text[:2000], "content_type": content_type}

                # If status indicates error, wrap and throw with details
                if response.status >= 400:
                    raise PublicHttpError(
                        f"Tidal API error {response.status}",
                        code="TIDAL_HTTP_ERROR",
                        status=response.status,
                        details={
                            "method": method,
                            "url": url,
                            "params": kwargs.get("params"),
                            "request_json": kwargs.get(
                                "json"
                            ),  # ensure caller doesn't pass tokens here
                            "response_body_snippet": text[:2000],
                        },
                    )

                return data
        except aiohttp.ClientError as e:
            raise PublicHttpError(
                "Network error connecting to Tidal",
                code="NETWORK_ERROR",
                status=502,
                details={"reason": str(e)},
            )

    async def _search_tidal_track(
        self,
        session: aiohttp.ClientSession,
        access_token: str,
        title: str,
        artist: str,
        country_code: str = "US",
    ) -> Optional[str]:
        """
        Search for a track on Tidal using official /v2/search and return its resource id.
        """
        query = f"{artist} {title}".strip()
        if not query:
            return None

        url = f"{self.api_base_url}/{self.api_version}/search"
        params = {
            "query": query,
            "types": "tracks",
            "countryCode": country_code,
            "limit": 1,
        }
        headers = self._get_headers(access_token)
        data = await self._make_api_request(session, "GET", url, headers, params=params)

        tracks = data.get("data", [])
        if not tracks:
            return None

        # JSON:API: track id is in data[0].id
        return tracks[0].get("id")

    async def _get_cached_tidal_ids(
        self, db: AsyncSession, track_ids: List[int]
    ) -> Dict[int, str]:
        """Fetch cached Tidal IDs from DB cache table."""
        try:
            return await self.transfer_track_repository.async_get_tidal_ids(
                db, track_ids
            )
        except Exception as e:
            logger.error(f"Failed to get cached Tidal IDs: {str(e)}")
            return {}

    async def _search_tracks_concurrently(
        self,
        access_token: str,
        track_data: List[Tuple[int, str, str]],
        country_code: str = "US",
    ) -> List[Tuple[int, Optional[str]]]:
        """Search multiple tracks concurrently with throttling."""
        if not track_data:
            return []

        valid_tracks = validate_track_data(track_data)
        if not valid_tracks:
            return []

        async with aiohttp.ClientSession() as session:

            async def search_function(title: str, artist: str) -> Optional[str]:
                return await self._search_tidal_track(
                    session, access_token, title, artist, country_code
                )

            results = await search_tracks_concurrently(
                search_function, valid_tracks, self.max_concurrent_searches
            )
        return results

    async def _update_tidal_cache(
        self, db: AsyncSession, track_tidal_map: Dict[int, str]
    ) -> None:
        """Upsert newly found Tidal track IDs into DB cache."""
        if not track_tidal_map:
            return
        try:
            await self.transfer_track_repository.async_batch_upsert_tidal_ids(
                db, track_tidal_map
            )
            logger.info("Cached %d new Tidal IDs", len(track_tidal_map))
        except Exception as e:
            logger.error("Failed to cache Tidal IDs: %s", str(e))

    async def _get_user_info(self, access_token: str) -> dict:
        """Fetch authenticated user's info from /v2/users/me."""
        async with aiohttp.ClientSession() as session:
            url = f"{self.api_base_url}/{self.api_version}/users/me"
            headers = self._get_headers(access_token)
            response = await self._make_api_request(session, "GET", url, headers)
            return response

    async def _create_tidal_playlist(
        self,
        session: aiohttp.ClientSession,
        access_token: str,
        playlist_name: str,
        description: str = "",
        user_id: Optional[str] = None,
        user_country: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a new playlist via official /v2/playlists with JSON:API payload.
        """
        if not user_country or not user_id:
            user_info = await self._get_user_info(access_token)
            user_id = user_id or user_info.get("data", {}).get("id")
            user_country = user_country or user_info.get("data", {}).get(
                "attributes", {}
            ).get("country", "US")
            if not user_id:
                raise PublicHttpError(
                    "Failed to retrieve Tidal userId from /users/me.",
                    code="TIDAL_USERINFO_ERROR",
                    status=500,
                )

        create_url = f"{self.api_base_url}/{self.api_version}/playlists"
        params = {"countryCode": user_country}
        payload = {
            "data": {
                "type": "playlists",
                "attributes": {
                    "access": "private",
                    "description": description,
                    "name": playlist_name,
                },
            }
        }
        headers = self._get_headers(access_token)
        response_data = await self._make_api_request(
            session, "POST", create_url, headers, params=params, json=payload
        )
        playlist_id = response_data.get("data", {}).get("id")
        if not playlist_id:
            raise PublicHttpError(
                "Failed to create Tidal playlist: No playlist ID returned",
                code="TIDAL_PLAYLIST_CREATE_ERROR",
                status=502,
            )

        return {
            "id": playlist_id,
            "name": playlist_name,
            "url": f"{self.listen_base_url}/playlist/{playlist_id}",
        }

    async def _add_tracks_to_tidal_playlist(
        self,
        session: aiohttp.ClientSession,
        access_token: str,
        playlist_id: str,
        track_ids: List[str],
        user_country: str = "US",
    ) -> int:
        """
        Add tracks to Tidal playlist via /v2/playlists/{id}/items using JSON:API format.
        Tidal might respond 202/204 with no body; this is OK.
        """
        if not track_ids:
            return 0

        logger.info("Adding %d tracks to Tidal playlist", len(track_ids))
        add_url = (
            f"{self.api_base_url}/{self.api_version}/playlists/{playlist_id}/items"
        )
        headers = self._get_headers(access_token)
        params = {"countryCode": user_country}

        tracks_added = 0
        batch_size = 100
        batches = batch_list(track_ids, batch_size)

        for i, batch in enumerate(batches):
            try:
                payload = {"data": [{"type": "tracks", "id": tid} for tid in batch]}
                # We don't need response body; _make_api_request will handle 204/no content correctly
                await self._make_api_request(
                    session, "POST", add_url, headers, params=params, json=payload
                )
                tracks_added += len(batch)
                log_transfer_progress(
                    logger, "Adding tracks to playlist", i + 1, len(batches)
                )
            except PublicHttpError as e:
                logger.error(f"Failed to add batch {i + 1}: {e} | details={e.details}")
            except Exception as e:
                logger.error(f"Failed to add batch {i + 1}: {str(e)}")

        logger.info("Successfully added %d tracks to Tidal playlist", tracks_added)
        return tracks_added

    async def exchange_authorization_code(
        self, authorization_code: str, redirect_uri: str, code_verifier: str
    ) -> Dict[str, Any]:
        """
        Exchange authorization code for access token using PKCE.
        Returns token info and user info. Raises PublicHttpError on failure.
        """
        if not self.client_id:
            raise PublicHttpError(
                "Tidal client ID not configured", code="CONFIG_ERROR", status=500
            )

        async with aiohttp.ClientSession() as session:
            token_url = "https://auth.tidal.com/v1/oauth2/token"

            token_data = {
                "grant_type": "authorization_code",
                "client_id": self.client_id,
                "code": authorization_code,
                "redirect_uri": redirect_uri,  # must be raw, unencoded
                "code_verifier": code_verifier,
            }
            token_payload = urlencode(token_data)

            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "ResomiX/1.0",
                "Accept": "application/json",
            }

            try:
                async with session.post(
                    token_url, data=token_payload, headers=headers
                ) as response:
                    text = await response.text()
                    try:
                        token_response = json.loads(text)
                    except Exception:
                        token_response = None

                    if response.status != 200:
                        err_detail = None
                        if isinstance(token_response, dict):
                            err_detail = token_response.get(
                                "error_description"
                            ) or token_response.get("error")
                        raise PublicHttpError(
                            f"Tidal token error ({response.status})",
                            code="TIDAL_TOKEN_ERROR",
                            status=response.status,
                            details={"response_body_snippet": text[:2000]},
                        )

                    if not token_response or not token_response.get("access_token"):
                        raise PublicHttpError(
                            "Invalid token response from Tidal",
                            code="TIDAL_TOKEN_INVALID",
                            status=502,
                        )

                    # Fetch user info to pass back (optional subscription checks can be added)
                    try:
                        user_info = await self._get_user_info(
                            token_response["access_token"]
                        )
                        logger.info("Tidal /users/me response fetched")
                    except PublicHttpError:
                        raise
                    except Exception as e:
                        logger.exception("Error during user info fetch")
                        raise PublicHttpError(
                            "Failed fetching Tidal user info",
                            code="TIDAL_USERINFO_ERROR",
                            status=502,
                            details={"cause": str(e)},
                        )

                    return {
                        "access_token": token_response["access_token"],
                        "token_type": token_response.get("token_type", "Bearer"),
                        "expires_in": token_response.get("expires_in", 3600),
                        "refresh_token": token_response.get("refresh_token"),
                        "scope": token_response.get("scope"),
                        "user": user_info,
                    }

            except aiohttp.ClientError as e:
                raise PublicHttpError(
                    "Network error connecting to Tidal",
                    code="NETWORK_ERROR",
                    status=502,
                    details={"reason": str(e)},
                )

    async def transfer_playlist_to_tidal(
        self,
        db: AsyncSession,
        playlist_id: str,
        access_token: str,
        custom_playlist_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Transfer a ResomiX playlist to Tidal and return stats and target playlist info.
        Raises PublicHttpError on failure with a safe message and details.
        """
        logger.info("Starting Tidal playlist transfer...")
        transfer_start_time = time.time()

        try:
            # Step 1: Load playlist
            playlist = await self.playlist_repository.async_get_playlist_by_uuid(
                db, playlist_id
            )
            if not playlist:
                raise PublicHttpError(
                    f"Playlist with ID {playlist_id} not found",
                    code="PLAYLIST_NOT_FOUND",
                    status=404,
                )

            # Step 2: Load playlist tracks
            playlist_tracks = (
                await self.playlist_repository.async_get_tracks_by_playlist_id(
                    db, playlist.id
                )
            )
            if not playlist_tracks:
                raise PublicHttpError(
                    f"Playlist {playlist_id} has no tracks to transfer",
                    code="PLAYLIST_EMPTY",
                    status=400,
                )
            logger.info(
                "Found %d tracks in playlist '%s'", len(playlist_tracks), playlist.name
            )

            # Step 3: Build search inputs
            track_data: List[Tuple[int, str, str]] = []
            for playlist_track in playlist_tracks:
                track = await self.track_repository.async_get_by_id(
                    db, playlist_track.track_id
                )
                if track:
                    artists = await self.track_repository.async_get_track_artists(
                        db, track.id
                    )
                    artist_names = (
                        [artist.name for artist in artists]
                        if artists
                        else ["Unknown Artist"]
                    )
                    track_data.append(
                        (track.id, track.title or "Unknown Track", artist_names[0])
                    )

            # Step 4: Create Tidal playlist
            playlist_name = custom_playlist_name or f"ResomiX - {playlist.name}"
            async with aiohttp.ClientSession() as session:
                user_info = await self._get_user_info(access_token)
                user_country = (
                    user_info.get("data", {}).get("attributes", {}).get("country", "US")
                )

                tidal_playlist = await self._create_tidal_playlist(
                    session,
                    access_token,
                    playlist_name,
                    f"Transferred from ResomiX playlist '{playlist.name}'",
                    user_id=None,
                    user_country=user_country,
                )
                tidal_playlist_id = tidal_playlist["id"]
                tidal_playlist_url = tidal_playlist["url"]
                logger.info("Created Tidal playlist: %s", playlist_name)

                # Step 5: Resolve track IDs (cache + search)
                track_ids_only = [tid for tid, _, _ in track_data]
                cached_tidal_ids = await self._get_cached_tidal_ids(db, track_ids_only)

                cached_tracks: List[Tuple[int, str]] = []
                uncached_tracks: List[Tuple[int, str, str]] = []
                for track_id, title, artist in track_data:
                    if track_id in cached_tidal_ids:
                        cached_tracks.append((track_id, cached_tidal_ids[track_id]))
                    else:
                        uncached_tracks.append((track_id, title, artist))

                search_results: List[Tuple[int, Optional[str]]] = []
                new_tidal_ids: Dict[int, str] = {}

                if uncached_tracks:
                    search_results = await self._search_tracks_concurrently(
                        access_token, uncached_tracks, user_country
                    )
                    for track_id, tidal_id in search_results:
                        if tidal_id:
                            new_tidal_ids[track_id] = tidal_id

                if new_tidal_ids:
                    await self._update_tidal_cache(db, new_tidal_ids)

                found_tracks: List[str] = []
                not_found_tracks: List[str] = []

                # Add cached
                for _, tidal_id in cached_tracks:
                    found_tracks.append(tidal_id)

                # Add searched
                for track_id, tidal_id in search_results:
                    if tidal_id:
                        found_tracks.append(tidal_id)
                    else:
                        original = next(
                            (t for t in track_data if t[0] == track_id), None
                        )
                        if original:
                            _, t_title, t_artist = original
                            not_found_tracks.append(f"{t_artist} - {t_title}")

                logger.info(
                    "Found %d tracks (%d cached + %d searched), %d not found",
                    len(found_tracks),
                    len(cached_tracks),
                    len(new_tidal_ids),
                    len(not_found_tracks),
                )

                # Step 6: Add tracks
                tracks_added = 0
                if found_tracks:
                    tracks_added = await self._add_tracks_to_tidal_playlist(
                        session,
                        access_token,
                        tidal_playlist_id,
                        found_tracks,
                        user_country,
                    )
                else:
                    logger.warning("No tracks found on Tidal to add to playlist")

            # Final response
            total_time = time.time() - transfer_start_time
            playlist_data = {
                "id": tidal_playlist_id,
                "url": tidal_playlist_url,
                "name": playlist_name,
            }
            transfer_stats = {
                "total_tracks": len(playlist_tracks),
                "tracks_added": tracks_added,
                "tracks_not_found": len(not_found_tracks),
                "not_found_tracks": not_found_tracks[:10],
                "transfer_time_seconds": round(total_time, 2),
            }
            result = format_transfer_response("Tidal", playlist_data, transfer_stats)
            logger.info(
                "Transfer completed successfully in %.1fs - %d/%d tracks added",
                total_time,
                tracks_added,
                len(playlist_tracks),
            )
            return result

        except PublicHttpError:
            # Re-raise public errors as-is (will be handled by controller)
            raise
        except Exception as e:
            # Convert any unexpected error into a public, safe error
            total_time = time.time() - transfer_start_time
            logger.exception("Transfer failed after %.1fs", total_time)
            raise PublicHttpError(
                "Tidal transfer failed",
                code="TIDAL_TRANSFER_FAILED",
                status=500,
                details={"cause": str(e)},
            )
