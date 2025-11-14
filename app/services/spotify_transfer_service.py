"""
Spotify Transfer Service
========================

This service handles the transfer of Resomix playlists to Spotify.
It manages OAuth authentication, track searching on Spotify, and playlist creation
using the Spotify Web API through the spotipy library.

Provides functionality to search for tracks on Spotify, create playlists,
and handle the complete playlist transfer workflow.

Version: 3.0.1
Init Date: July 19, 2025
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
import unicodedata

from app.core.config import settings
from app.repositories.playlist_repository import PlaylistRepository
from app.repositories.track_repository import TrackRepository
from app.repositories.playlist_transfer_track_repository import PlaylistTransferTrackRepository
from spotipy.exceptions import SpotifyException
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
    """Service for transferring Resomix playlists to Spotify"""

    def __init__(self):
        """Initialize the Spotify transfer service"""
        self.playlist_repository = PlaylistRepository()
        self.track_repository = TrackRepository()
        self.transfer_track_repository = PlaylistTransferTrackRepository()

        # Concurrent processing settings
        self.max_concurrent_searches = 2  # Process 2 tracks at a time

        logger.info("SpotifyTransferService initialization complete")

    def _create_spotify_client(self, access_token: str) -> spotipy.Spotify:
        """
        Create Spotify client with user's access token

        Args:
            access_token: Valid Spotify OAuth access token

        Returns:
            Configured Spotify client
        """
        logger.info("Authenticating with Spotify...")
        try:
            client = spotipy.Spotify(auth=access_token)
            # Test the token by getting user info
            user_info = client.me()
            logger.info("Successfully authenticated with Spotify for user: %s",
                        user_info.get('display_name', 'Unknown'))
            return client
        except Exception as e:
            error_msg = str(e)
            logger.error("Failed to create Spotify client: %s", error_msg)

            # Provide specific error message for 403 errors
            if "403" in error_msg and "not be registered" in error_msg:
                raise ValueError(
                    "This Spotify account is not authorized to use this app. Please contact the app developer to add your Spotify account to the authorized users list.")
            elif "403" in error_msg:
                raise ValueError("Spotify access denied. Please check your access token permissions.")
            elif "401" in error_msg:
                raise ValueError("Invalid or expired Spotify access token. Please re-authenticate.")
            else:
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

        # Remove only the most basic unwanted strings (extremely minimal cleaning)
        unwanted_patterns = [
            r'\(Original Mix\)',  # Only keep this one - it's the most common
            # Removed almost all other patterns to prevent over-cleaning
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
        removal_strings = [
            "(Original Mix)",
            "(Radio Edit)",
            "(Extended Mix)",
            "(Club Mix)",
            "(Remix)"
        ]

        for remove_str in removal_strings:
            title_clean = re.sub(re.escape(remove_str), '', title_clean, flags=re.IGNORECASE)

        # Remove stopper strings
        stopper_strings = ["http://", "https://", "www.", ".com", ".net", ".org"]
        for stopper in stopper_strings:
            if stopper.lower() in title_clean.lower():
                title_clean = title_clean.split(stopper)[0]
                break

        # Clean up extra spaces and special characters
        title_clean = re.sub(r'[^\w\s\-\(\)]', ' ', title_clean).strip()
        title_clean = re.sub(r'\s+', ' ', title_clean)

        # Clean artist name similarly
        artist_clean = artist
        meta_stopper_strings = ["http://", "https://", "www.", ".com", ".net", ".org"]
        for stopper in meta_stopper_strings:
            if stopper.lower() in artist_clean.lower():
                artist_clean = artist_clean.split(stopper)[0]
                break

        artist_clean = re.sub(r'[^\w\s\-]', ' ', artist_clean).strip()
        artist_clean = re.sub(r'\s+', ' ', artist_clean)

        # Create search query
        query = f"{title_clean} {artist_clean}".strip()
        return query[:100]  # Limit query length

    def _normalize_text(self, text: str) -> str:
        if not text:
            return ""
        text = unicodedata.normalize("NFKD", text)
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        text = text.lower()
        text = text.replace("&", " and ")
        text = re.sub(r"[^\w\s\-\(\)]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _strip_parentheses(self, text: str) -> str:
        return re.sub(r"\([^)]*\)", " ", text).strip()

    def _tokenize(self, text: str) -> List[str]:
        if not text:
            return []
        return [t for t in re.split(r"[\s\-]+", text) if t]

    def _dice_coefficient(self, tokens_a: List[str], tokens_b: List[str]) -> float:
        if not tokens_a or not tokens_b:
            return 0.0
        set_a = set(tokens_a)
        set_b = set(tokens_b)
        inter = len(set_a.intersection(set_b))
        return (2.0 * inter) / (len(set_a) + len(set_b))

    def _best_name_similarity(self, name: str, candidates: List[str]) -> float:
        if not name or not candidates:
            return 0.0
        n_name = self._normalize_text(name)
        t_name = self._tokenize(n_name)
        best = 0.0
        for cand in candidates:
            n_c = self._normalize_text(cand)
            t_c = self._tokenize(n_c)
            best = max(best, self._dice_coefficient(t_name, t_c))
        return best

    def _extract_parenthetical_tags(self, title: str) -> List[str]:
        tags = re.findall(r"\(([^)]{2,64})\)", title or "", flags=re.IGNORECASE)
        return [self._normalize_text(t) for t in tags]

    def _remix_signal_from_tags(self, tags: List[str]) -> Dict[str, Any]:
        info = {
            "has_remix": False,
            "has_original": False,
            "has_edit": False,
            "remixer_tokens": set(),
        }
        for tag in tags:
            if "remix" in tag:
                info["has_remix"] = True
                tokens = [t for t in self._tokenize(tag) if t not in {"remix", "mix", "edit", "version", "original"}]
                info["remixer_tokens"].update(tokens)
            if "original" in tag:
                info["has_original"] = True
            if "edit" in tag:
                info["has_edit"] = True
        return info

    def _build_search_queries(self, title: str, artists: List[str]) -> List[str]:
        queries = []
        main_artist = artists[0] if artists else ""
        title_no_paren = self._strip_parentheses(title)

        if title and main_artist:
            queries.append(f'track:"{title}" artist:"{main_artist}"')
            if title_no_paren != title:
                queries.append(f'track:"{title_no_paren}" artist:"{main_artist}"')
            queries.append(f'"{title}" {main_artist}')

        if title:
            queries.append(f'"{title}"')
            if title_no_paren != title:
                queries.append(f'"{title_no_paren}"')

        if main_artist and title_no_paren:
            queries.append(f'{title_no_paren} {main_artist}')

        seen = set()
        out = []
        for q in queries:
            if q not in seen:
                seen.add(q)
                out.append(q)
        return out

    def _search_api(self, sp: spotipy.Spotify, query: str, limit: int = 20, retries: int = 2) -> Dict[str, Any]:
        for attempt in range(retries + 1):
            try:
                return sp.search(q=query, type="track", limit=limit)
            except SpotifyException as e:
                if e.http_status == 429:
                    retry_after = 2
                    try:
                        retry_after = int(getattr(e, "headers", {}).get("Retry-After", "2"))
                    except Exception:
                        pass
                    time.sleep(retry_after)
                else:
                    if attempt >= retries:
                        raise
                    time.sleep(1 + attempt)
            except Exception:
                if attempt >= retries:
                    raise
                time.sleep(1 + attempt)
        return {"tracks": {"items": []}}

    async def _search_spotify_track(self, sp: spotipy.Spotify, title: str, artist_or_artists) -> Optional[str]:
        try:
            if isinstance(artist_or_artists, str):
                artists = [artist_or_artists] if artist_or_artists else []
            else:
                artists = artist_or_artists or []

            loop = asyncio.get_event_loop()

            title = title or ""
            n_title = self._normalize_text(title)
            title_no_paren = self._strip_parentheses(title)
            tags = self._extract_parenthetical_tags(title)
            remix_info = self._remix_signal_from_tags(tags)

            queries = self._build_search_queries(title, artists)

            best_uri = None
            best_score = -1.0

            for q in queries:
                try:
                    results = await loop.run_in_executor(
                        None, lambda q=q: self._search_api(sp, q, limit=20)
                    )
                except Exception as e:
                    logger.warning("Search error for query='%s': %s", q, e)
                    continue

                items = results.get("tracks", {}).get("items", []) or []
                if not items:
                    continue

                for tr in items:
                    cand_title = tr.get("name") or ""
                    cand_artists = [a.get("name") or "" for a in tr.get("artists", [])]
                    cand_uri = tr.get("uri")

                    n_cand_title = self._normalize_text(cand_title)
                    title_score_tokens = self._dice_coefficient(
                        self._tokenize(n_title), self._tokenize(n_cand_title)
                    )

                    artist_score_best = 0.0
                    for a in artists:
                        artist_score_best = max(artist_score_best, self._best_name_similarity(a, cand_artists))

                    cand_tags = self._extract_parenthetical_tags(cand_title)
                    cand_remix = self._remix_signal_from_tags(cand_tags)

                    score = 0.7 * title_score_tokens + 0.3 * artist_score_best

                    if remix_info["has_remix"] and not cand_remix["has_remix"]:
                        score -= 0.12
                    if cand_remix["has_remix"] and not remix_info["has_remix"]:
                        score -= 0.10
                    if remix_info["has_original"] and not cand_remix["has_original"]:
                        score -= 0.05
                    if cand_remix["has_edit"] and not remix_info["has_edit"]:
                        score -= 0.05

                    if remix_info["remixer_tokens"]:
                        rem_tokens = remix_info["remixer_tokens"]
                        if rem_tokens & set(self._tokenize(n_cand_title)):
                            score += 0.10
                        else:
                            score -= 0.05

                    bad_keywords = ["karaoke", "tribute", "cover", "parody"]
                    if any(b in n_cand_title for b in bad_keywords):
                        score -= 0.2

                    if artist_score_best < 0.45:
                        continue
                    if title_score_tokens < 0.60:
                        continue

                    if score > best_score:
                        best_score = score
                        best_uri = cand_uri

                if best_uri and best_score >= 0.85:
                    break

            return best_uri

        except Exception as e:
            logger.warning("Search failed for '%s' by '%s': %s", title, artist_or_artists, str(e))
            return None

    async def _search_tracks_concurrently(self, spotify_client: spotipy.Spotify,
                                          track_data: List[Tuple[int, str, List[str]]]
                                          ) -> List[Tuple[int, Optional[str]]]:
        logger.info("Searching %d tracks concurrently", len(track_data))
        start_time = time.time()

        def search_single_track(track_info):
            track_id, title, artists = track_info
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return (track_id, loop.run_until_complete(
                    self._search_spotify_track(spotify_client, title, artists)
                ))
            finally:
                loop.close()

        results = []
        with ThreadPoolExecutor(max_workers=self.max_concurrent_searches) as executor:
            wrapped_futures = []
            future_to_track_id = {}
            for info in track_data:
                cf = executor.submit(search_single_track, info)
                af = asyncio.wrap_future(cf)
                wrapped_futures.append(af)
                future_to_track_id[af] = info[0]

            for af in asyncio.as_completed(wrapped_futures):
                try:
                    result = await af
                    results.append(result)
                except Exception as e:
                    track_id = future_to_track_id.get(af, 'unknown')
                    logger.error("Error searching track ID %s: %s", track_id, str(e))
                    results.append((track_id, None))

        total_time = time.time() - start_time
        successful_searches = sum(1 for _, r in results if r is not None)
        logger.info("Search completed: %d/%d tracks found in %.1fs",
                    successful_searches, len(track_data), total_time)
        return results

    async def _get_cached_spotify_ids(self, db: AsyncSession, track_ids: List[int]) -> Dict[int, str]:
        """
        Get cached Spotify IDs for tracks

        Args:
            db: Database session
            track_ids: List of track IDs to check

        Returns:
            Dictionary mapping track_id -> spotify_id for cached entries
        """
        try:
            cached_ids = await self.transfer_track_repository.async_get_spotify_ids(db, track_ids)

            if cached_ids:
                logger.info("Found %d cached Spotify IDs", len(cached_ids))

            return cached_ids
        except Exception as e:
            # Align error-handling approach with the Tidal service: fail gracefully and continue transfer
            logger.error("Failed to get cached Spotify IDs: %s", str(e))
            return {}

    async def _update_spotify_cache(self, db: AsyncSession, track_spotify_map: Dict[int, str]) -> None:
        """
        Update cache with newly found Spotify IDs

        Args:
            db: Database session
            track_spotify_map: Dictionary mapping track_id -> spotify_id
        """
        if not track_spotify_map:
            return

        try:
            await self.transfer_track_repository.async_batch_upsert_spotify_ids(db, track_spotify_map)
            logger.info("Cached %d new Spotify IDs", len(track_spotify_map))
        except Exception as e:
            logger.error("Failed to cache Spotify IDs: %s", str(e))

    async def _add_tracks_to_playlist(self, spotify_client: spotipy.Spotify,
                                      playlist_id: str, track_uris: List[str]) -> None:
        """
        Add tracks to Spotify playlist in batches

        Args:
            spotify_client: Authenticated Spotify client
            playlist_id: Spotify playlist ID
            track_uris: List of Spotify track URIs to add
        """
        logger.info("Adding %d tracks to Spotify playlist", len(track_uris))

        # Add tracks in batches (Spotify limit is 100 tracks per request)
        batch_size = 100
        tracks_added = 0

        for i in range(0, len(track_uris), batch_size):
            batch = track_uris[i:i + batch_size]

            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    lambda: spotify_client.playlist_add_items(playlist_id, batch)
                )
                tracks_added += len(batch)
            except Exception as e:
                batch_num = (i // batch_size) + 1
                logger.error("Failed to add batch %d: %s", batch_num, str(e))

        logger.info("Successfully added %d tracks to playlist", tracks_added)
        return tracks_added

    async def transfer_playlist_to_spotify(self, db: AsyncSession, playlist_id: str,
                                           access_token: str, custom_playlist_name: Optional[str] = None) -> Dict[
        str, Any]:
        """
        Transfer a Resomix playlist to Spotify

        Args:
            db: Database session
            playlist_id: Resomix playlist UUID
            access_token: Spotify OAuth access token
            custom_playlist_name: Optional custom name for Spotify playlist

        Returns:
            Transfer result with statistics and details
        """
        logger.info("Starting playlist transfer...")

        transfer_start_time = time.time()

        try:
            # Step 1: Get playlist from database
            logger.info("Fetching playlist from database...")
            playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            sim_playlist = await self.playlist_repository.async_get_playlist_similarity_data(db, playlist_id)
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

            # Step 3: Build track list (seed + playlist tracks)
            track_data = []

            # 3a. Add seed (queried) track first if present
            if playlist.seed_track_id:
                seed_title = None
                seed_artists = []

                # Prefer using the already fetched similarity payload (single DB roundtrip)
                if sim_playlist and sim_playlist.get("queried_track"):
                    qt = sim_playlist["queried_track"]
                    seed_title = qt.get("title") or "Unknown Track"
                    artist_str = qt.get("artist") or ""
                    # Convert "Artist1, Artist2" into ["Artist1", "Artist2"]
                    seed_artists = [a.strip() for a in artist_str.split(",") if a.strip()] or ["Unknown Artist"]

                # Fallback to DB if similarity payload misses queried_track
                if not seed_title:
                    try:
                        seed_track_obj = await self.track_repository.async_get_by_id(db, playlist.seed_track_id)
                        if seed_track_obj:
                            artists = await self.track_repository.async_get_track_artists(db, seed_track_obj.id)
                            seed_artists = [a.name for a in artists] if artists else ["Unknown Artist"]
                            seed_title = seed_track_obj.title or "Unknown Track"
                    except Exception as e:
                        logger.warning("Failed to load seed track details: %s", e)

                if seed_title:
                    track_data.append((playlist.seed_track_id, seed_title, seed_artists))

            # 3b. Add playlist tracks (skip duplicates if seed is present)
            added_ids = {playlist.seed_track_id} if playlist.seed_track_id else set()
            for playlist_track in playlist_tracks:
                if playlist_track.track_id in added_ids:
                    continue
                track = await self.track_repository.async_get_by_id(db, playlist_track.track_id)
                if track:
                    artists = await self.track_repository.async_get_track_artists(db, track.id)
                    artist_names = [artist.name for artist in artists] if artists else ["Unknown Artist"]
                    track_data.append((track.id, track.title or "Unknown Track", artist_names))
                    added_ids.add(track.id)

            logger.info("Found %d tracks in playlist '%s' (including seed if present)", len(track_data), playlist.name)

            # Step 4: Create Spotify client
            logger.info("Authenticating with Spotify...")
            spotify_client = self._create_spotify_client(access_token)

            # Step 5: Create Spotify playlist
            logger.info("Creating Spotify playlist...")
            playlist_name = custom_playlist_name or f"Resomix - {playlist.name}"
            user_info = spotify_client.me()
            user_id = user_info['id']

            spotify_playlist = spotify_client.user_playlist_create(
                user=user_id,
                name=playlist_name,
                public=False,  # Create as private by default
                description=f"Transferred from Resomix playlist '{playlist.name}'"
            )

            spotify_playlist_id = spotify_playlist['id']
            spotify_playlist_url = spotify_playlist['external_urls']['spotify']

            logger.info("Created Spotify playlist: %s", playlist_name)

            # Step 6: Search for tracks on Spotify (concurrent)
            logger.info("Searching for tracks on Spotify...")

            # Check cache for existing Spotify IDs
            track_ids = [track_id for track_id, _, _ in track_data]
            cached_spotify_ids = await self._get_cached_spotify_ids(db, track_ids)

            # Separate cached and uncached tracks
            cached_tracks = []
            uncached_tracks = []

            for track_id, title, artists in track_data:
                if track_id in cached_spotify_ids:
                    cached_tracks.append((track_id, cached_spotify_ids[track_id]))
                else:
                    uncached_tracks.append((track_id, title, artists))

            # Search for uncached tracks only
            search_results = []
            new_spotify_ids = {}  # For caching newly found IDs

            if uncached_tracks:
                # Convert to format expected by concurrent search: (track_id, title, first_artist)
                concurrent_track_data = []
                for track_id, title, artists in uncached_tracks:
                    concurrent_track_data.append((track_id, title, artists))

                search_results = await self._search_tracks_concurrently(spotify_client, concurrent_track_data)

                # Collect newly found Spotify IDs for caching
                for track_id, spotify_uri in search_results:
                    if spotify_uri:
                        new_spotify_ids[track_id] = spotify_uri

            # Update cache with newly found Spotify IDs
            if new_spotify_ids:
                await self._update_spotify_cache(db, new_spotify_ids)

            # Process all results (cached + searched)
            found_tracks = []
            not_found_tracks = []

            # Add cached tracks to found_tracks
            for track_id, spotify_uri in cached_tracks:
                found_tracks.append(spotify_uri)

            # Add searched tracks to appropriate lists
            for track_id, spotify_uri in search_results:
                if spotify_uri:
                    found_tracks.append(spotify_uri)
                else:
                    # Find original track info for not found list
                    original_track = next((t for t in track_data if t[0] == track_id), None)
                    if original_track:
                        _, title, artists = original_track
                        not_found_tracks.append(f"{', '.join(artists)} - {title}")

            logger.info("Found %d tracks (%d cached + %d searched), %d not found",
                        len(found_tracks), len(cached_tracks), len(new_spotify_ids), len(not_found_tracks))

            # Step 7: Add found tracks to Spotify playlist
            tracks_added = 0
            if found_tracks:
                tracks_added = await self._add_tracks_to_playlist(spotify_client, spotify_playlist_id, found_tracks)
            else:
                logger.warning("No tracks found on Spotify to add to playlist")

            # Prepare response
            total_time = time.time() - transfer_start_time

            result = {
                "spotify_playlist_id": spotify_playlist_id,
                "spotify_playlist_url": spotify_playlist_url,
                "spotify_playlist_name": playlist_name,
                "total_tracks": len(track_data),
                "tracks_added": tracks_added,
                "tracks_not_found": len(not_found_tracks),
                "not_found_tracks": not_found_tracks[:10],  # Limit to first 10 for response size
                "transfer_time_seconds": round(total_time, 2)
            }

            logger.info("Transfer completed successfully in %.1fs - %d/%d tracks added",
                        total_time, tracks_added, len(playlist_tracks))

            return result

        except Exception as e:
            total_time = time.time() - transfer_start_time
            logger.error("Transfer failed after %.1fs: %s", total_time, str(e))
            raise