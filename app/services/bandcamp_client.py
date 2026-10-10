"""
Bandcamp client
===============

The ONLY place Resomix talks to Bandcamp. Everything else goes through ``BandcampClient`` so the
source can be swapped (an official API, a partner feed) without touching the import or the API.

IMPORTANT — UNOFFICIAL, PUBLIC PAGES ONLY
-----------------------------------------
Bandcamp has no public API for fan collections. This client reads the same PUBLIC data a logged-out
browser sees at ``https://bandcamp.com/<username>``: the fan page's embedded ``data-blob`` and the
``fancollection`` JSON endpoint that page itself calls to load more items. It never logs in, never
asks for or stores a password, cookie or token, and cannot see a collection the fan has hidden.

Because these are undocumented endpoints they MAY CHANGE OR BREAK WITHOUT NOTICE, and automated
access may be restricted by Bandcamp's terms of use. Keep the client polite (identifying
User-Agent, delay between requests, bounded retries, a hard request cap per sync, short cache) and
review Bandcamp's terms before widening its use.

Never call Bandcamp from the frontend — this module runs server-side only.
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import AsyncIterator, Awaitable, Callable, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

BANDCAMP_BASE_URL = "https://bandcamp.com"
COLLECTION_ITEMS_PATH = "/api/fancollection/1/collection_items"

USER_AGENT = "ResomixBot/1.0 (+https://resomix.com; collection import on user request)"
REQUEST_DELAY_S = 1.0
MAX_RETRIES = 3
BACKOFF_BASE_S = 2.0
MAX_RETRY_AFTER_S = 30.0
MAX_REQUESTS_PER_SYNC = 40
PAGE_SIZE = 100
FAN_CACHE_TTL_S = 300.0
TIMEOUT_S = 20.0

_USERNAME_RE = re.compile(r"^[a-z0-9_\-.]{1,100}$")
_PAGEDATA_TAG_RE = re.compile(r'<div\b[^>]*\bid="pagedata"[^>]*>', re.S)
_DATA_BLOB_RE = re.compile(r'\bdata-blob="([^"]*)"', re.S)


class BandcampError(Exception):
    """Base for every failure this client reports. ``str(e)`` is safe to show a user."""


class BandcampUserNotFound(BandcampError):
    pass


class BandcampCollectionPrivate(BandcampError):
    pass


class BandcampRateLimited(BandcampError):
    pass


class BandcampRequestCapReached(BandcampError):
    pass


@dataclass(frozen=True)
class BandcampFan:
    username: str
    fan_id: int
    name: Optional[str]
    item_count: int


@dataclass(frozen=True)
class BandcampItem:
    external_id: str
    item_type: str  # "album" | "track"
    artist: Optional[str]
    title: Optional[str]
    album: Optional[str]
    artwork_url: Optional[str]
    source_url: Optional[str]
    duration_ms: Optional[int]


def normalize_username(raw: str) -> str:
    """Accept ``name``, ``@name`` or a pasted ``https://bandcamp.com/name`` and return ``name``.

    Raises ``ValueError`` for anything that is not a fan username — including an artist
    subdomain (``artist.bandcamp.com``), which is a label/artist page, not a fan collection.
    """
    value = (raw or "").strip().lower()
    value = re.sub(r"^https?://", "", value)
    value = value.split("?", 1)[0].split("#", 1)[0].strip("/")
    if value.startswith("www."):
        value = value[4:]
    if value.startswith("bandcamp.com/"):
        value = value[len("bandcamp.com/"):].split("/", 1)[0]
    elif ".bandcamp.com" in value:
        raise ValueError("That is an artist page. Enter your Bandcamp fan username instead.")
    value = value.lstrip("@")
    if not _USERNAME_RE.match(value):
        raise ValueError("Enter a valid Bandcamp username.")
    return value


_fan_cache: Dict[str, Tuple[float, BandcampFan]] = {}


def clear_cache() -> None:
    _fan_cache.clear()


class BandcampClient:
    """Reads one fan's public collection. Create one instance per sync: the request cap is per instance."""

    def __init__(
        self,
        *,
        transport: Optional[httpx.AsyncBaseTransport] = None,
        request_delay_s: float = REQUEST_DELAY_S,
        max_requests: int = MAX_REQUESTS_PER_SYNC,
        max_retries: int = MAX_RETRIES,
        backoff_base_s: float = BACKOFF_BASE_S,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._transport = transport
        self._request_delay_s = request_delay_s
        self._max_requests = max_requests
        self._max_retries = max_retries
        self._backoff_base_s = backoff_base_s
        self._sleep = sleep
        self._requests_made = 0
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def requests_made(self) -> int:
        return self._requests_made

    async def __aenter__(self) -> "BandcampClient":
        self._client = httpx.AsyncClient(
            base_url=BANDCAMP_BASE_URL,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en"},
            timeout=TIMEOUT_S,
            follow_redirects=True,
            transport=self._transport,
        )
        return self

    async def __aexit__(self, *exc) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def get_fan(self, username: str) -> BandcampFan:
        """Load the public fan page. Raises not-found / private / rate-limited as typed errors."""
        cached = _fan_cache.get(username)
        if cached and cached[0] > time.monotonic():
            return cached[1]

        response = await self._request("GET", f"/{username}")
        if response.status_code == 404:
            raise BandcampUserNotFound(f"No Bandcamp user named '{username}'.")
        self._raise_for_status(response)

        blob = _extract_pagedata(response.text)
        if not isinstance(blob, dict):
            blob = {}
        fan_data = blob.get("fan_data") or {}
        if not fan_data.get("fan_id"):
            raise BandcampUserNotFound(f"No Bandcamp user named '{username}'.")

        # Heuristic: a public fan page always carries collection_data (seen live, Oct 2026), with
        # hidden_items_count for items the fan hid. Missing data, or nothing visible while items
        # are hidden, means the collection is not public. Revisit if the page format changes.
        collection_data = blob.get("collection_data")
        if fan_data.get("private") or not isinstance(collection_data, dict):
            raise BandcampCollectionPrivate(f"The Bandcamp collection of '{username}' is not public.")
        if not collection_data.get("item_count") and collection_data.get("hidden_items_count"):
            raise BandcampCollectionPrivate(f"The Bandcamp collection of '{username}' is not public.")

        fan = BandcampFan(
            username=username,
            fan_id=int(fan_data["fan_id"]),
            name=fan_data.get("name"),
            item_count=int(collection_data.get("item_count") or 0),
        )
        _fan_cache[username] = (time.monotonic() + FAN_CACHE_TTL_S, fan)
        return fan

    async def iter_collection(self, fan: BandcampFan) -> AsyncIterator[List[BandcampItem]]:
        """Yield the collection newest-first, one page at a time."""
        if fan.item_count == 0:
            return
        token = f"{int(time.time())}::a::"
        while True:
            response = await self._request(
                "POST",
                COLLECTION_ITEMS_PATH,
                json={"fan_id": fan.fan_id, "older_than_token": token, "count": PAGE_SIZE},
            )
            self._raise_for_status(response)
            try:
                payload = response.json()
            except ValueError as exc:
                raise BandcampError("Bandcamp returned an unreadable collection page.") from exc
            if payload.get("error"):
                raise BandcampError("Bandcamp refused the collection request.")

            items = [item for item in (_parse_item(raw) for raw in payload.get("items") or []) if item]
            if items:
                yield items
            next_token = payload.get("last_token")
            if not payload.get("more_available") or not next_token or next_token == token:
                return
            token = next_token

    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        if self._client is None:
            raise RuntimeError("BandcampClient must be used as an async context manager.")

        for attempt in range(self._max_retries + 1):
            if self._requests_made >= self._max_requests:
                raise BandcampRequestCapReached(
                    "Stopped early to stay within the Bandcamp request limit. Sync again later to continue."
                )
            if self._requests_made > 0:
                await self._sleep(self._request_delay_s)
            self._requests_made += 1

            try:
                response = await self._client.request(method, url, **kwargs)
            except httpx.TransportError as exc:
                logger.warning("Bandcamp %s %s failed (attempt %d): %s", method, url, attempt + 1, exc)
                if attempt == self._max_retries:
                    raise BandcampError("Could not reach Bandcamp. Please try again later.") from exc
                await self._sleep(self._backoff_base_s * (2 ** attempt))
                continue

            if response.status_code == 429 or response.status_code >= 500:
                if attempt == self._max_retries:
                    return response
                await self._sleep(self._retry_delay(response, attempt))
                continue
            return response

        raise AssertionError("unreachable")

    def _retry_delay(self, response: httpx.Response, attempt: int) -> float:
        retry_after = response.headers.get("Retry-After")
        if retry_after and retry_after.isdigit():
            return min(float(retry_after), MAX_RETRY_AFTER_S)
        return self._backoff_base_s * (2 ** attempt)

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        if response.status_code == 429:
            raise BandcampRateLimited("Bandcamp is rate limiting requests. Please try again later.")
        if response.status_code >= 400:
            raise BandcampError(f"Bandcamp returned HTTP {response.status_code}.")


def _extract_pagedata(page_html: str) -> Optional[dict]:
    tag = _PAGEDATA_TAG_RE.search(page_html or "")
    blob = _DATA_BLOB_RE.search(tag.group(0)) if tag else None
    if not blob:
        return None
    try:
        return json.loads(html.unescape(blob.group(1)))
    except ValueError:
        return None


def _parse_item(raw: dict) -> Optional[BandcampItem]:
    tralbum_id = raw.get("tralbum_id") or raw.get("item_id")
    if not tralbum_id:
        return None
    is_track = raw.get("tralbum_type") == "t" or raw.get("item_type") == "track"
    item_type = "track" if is_track else "album"

    duration_ms = None
    if is_track and raw.get("featured_track_duration"):
        try:
            duration_ms = int(float(raw["featured_track_duration"]) * 1000)
        except (TypeError, ValueError):
            duration_ms = None

    title = raw.get("item_title")
    return BandcampItem(
        external_id=f"{'t' if is_track else 'a'}{tralbum_id}",
        item_type=item_type,
        artist=raw.get("band_name"),
        title=title,
        album=raw.get("album_title") or (None if is_track else title),
        artwork_url=raw.get("item_art_url"),
        source_url=raw.get("item_url"),
        duration_ms=duration_ms,
    )
