"""
Apple Music playback enrichment (see docs/PLAYBACK_APPLE_MUSIC_PLAN.md)
======================================================================

The public catalogue plays from Apple previews. These unit tests pin the merge rule:
  * title / artist stay in-house; album / genre / year / duration / isrc come from Apple with an
    in-house fallback when Apple is NULL,
  * `playback` = "preview" when an Apple preview exists, else "hls",
  * the internal numeric `track_id` (used only for the join) never leaks into the response,
  * enrichment is best-effort — a lookup failure degrades to "hls", it never raises.
"""
import datetime

import pytest

from app.services import apple_music_enrichment as ame


def _apple_row(**over):
    row = {
        "apple_song_id": "1440899999",
        "isrc": "USAPL0000001",
        "name": "Apple Name",
        "artist": "Apple Artist",
        "album": "Apple Album",
        "genres": "House | Dance",
        "release_date": None,
        "duration_ms": 210000,
        "artwork_url": "https://art/600.jpg",
        "preview_url": "https://prev/clip.m4a",
        "deep_link_url": "https://music.apple.com/song/1440899999",
    }
    row.update(over)
    return row


def test_merge_with_preview_keeps_inhouse_title_artist_and_pulls_apple_meta():
    t = {"track_id": 5, "title": "Inhouse Title", "artist": "Inhouse Artist",
         "year": 2001, "duration": 100.0, "label": "L", "type": "internal"}
    ame._merge_apple_into_track(t, _apple_row())

    assert t["playback"] == "preview"
    assert t["preview_url"] == "https://prev/clip.m4a"
    assert t["artwork_url"] == "https://art/600.jpg"
    assert t["deep_link_url"].startswith("https://music.apple.com")
    assert t["apple_song_id"] == "1440899999"
    # Apple is authoritative for these:
    assert t["album"] == "Apple Album"
    assert t["genre"] == "House | Dance"
    assert t["duration"] == 210.0  # 210000 ms → full length (metadata)
    assert t["isrc"] == "USAPL0000001"
    # ...but title/artist stay in-house:
    assert t["title"] == "Inhouse Title"
    assert t["artist"] == "Inhouse Artist"
    # internal PK never leaks:
    assert "track_id" not in t


def test_merge_uses_apple_release_year():
    t = {"track_id": 5, "title": "T", "artist": "A", "year": 1999, "type": "internal"}
    ame._merge_apple_into_track(t, _apple_row(release_date=datetime.date(2021, 5, 4)))
    assert t["year"] == 2021


def test_merge_without_apple_is_hls():
    t = {"track_id": 9, "title": "T", "artist": "A", "type": "upload"}
    ame._merge_apple_into_track(t, None)
    assert t["playback"] == "hls"
    assert "preview_url" not in t
    assert "track_id" not in t


def test_merge_apple_row_without_preview_is_hls():
    t = {"track_id": 9, "title": "T", "artist": "A", "type": "internal"}
    ame._merge_apple_into_track(t, _apple_row(preview_url=None))
    assert t["playback"] == "hls"
    assert "preview_url" not in t


def test_apple_null_fields_fall_back_to_inhouse():
    t = {"track_id": 5, "title": "T", "artist": "A", "album": "InhouseAlbum",
         "genre": "InhouseGenre", "duration": 100.0, "year": 1990, "type": "internal"}
    ame._merge_apple_into_track(
        t, _apple_row(album=None, genres=None, duration_ms=None, release_date=None, isrc=None)
    )
    # Apple NULL → keep the in-house value...
    assert t["album"] == "InhouseAlbum"
    assert t["genre"] == "InhouseGenre"
    assert t["duration"] == 100.0
    assert t["year"] == 1990
    # ...but the preview itself still comes through.
    assert t["playback"] == "preview"
    assert t["preview_url"] == "https://prev/clip.m4a"


@pytest.mark.asyncio
async def test_enrich_tracks_batches_and_merges(monkeypatch):
    async def fake_get(_db, _ids):
        return {5: _apple_row()}
    monkeypatch.setattr(ame._apple_repo, "async_get_by_track_ids", fake_get)

    tracks = [
        {"track_id": 5, "title": "A", "artist": "a", "type": "internal"},
        {"track_id": 6, "title": "B", "artist": "b", "type": "internal"},
    ]
    await ame.enrich_tracks_with_apple(None, tracks)

    assert tracks[0]["playback"] == "preview" and tracks[0]["preview_url"]
    assert tracks[1]["playback"] == "hls" and "preview_url" not in tracks[1]


@pytest.mark.asyncio
async def test_enrich_is_best_effort_on_fetch_error(monkeypatch):
    async def boom(_db, _ids):
        raise RuntimeError("db down")
    monkeypatch.setattr(ame._apple_repo, "async_get_by_track_ids", boom)

    tracks = [{"track_id": 5, "title": "A", "artist": "a", "type": "internal"}]
    await ame.enrich_tracks_with_apple(None, tracks)  # must NOT raise
    assert tracks[0]["playback"] == "hls"


@pytest.mark.asyncio
async def test_enrich_similarity_data_covers_seed_and_members(monkeypatch):
    async def fake_get(_db, _ids):
        return {1: _apple_row()}
    monkeypatch.setattr(ame._apple_repo, "async_get_by_track_ids", fake_get)

    data = {
        "queried_track": {"track_id": 1, "title": "Seed", "artist": "s", "type": "internal"},
        "similar_tracks": [{"track_id": 2, "title": "M", "artist": "m", "type": "internal"}],
    }
    await ame.enrich_similarity_data_with_apple(None, data)

    assert data["queried_track"]["playback"] == "preview"
    assert data["similar_tracks"][0]["playback"] == "hls"
