"""
BandcampClient against mocked HTTP
==================================

No network: every response comes from an ``httpx.MockTransport``, and sleeps are recorded instead
of awaited so retry/backoff paths run instantly.
"""

import html
import json
import time
from datetime import datetime, timezone

import httpx
import pytest

from app.services import bandcamp_client
from app.services.bandcamp_client import (
    COLLECTION_ITEMS_PATH,
    USER_AGENT,
    BandcampClient,
    BandcampCollectionPrivate,
    BandcampFan,
    BandcampRateLimited,
    BandcampRequestCapReached,
    BandcampUnavailable,
    BandcampUserNotFound,
    normalize_username,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    bandcamp_client.clear_cache()
    yield
    bandcamp_client.clear_cache()


def _fan_page(blob: dict) -> str:
    return f'<html><body><div id="pagedata" data-blob="{html.escape(json.dumps(blob), quote=True)}"></div></body></html>'


PUBLIC_BLOB = {
    "fan_data": {"fan_id": 4242, "name": "Martin"},
    "collection_data": {"item_count": 3},
}


def _item(tralbum_id: int, *, track: bool = False, title: str = "Title", token: str = None) -> dict:
    row = {
        "tralbum_id": tralbum_id,
        "tralbum_type": "t" if track else "a",
        "item_type": "track" if track else "album",
        "band_name": "Artist",
        "item_title": title,
        "album_title": None if track else title,
        "item_art_url": "https://f4.bcbits.com/img/a1_16.jpg",
        "item_url": f"https://artist.bandcamp.com/{'track' if track else 'album'}/{tralbum_id}",
        "featured_track_duration": 245.5 if track else None,
    }
    if token:
        row["token"] = token
    return row


class Recorder:
    def __init__(self):
        self.sleeps = []

    async def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)


def _client(handler, **kwargs) -> tuple:
    rec = Recorder()
    client = BandcampClient(transport=httpx.MockTransport(handler), sleep=rec.sleep, **kwargs)
    return client, rec


# --- username normalization --------------------------------------------------- #
@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Martin", "martin"),
        ("  @martin_b ", "martin_b"),
        ("https://bandcamp.com/martin", "martin"),
        ("bandcamp.com/martin/wishlist", "martin"),
        ("https://www.bandcamp.com/martin?from=x", "martin"),
    ],
)
def test_normalize_username(raw, expected):
    assert normalize_username(raw) == expected


@pytest.mark.parametrize("raw", ["", "   ", "artist.bandcamp.com", "bad name!", "x" * 101])
def test_normalize_username_rejects(raw):
    with pytest.raises(ValueError):
        normalize_username(raw)


# --- fan page ---------------------------------------------------------------- #
async def test_get_fan_reads_public_collection_and_sends_user_agent():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, text=_fan_page(PUBLIC_BLOB))

    client, _ = _client(handler)
    async with client:
        fan = await client.get_fan("martin")

    assert fan == BandcampFan(username="martin", fan_id=4242, name="Martin", item_count=3)
    assert seen[0].url.path == "/martin"
    assert seen[0].headers["User-Agent"] == USER_AGENT
    assert "cookie" not in {k.lower() for k in seen[0].headers}


async def test_get_fan_is_cached():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, text=_fan_page(PUBLIC_BLOB))

    client, _ = _client(handler)
    async with client:
        await client.get_fan("martin")
        await client.get_fan("martin")
    assert len(calls) == 1


async def test_fan_cache_drops_expired_entries_on_write():
    bandcamp_client._fan_cache["stale"] = (
        time.monotonic() - 1,
        BandcampFan(username="stale", fan_id=1, name=None, item_count=0),
    )

    def handler(request):
        return httpx.Response(200, text=_fan_page(PUBLIC_BLOB))

    client, _ = _client(handler)
    async with client:
        await client.get_fan("martin")
    assert "stale" not in bandcamp_client._fan_cache
    assert "martin" in bandcamp_client._fan_cache


async def test_get_fan_404_is_user_not_found():
    client, _ = _client(lambda r: httpx.Response(404, text="not found"))
    async with client:
        with pytest.raises(BandcampUserNotFound):
            await client.get_fan("nobody")


async def test_page_without_fan_data_is_user_not_found():
    client, _ = _client(lambda r: httpx.Response(200, text="<html>Bandcamp home</html>"))
    async with client:
        with pytest.raises(BandcampUserNotFound):
            await client.get_fan("nobody")


@pytest.mark.parametrize("body", ["<html><title>Client Challenge</title></html>", "<html>/_fs-ch- blocked</html>"])
async def test_client_challenge_is_unavailable(body):
    client, _ = _client(lambda r: httpx.Response(200, text=body))
    async with client:
        with pytest.raises(BandcampUnavailable):
            await client.get_fan("martin")


async def test_hidden_collection_is_private():
    blob = {"fan_data": {"fan_id": 1, "name": "Shy"}}
    client, _ = _client(lambda r: httpx.Response(200, text=_fan_page(blob)))
    async with client:
        with pytest.raises(BandcampCollectionPrivate):
            await client.get_fan("shy")


async def test_all_items_hidden_is_private():
    blob = {"fan_data": {"fan_id": 1}, "collection_data": {"item_count": 0, "hidden_items_count": 12}}
    client, _ = _client(lambda r: httpx.Response(200, text=_fan_page(blob)))
    async with client:
        with pytest.raises(BandcampCollectionPrivate):
            await client.get_fan("shy")


async def test_empty_public_collection_is_not_private():
    # Shape of a real empty public collection (live check, Oct 2026).
    blob = {
        "fan_data": {"fan_id": 14141743, "name": "mvr341"},
        "collection_data": {"item_count": 0, "hidden_items_count": 0, "last_token": None, "batch_size": 20},
    }
    client, _ = _client(lambda r: httpx.Response(200, text=_fan_page(blob)))
    async with client:
        fan = await client.get_fan("mvr341")
    assert fan.item_count == 0


async def test_429_retries_with_backoff_then_raises_rate_limited():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(429, headers={"Retry-After": "7"})

    client, rec = _client(handler, max_retries=2)
    async with client:
        with pytest.raises(BandcampRateLimited):
            await client.get_fan("martin")
    assert len(calls) == 3
    assert 7.0 in rec.sleeps


async def test_5xx_is_retried_then_succeeds():
    responses = iter([httpx.Response(503), httpx.Response(200, text=_fan_page(PUBLIC_BLOB))])
    client, rec = _client(lambda r: next(responses))
    async with client:
        fan = await client.get_fan("martin")
    assert fan.fan_id == 4242
    assert rec.sleeps  # backoff happened


# --- collection pagination ---------------------------------------------------- #
async def test_iter_collection_paginates_until_no_more():
    bodies = []

    def handler(request):
        assert request.url.path == COLLECTION_ITEMS_PATH
        body = json.loads(request.content)
        bodies.append(body)
        if len(bodies) == 1:
            return httpx.Response(
                200, json={"items": [_item(1), _item(2, track=True)], "more_available": True, "last_token": "t2"}
            )
        return httpx.Response(200, json={"items": [_item(3)], "more_available": False, "last_token": "t3"})

    client, rec = _client(handler, request_delay_s=0.5)
    fan = BandcampFan(username="martin", fan_id=4242, name=None, item_count=3)
    async with client:
        pages = [page async for page in client.iter_collection(fan)]

    assert [len(p) for p in pages] == [2, 1]
    assert bodies[0]["fan_id"] == 4242 and bodies[1]["older_than_token"] == "t2"
    assert 0.5 in rec.sleeps  # polite delay between requests

    album, track = pages[0]
    assert album.external_id == "a1" and album.item_type == "album" and album.album == "Title"
    assert track.external_id == "t2" and track.item_type == "track" and track.duration_ms == 245500


async def test_collection_page_client_challenge_is_unavailable():
    client, _ = _client(lambda r: httpx.Response(200, text="<html>Client Challenge</html>"))
    fan = BandcampFan(username="martin", fan_id=1, name=None, item_count=3)
    async with client:
        with pytest.raises(BandcampUnavailable):
            async for _page in client.iter_collection(fan):
                pass


async def test_item_token_sets_added_at_and_resume_token_is_honoured():
    seen = []

    def handler(request):
        seen.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "items": [_item(9, track=True, token="1700000000:9:t::")],
                "more_available": False,
                "last_token": "1700000000:9:t::",
            },
        )

    client, _ = _client(handler)
    fan = BandcampFan(username="martin", fan_id=1, name=None, item_count=1)
    async with client:
        pages = [page async for page in client.iter_collection(fan, older_than_token="1690000000::a::")]
    assert seen[0]["older_than_token"] == "1690000000::a::"
    assert pages[0][0].added_at == datetime.fromtimestamp(1700000000, timezone.utc).replace(tzinfo=None)


async def test_empty_collection_makes_no_item_requests():
    calls = []
    client, _ = _client(lambda r: calls.append(r) or httpx.Response(500))
    fan = BandcampFan(username="martin", fan_id=1, name=None, item_count=0)
    async with client:
        pages = [page async for page in client.iter_collection(fan)]
    assert pages == [] and calls == []


async def test_request_cap_stops_the_sync():
    tokens = iter(range(1000))

    def handler(request):
        return httpx.Response(
            200, json={"items": [_item(1)], "more_available": True, "last_token": f"tok{next(tokens)}"}
        )

    client, _ = _client(handler, max_requests=3)
    fan = BandcampFan(username="martin", fan_id=1, name=None, item_count=500)
    pages = []
    async with client:
        with pytest.raises(BandcampRequestCapReached) as exc_info:
            async for page in client.iter_collection(fan):
                pages.append(page)
    assert len(pages) == 3
    assert client.requests_made == 3
    assert exc_info.value.resume_token == "tok2"
