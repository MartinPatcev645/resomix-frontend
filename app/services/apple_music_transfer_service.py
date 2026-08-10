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

from typing import Dict, List, Any, Optional, Tuple, Iterable
from collections import Counter
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
from app.repositories.apple_music_repository import AppleMusicRepository
from app.repositories.service_connection_repository import ServiceConnectionRepository
from app.models.constants import ServiceProvider
from app.utils.security_utils import encrypt_secret, decrypt_secret

# Set up logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Apple Music API constants
APPLE_API = "https://api.music.apple.com"
APPLE_AUDIENCE = "https://music.apple.com"
# Apple Music API allows ~20 req/s/user; add-tracks accepts up to 100 ids per call; the ISRC
# lookup accepts up to 25 ISRCs per call.
ADD_TRACKS_BATCH = 100
ISRC_BATCH = 25


def _http_request(method: str, url: str, *, headers, params=None, data=None,
                  timeout: int = 30, max_retries: int = 3, retry_5xx: bool = True):
    """Blocking HTTP call with simple 429/5xx back-off (honours Retry-After).

    Kept sync on purpose — callers dispatch it via run_in_executor. Returns the final
    Response (never raises for HTTP status); network errors propagate to the caller.

    ``retry_5xx=False`` for requests that CREATE something. Apple's create-playlist endpoint is
    known to return **504 while having created the playlist anyway**, so retrying a timeout can
    leave two or three playlists in someone's library — and we then report failure, because the
    last response we saw was the 504. A 429 is still retried either way: it means the request was
    rejected outright, so replaying it is safe.
    """
    resp = None
    for attempt in range(max_retries):
        resp = requests.request(method, url, headers=headers, params=params, data=data, timeout=timeout)
        retryable = resp.status_code == 429 or (retry_5xx and 500 <= resp.status_code < 600)
        if retryable:
            if attempt == max_retries - 1:
                break
            retry_after = resp.headers.get("Retry-After")
            delay = float(retry_after) if (retry_after and retry_after.isdigit()) else (2 ** attempt)
            time.sleep(min(delay, 5))
            continue
        return resp
    return resp

# Placeholder artist values that should never win the "most common artist" vote.
_ARTIST_PLACEHOLDERS = {"", "unknown", "unknown artist", "n/a", "na", "various", "various artists"}


def _most_common_artist(artist_strings: Iterable[Optional[str]]) -> Optional[str]:
    """Most frequent INDIVIDUAL artist across a playlist's tracks, or None.

    Multi-artist values are stored joined with a pipe (``"Artist1 | Artist2"``), so each string is
    split on ``|`` and every artist counted separately — never the whole combined string. Counting
    is case-insensitive (so ``"Nova Lux"`` and ``"nova lux"`` are the same artist) but the winner is
    returned in its most common original casing. Placeholders (``Unknown``/``N/A``/…) are ignored.
    Ties break by first appearance, which keeps the result stable for a given playlist order.
    """
    counts: Counter = Counter()          # lowercased name -> count
    display: Dict[str, Counter] = {}     # lowercased name -> original-casing votes
    for raw in artist_strings:
        if not raw:
            continue
        for part in str(raw).split("|"):
            name = part.strip()
            key = name.lower()
            if not name or key in _ARTIST_PLACEHOLDERS:
                continue
            counts[key] += 1
            display.setdefault(key, Counter())[name] += 1
    if not counts:
        return None
    top_key = max(counts, key=lambda k: counts[k])
    # Return the most common original casing for the winning artist.
    return display[top_key].most_common(1)[0][0]


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
        self.apple_music_repository = AppleMusicRepository()  # curated apple_song_id per track
        self.connection_repository = ServiceConnectionRepository()  # saved external accounts per user
        self.max_concurrent_searches = 2  # Process 2 tracks at a time (fallback search only)
        
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
        # Apple Music developer tokens must contain ONLY iss/iat/exp. Any extra claim (aud/sub)
        # makes MusicKit's authorize() reject the token with ERROR_FAILED_TO_VERIFY_JWT. (The
        # read-only catalog API tolerates extras — which is why the catalogue matcher worked with an
        # `aud` present — but the user-authorization flow strictly verifies the claim set.)
        payload = {
            "iss": settings.apple_team_id,
            "iat": now,
            "exp": now + settings.apple_token_ttl,
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
            "Content-Type": "application/json; charset=utf-8",
        }
        if user_token:
            h["Music-User-Token"] = user_token
        return h
    
    async def _search_song(self, dev_token: str, isrc: Optional[str] = None,
                          title: Optional[str] = None, artist: Optional[str] = None,
                          storefront: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Fallback search for a catalog song on Apple Music (only for tracks with no stored
        apple_song_id — e.g. an uploaded seed or an unmatched catalogue track):
          1) By ISRC (fast and accurate)
          2) By search term "title artist" (best effort)

        Args:
            dev_token: Developer token
            isrc: ISRC code (optional)
            title: Track title (optional)
            artist: Artist name (optional)
            storefront: Apple storefront to search in (defaults to the catalogue storefront).
                        Pass the *user's* storefront so the resulting id is valid for their library.

        Returns:
            First matched song object with id and type 'songs' or None
        """
        loop = asyncio.get_event_loop()
        session = requests.Session()
        sf = storefront or settings.apple_storefront

        # 1) ISRC filter
        if isrc:
            url = f"{APPLE_API}/v1/catalog/{sf}/songs"
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
            url = f"{APPLE_API}/v1/catalog/{sf}/search"
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
                                         track_data: List[Tuple[int, Optional[str], str, str]],
                                         storefront: Optional[str] = None) -> List[Tuple[int, Optional[str]]]:
        """
        Fallback: search for multiple tracks concurrently on Apple Music (only tracks with no
        stored apple_song_id).

        Args:
            dev_token: Developer token
            track_data: List of tuples (track_id, isrc, title, artist)
            storefront: Storefront to search in (the user's, so ids are library-valid)

        Returns:
            List of tuples (track_id, apple_music_id or None)
        """
        logger.info("Searching %d tracks concurrently (fallback)", len(track_data))

        start_time = time.time()

        def search_single_track(track_info):
            track_id, isrc, title, artist = track_info
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    self._search_song(dev_token, isrc=isrc, title=title, artist=artist, storefront=storefront)
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
    
    async def _resolve_seed_reference(
        self, db: AsyncSession, seed_track_id: Optional[int]
    ) -> Tuple[str, str]:
        """Resolve the seed track's ``(title, artist)`` for the exported playlist's name.

        Order matters, and mirrors what the user already sees on the playlist page:

        1. **Apple's own metadata** — authoritative for a catalogue seed, and keeps the exported
           name consistent with what Apple shows.
        2. **Contributors** (``track_contributors`` -> ``contributors.full_name``) — this is where an
           UPLOAD carries its artist, and it is exactly what the playlist view reads. Missing this
           step is why an upload seeded playlist exported as "Unknown Artist" while the playlist
           itself displayed the artist correctly.
        3. ``tracks.display_artist`` — often empty for uploads, so it cannot be the only fallback.
        """
        title: Optional[str] = None
        artist: Optional[str] = None

        if seed_track_id:
            seed_apple = (await self.apple_music_repository.async_get_by_track_ids(
                db, [seed_track_id])).get(seed_track_id)
            if seed_apple:
                title = seed_apple.get("name")
                artist = seed_apple.get("artist")

            if not (title and artist):
                seed_track = await self.track_repository.async_get_by_id(db, seed_track_id)
                if seed_track:
                    title = title or seed_track.title
                    artist = artist or getattr(seed_track, "display_artist", None)

            if not artist:
                try:
                    contributors = await self.track_repository.async_get_track_artists(
                        db, seed_track_id
                    )
                    names = [
                        c.full_name.strip()
                        for c in (contributors or [])
                        if getattr(c, "full_name", None) and c.full_name.strip()
                    ]
                    if names:
                        artist = ", ".join(names)
                except Exception as exc:  # pragma: no cover - naming must never fail the export
                    logger.warning("Could not read seed contributors for %s: %s", seed_track_id, exc)

        return (title or "Unknown Track").strip(), (artist or "Unknown Artist").strip()

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
            lambda: _http_request("POST", url, headers=self._apple_headers(dev_token, user_token),
                                  data=json.dumps(payload), retry_5xx=False)
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
    
    async def _verify_playlist(self, dev_token: str, user_token: str,
                               playlist_id: str, expected: int) -> Optional[int]:
        """Read the playlist back and return how many tracks Apple actually holds.

        WHY THIS EXISTS

        ``_add_tracks_to_playlist`` counts a batch as added whenever the POST returns OK. Apple
        answers that call with **204 No Content**, so there is nothing in the body to confirm and a
        batch it accepted-then-dropped (a catalogue id that is not valid in the user's storefront
        is the usual cause) still counted. We were reporting a number we had never checked.

        Returns ``None`` when we genuinely could not read it — distinct from ``0``, which means
        Apple says the playlist is empty. Reporting a failed read as zero would turn "we don't
        know" into "it definitely failed".

        RETRIES BECAUSE APPLE IS EVENTUALLY CONSISTENT

        Reading a just-created playlist can return no tracks; they appear a few seconds later. A
        single immediate read would therefore report 0 for a perfectly good export. Three attempts
        over ~7s covers the observed lag without making the user wait on a slow path — and if it is
        still 0 after that, `expected` is what we compare against so a partial add is still caught.
        """
        url = f"{APPLE_API}/v1/me/library/playlists/{playlist_id}/tracks"
        loop = asyncio.get_event_loop()

        for attempt, delay in enumerate((0, 2, 5)):
            if delay:
                await asyncio.sleep(delay)
            try:
                r = await loop.run_in_executor(
                    None,
                    lambda: _http_request(
                        "GET", url, headers=self._apple_headers(dev_token, user_token),
                        params={"limit": 1},
                    ),
                )
            except Exception as e:  # noqa: BLE001 — verification must never fail the export
                logger.warning("Could not verify Apple playlist %s: %s", playlist_id, e)
                return None

            # 404 on a playlist we just created is the propagation window, not an absence.
            if r.status_code == 404:
                continue
            if not r.ok:
                logger.warning("Verify read failed for %s: %s %s", playlist_id, r.status_code, r.text[:200])
                return None

            js = r.json()
            total = (js.get("meta") or {}).get("total")
            if total is None:
                total = len(js.get("data") or [])
            total = int(total)

            # Good enough — stop early rather than burning the full back-off on a healthy export.
            if total >= expected or attempt == 2:
                return total

        return None

    async def _get_created_playlist_url(self, dev_token: str, user_token: str,
                                        playlist_id: str, storefront: Optional[str]) -> Optional[str]:
        """Best-effort openable URL for the just-created library playlist.

        Preference: a public catalog URL (once Apple has synced a ``globalId``), else an explicit
        ``attributes.url`` if returned, else the owner-openable **library** URL — which always works
        for the person who just authorised, since it's their own library. Purely for display; we
        never fail the export over it, so any error just yields the library-URL fallback.
        """
        # Owner-openable fallback (the user is signed in — it's their library).
        fallback = f"https://music.apple.com/library/playlist/{playlist_id}"
        try:
            url = f"{APPLE_API}/v1/me/library/playlists/{playlist_id}"
            loop = asyncio.get_event_loop()
            r = await loop.run_in_executor(
                None,
                lambda: _http_request("GET", url, headers=self._apple_headers(dev_token, user_token))
            )
            if not r.ok:
                return fallback
            attrs = ((r.json().get("data") or [{}])[0] or {}).get("attributes", {}) or {}
            global_id = (attrs.get("playParams") or {}).get("globalId")
            if global_id and storefront:
                return f"https://music.apple.com/{storefront}/playlist/{global_id}"
            if attrs.get("url"):
                return attrs["url"]
        except Exception as e:
            logger.warning("Could not resolve Apple playlist URL: %s", str(e))
        return fallback

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
        tracks_added = 0
        loop = asyncio.get_event_loop()

        for i in range(0, len(catalog_song_ids), ADD_TRACKS_BATCH):
            batch = catalog_song_ids[i:i + ADD_TRACKS_BATCH]
            payload = {"data": [{"id": sid, "type": "songs"} for sid in batch]}

            try:
                r = await loop.run_in_executor(
                    None,
                    lambda p=payload: _http_request("POST", url, headers=self._apple_headers(dev_token, user_token),
                                                    data=json.dumps(p))
                )
                if not r.ok:
                    logger.error("Failed to add tracks batch %d: %s", (i // ADD_TRACKS_BATCH) + 1, r.text)
                    continue
                tracks_added += len(batch)
            except Exception as e:
                logger.error("Exception adding tracks batch %d: %s", (i // ADD_TRACKS_BATCH) + 1, str(e))
        
        logger.info("Successfully added %d tracks to playlist", tracks_added)
        return tracks_added
    
    async def _get_user_storefront(self, dev_token: str, user_token: str) -> Optional[str]:
        """Return the user's Apple Music storefront id (e.g. 'us'), or None on failure."""
        url = f"{APPLE_API}/v1/me/storefront"
        loop = asyncio.get_event_loop()
        try:
            r = await loop.run_in_executor(
                None,
                lambda: _http_request("GET", url, headers=self._apple_headers(dev_token, user_token))
            )
            if r.ok:
                data = (r.json().get("data") or [])
                if data:
                    return ((data[0].get("id") or "").lower()) or None
        except Exception as e:
            logger.warning("Failed to fetch user storefront: %s", str(e))
        return None

    async def _resolve_songs_by_isrc(self, dev_token: str, storefront: str,
                                     isrcs: List[str]) -> Dict[str, str]:
        """Resolve ISRCs → catalog song ids in the given storefront (batched, ISRC_BATCH/call).

        Used to translate our catalogue-storefront matches into the user's storefront so the ids
        are valid for their library (Apple catalog ids are storefront-specific).
        """
        out: Dict[str, str] = {}
        unique = list(dict.fromkeys([i for i in isrcs if i]))
        if not unique:
            return out
        loop = asyncio.get_event_loop()
        for i in range(0, len(unique), ISRC_BATCH):
            batch = unique[i:i + ISRC_BATCH]
            url = f"{APPLE_API}/v1/catalog/{storefront}/songs"
            params = {"filter[isrc]": ",".join(batch)}
            try:
                r = await loop.run_in_executor(
                    None,
                    lambda p=params: _http_request("GET", url, headers=self._apple_headers(dev_token), params=p)
                )
                if r.ok:
                    for song in (r.json().get("data") or []):
                        aisrc = (song.get("attributes") or {}).get("isrc")
                        sid = song.get("id")
                        if aisrc and sid and aisrc not in out:
                            out[aisrc] = sid
            except Exception as e:
                logger.warning("ISRC batch resolve failed: %s", str(e))
        return out

    # ------------------------------------------------------------------ connection (persisted link)

    async def save_connection(self, db: AsyncSession, user_id: int, music_user_token: str) -> Dict[str, Any]:
        """Validate + persist a user's Apple Music connection (token encrypted at rest).

        Validates the token by fetching the user's storefront; a token that can't be verified is
        rejected rather than stored (so a saved connection always means a working one).
        """
        dev_token, _ = self.get_or_create_dev_token()
        storefront = await self._get_user_storefront(dev_token, music_user_token)
        if not storefront:
            raise ValueError("Could not verify your Apple Music account. Please try connecting again.")

        await self.connection_repository.async_upsert(
            db, user_id, ServiceProvider.APPLE_MUSIC, encrypt_secret(music_user_token),
            token_type="music_user_token", region=storefront,
        )
        logger.info("Saved Apple Music connection for user %s (storefront=%s)", user_id, storefront)
        return {"connected": True, "storefront": storefront}

    async def get_connection_status(self, db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """Return whether the user has a stored Apple Music connection."""
        conn = await self.connection_repository.async_get(db, user_id, ServiceProvider.APPLE_MUSIC)
        if not conn:
            return {"connected": False, "storefront": None, "connected_at": None}
        return {
            "connected": True,
            "storefront": conn.region,
            "connected_at": conn.created_at.isoformat() if conn.created_at else None,
        }

    async def delete_connection(self, db: AsyncSession, user_id: int) -> bool:
        """Remove the user's stored Apple Music connection (disconnect)."""
        removed = await self.connection_repository.async_delete(db, user_id, ServiceProvider.APPLE_MUSIC)
        if removed:
            logger.info("Removed Apple Music connection for user %s", user_id)
        return removed

    async def _resolve_user_token(self, db: AsyncSession, user_id: Optional[int],
                                  provided_token: Optional[str]) -> str:
        """Return the music-user-token to use: the provided one, else the user's stored one."""
        if provided_token:
            return provided_token
        if user_id is not None:
            conn = await self.connection_repository.async_get(db, user_id, ServiceProvider.APPLE_MUSIC)
            token = decrypt_secret(conn.access_token_enc) if conn else None
            if token:
                return token
        raise ValueError("Apple Music is not connected. Please connect your Apple Music account first.")

    async def transfer_playlist_to_apple_music(self, db: AsyncSession, playlist_id: str,
                                               music_user_token: Optional[str] = None,
                                               custom_playlist_name: Optional[str] = None,
                                               user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Transfer a Resomix playlist to Apple Music using our curated internal Apple song ids.

        Matching strategy (fast + reliable — no per-track metadata search):
          1. Read the pre-matched ``apple_song_id`` (+ ISRC) for each track from ``apple_music_tracks``.
          2. If the user's storefront == our catalogue storefront, use those ids directly.
             Otherwise resolve them to the user's storefront by ISRC (catalog ids are
             storefront-specific), batched.
          3. Only tracks with no stored match (e.g. an uploaded seed, or a rare unmatched
             catalogue track) fall back to the old ISRC/title+artist search.

        Args:
            db: Database session
            playlist_id: Resomix playlist UUID
            music_user_token: Apple Music User Token
            custom_playlist_name: Optional custom name for Apple Music playlist

        Returns:
            Transfer result with statistics and details
        """
        logger.info("Starting Apple Music playlist transfer (stored-id mode)...")
        transfer_start_time = time.time()

        try:
            # 0) Resolve the music-user-token: the one passed in, else the user's saved connection.
            music_user_token = await self._resolve_user_token(db, user_id, music_user_token)

            # 1) Developer token (server-side) + playlist + tracks (order preserved).
            dev_token, _ = self.get_or_create_dev_token()

            playlist = await self.playlist_repository.async_get_playlist_by_uuid(db, playlist_id)
            if not playlist:
                raise ValueError(f"Playlist with ID {playlist_id} not found")

            playlist_tracks = await self.playlist_repository.async_get_tracks_by_playlist_id(db, playlist.id)
            if not playlist_tracks:
                raise ValueError(f"Playlist {playlist_id} has no tracks to transfer")

            ordered_track_ids = [pt.track_id for pt in playlist_tracks]
            logger.info("Playlist '%s' has %d tracks", playlist.name, len(ordered_track_ids))

            # 2) Curated Apple matches for these tracks (one DB read).
            apple_matches = await self.apple_music_repository.async_get_by_track_ids(db, ordered_track_ids)

            # 3) Decide direct-id vs storefront resolution.
            catalogue_sf = (settings.apple_storefront or "us").lower()
            user_sf = (await self._get_user_storefront(dev_token, music_user_token)) or catalogue_sf
            same_storefront = user_sf == catalogue_sf
            logger.info("Catalogue storefront=%s, user storefront=%s (same=%s)", catalogue_sf, user_sf, same_storefront)

            direct: Dict[int, str] = {}          # track_id -> catalog id usable as-is
            need_isrc: List[Tuple[int, str]] = []  # cross-storefront, resolve by ISRC
            need_search: List[int] = []            # no stored match -> fallback search
            display_by_track: Dict[int, Dict[str, str]] = {}

            for tid in ordered_track_ids:
                m = apple_matches.get(tid)
                if m and m.get("apple_song_id"):
                    display_by_track[tid] = {"title": m.get("name") or "Unknown", "artist": m.get("artist") or "Unknown"}
                    if same_storefront or not m.get("isrc"):
                        # Same storefront → id is valid. No ISRC → best-effort direct id.
                        direct[tid] = m["apple_song_id"]
                    else:
                        need_isrc.append((tid, m["isrc"]))
                else:
                    need_search.append(tid)

            # 4) Cross-storefront ISRC resolution (batched).
            resolved: Dict[int, str] = {}
            if need_isrc:
                isrc_map = await self._resolve_songs_by_isrc(dev_token, user_sf, [i for _, i in need_isrc])
                for tid, isrc in need_isrc:
                    sid = isrc_map.get(isrc)
                    if sid:
                        resolved[tid] = sid
                    else:
                        need_search.append(tid)  # couldn't resolve → try fallback search

            # 5) Fallback search (only tracks with no stored/resolved id), in the user's storefront.
            if need_search:
                search_input: List[Tuple[int, Optional[str], str, str]] = []
                for tid in need_search:
                    track = await self.track_repository.async_get_by_id(db, tid)
                    if not track:
                        continue
                    title = track.title or "Unknown Track"
                    artist = track.display_artist or "Unknown Artist"
                    display_by_track.setdefault(tid, {"title": title, "artist": artist})
                    search_input.append((tid, getattr(track, "isrc", None), title, artist))
                if search_input:
                    for tid, sid in await self._search_tracks_concurrently(dev_token, search_input, storefront=user_sf):
                        if sid:
                            resolved[tid] = sid

            # 6) Assemble catalog ids in playlist order (dedup — two tracks can map to one Apple song).
            id_by_track: Dict[int, str] = {**direct, **resolved}
            matched_ids: List[str] = []
            unmatched_tracks: List[Dict[str, str]] = []
            seen_ids: set = set()
            for tid in ordered_track_ids:
                sid = id_by_track.get(tid)
                if sid and sid not in seen_ids:
                    seen_ids.add(sid)
                    matched_ids.append(sid)
                elif not sid:
                    unmatched_tracks.append(display_by_track.get(tid, {"title": "Unknown", "artist": "Unknown"}))

            logger.info("Matched %d/%d tracks (%d not found)", len(matched_ids), len(ordered_track_ids), len(unmatched_tracks))

            # 7) Create the Apple Music playlist and add the tracks.
            #    Name + description are built from the SEED (reference) track — the song this playlist
            #    was generated from — so the export reads like the Resomix result and is understandable
            #    to someone who's never heard of the service. "Artist - Title" uses the Apple-enriched
            #    name/artist first, with the in-house metadata as fallback.
            seed_title, seed_artist = await self._resolve_seed_reference(db, playlist.seed_track_id)
            seed_ref = f"{seed_artist} - {seed_title}"

            # Most common INDIVIDUAL artist across the playlist (multi-artist values are pipe-joined,
            # so this splits on "|" and counts each artist, not the combined string). Apple's library
            # playlist has no artist field, so we surface it in the description instead.
            top_artist = _most_common_artist(d.get("artist") for d in display_by_track.values())

            playlist_url = f"{settings.app_url.rstrip('/')}/sonic-discovery?id={playlist_id}"
            playlist_name = custom_playlist_name or f'Resomix Sonic Match Found, for "{seed_ref}"'
            featuring = f"Featuring {top_artist} and more. " if top_artist else ""
            playlist_description = (
                f'{featuring}Sonic matches for "{seed_ref}", discovered with Resomix — a music '
                f'discovery engine that listens to a track and finds the songs that sound closest to '
                f'it. Made by Resomix. Hear the full match and discover more at {playlist_url}'
            )
            apple_playlist_id = await self._create_playlist(
                dev_token, music_user_token, playlist_name,
                description=playlist_description,
            )

            tracks_added = 0
            if matched_ids:
                tracks_added = await self._add_tracks_to_playlist(dev_token, music_user_token, apple_playlist_id, matched_ids)
            else:
                logger.warning("No tracks resolved on Apple Music to add to playlist")

            # Read the playlist back before claiming anything. `tracks_added` above is only what
            # Apple ACCEPTED; this is what it actually holds. `None` means we could not check —
            # deliberately not folded into 0, which would report a healthy export as a failure.
            verified_tracks = await self._verify_playlist(
                dev_token, music_user_token, apple_playlist_id, tracks_added,
            )

            # Best-effort openable URL for the created playlist (owner can jump straight to it in
            # Apple Music). Never fails the export — worst case it's None and the UI omits the link.
            apple_playlist_url = await self._get_created_playlist_url(
                dev_token, music_user_token, apple_playlist_id, user_sf,
            )

            total_time = time.time() - transfer_start_time
            result = {
                "created_playlist_id": apple_playlist_id,
                "created_playlist_name": playlist_name,
                "created_playlist_url": apple_playlist_url,
                # What Apple confirms it holds. None = we could not verify (not "zero").
                "verified_tracks": verified_tracks,
                # False only when we checked AND it is genuinely empty — the one case where
                # "Successfully transferred" would be a lie.
                "verified": None if verified_tracks is None else verified_tracks > 0,
                "storefront": user_sf,
                "total_tracks": len(ordered_track_ids),
                "matched": len(matched_ids),
                "tracks_added": tracks_added,
                "unmatched": len(unmatched_tracks),
                "unmatched_examples": unmatched_tracks[:5],
                "transfer_time_seconds": round(total_time, 2),
            }
            logger.info("Transfer done in %.1fs — %d/%d tracks added", total_time, tracks_added, len(ordered_track_ids))
            return result

        except Exception as e:
            total_time = time.time() - transfer_start_time
            logger.error("Transfer failed after %.1fs: %s", total_time, str(e))
            raise

