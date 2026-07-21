"""
Apple Music playback enrichment (see docs/PLAYBACK_APPLE_MUSIC_PLAN.md §6, revised 2026-07-20)
==============================================================================================

The public catalogue plays from Apple previews. These unit tests pin the merge rule:
  * Apple is preferred for EVERY display field — title (Apple's `name`), artist, album, genre,
    year, duration, isrc — with the in-house value as fallback when the Apple field is NULL/empty;
    when both are missing, title/artist keep the repositories' "Unknown"/"N/A" placeholder while
    album/genre stay empty. `label` is the one field Apple never supplies (always in-house),
  * `playback` = "preview" when an Apple preview exists, else "hls" (no preview → NO Apple
    metadata is applied at all),
  * an un-renamed playlist name (the "Artist - Title" default) is re-derived from the merged seed
    so it matches what the UI displays; a user-chosen name is never touched,
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


def test_merge_with_preview_apple_wins_every_display_field():
    t = {"track_id": 5, "title": "Inhouse Title", "artist": "Inhouse Artist",
         "year": 2001, "duration": 100.0, "label": "L", "type": "internal"}
    ame._merge_apple_into_track(t, _apple_row())

    assert t["playback"] == "preview"
    assert t["preview_url"] == "https://prev/clip.m4a"
    assert t["artwork_url"] == "https://art/600.jpg"
    assert t["deep_link_url"].startswith("https://music.apple.com")
    assert t["apple_song_id"] == "1440899999"
    # Apple is authoritative for ALL display metadata (policy revised 2026-07-20):
    assert t["title"] == "Apple Name"      # Apple calls the track title `name`
    assert t["artist"] == "Apple Artist"
    assert t["album"] == "Apple Album"
    assert t["genre"] == "House | Dance"
    assert t["duration"] == 210.0  # 210000 ms → full length (metadata)
    assert t["isrc"] == "USAPL0000001"
    # ...label is the one field Apple never supplies — always in-house:
    assert t["label"] == "L"
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
    t = {"track_id": 5, "title": "Inhouse Title", "artist": "Inhouse Artist",
         "album": "InhouseAlbum", "genre": "InhouseGenre", "duration": 100.0,
         "year": 1990, "type": "internal"}
    ame._merge_apple_into_track(
        t, _apple_row(name=None, artist=None, album=None, genres=None,
                      duration_ms=None, release_date=None, isrc=None)
    )
    # Apple NULL → keep the in-house value (title/artist included)...
    assert t["title"] == "Inhouse Title"
    assert t["artist"] == "Inhouse Artist"
    assert t["album"] == "InhouseAlbum"
    assert t["genre"] == "InhouseGenre"
    assert t["duration"] == 100.0
    assert t["year"] == 1990
    # ...but the preview itself still comes through.
    assert t["playback"] == "preview"
    assert t["preview_url"] == "https://prev/clip.m4a"


def test_apple_empty_strings_never_overwrite_inhouse():
    """Empty-string Apple values are as good as NULL — a good in-house value must survive."""
    t = {"track_id": 5, "title": "Inhouse Title", "artist": "Inhouse Artist",
         "album": "InhouseAlbum", "genre": "InhouseGenre", "type": "internal"}
    ame._merge_apple_into_track(t, _apple_row(name="", artist="", album="", genres=""))
    assert t["title"] == "Inhouse Title"
    assert t["artist"] == "Inhouse Artist"
    assert t["album"] == "InhouseAlbum"
    assert t["genre"] == "InhouseGenre"


def test_placeholders_survive_when_both_sources_missing():
    """The repositories set "Unknown"/"N/A" BEFORE the merge; with no Apple value the merge must
    leave them alone (title/artist keep the placeholder, album/genre stay absent/empty)."""
    t = {"track_id": 5, "title": "Unknown", "artist": "N/A", "type": "internal"}
    ame._merge_apple_into_track(t, _apple_row(name=None, artist=None, album=None, genres=None))
    assert t["title"] == "Unknown"
    assert t["artist"] == "N/A"
    assert "album" not in t
    assert "genre" not in t


def test_no_preview_means_no_apple_metadata_at_all():
    """A match row WITHOUT a preview must not leak any Apple metadata into the track."""
    t = {"track_id": 9, "title": "Inhouse Title", "artist": "Inhouse Artist", "type": "internal"}
    ame._merge_apple_into_track(t, _apple_row(preview_url=None))
    assert t["playback"] == "hls"
    assert t["title"] == "Inhouse Title"
    assert t["artist"] == "Inhouse Artist"
    assert "album" not in t and "apple_song_id" not in t


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


# ---------------------------------------------------------------------------
# Playlist-name sync: playlist names are generated at CREATE time from the seed's in-house
# "Artist - Title" (before enrichment). Since Apple now wins those fields, the response-time merge
# re-derives an UN-RENAMED default name from the merged values — using the same formula the
# frontend compares against — so the hero's "was this renamed?" check agrees by construction.
# A user-chosen name must never be touched.
# ---------------------------------------------------------------------------

def _seed_payload(playlist_name):
    return {
        "queried_track": {"track_id": 1, "title": "germs (I) (I)", "artist": "Sikora",
                          "type": "internal"},
        "similar_tracks": [],
        "playlist": {"id": "p1", "name": playlist_name, "is_public": False},
    }


def _patch_repo(monkeypatch, mapping):
    async def fake_get(_db, _ids):
        return mapping
    monkeypatch.setattr(ame._apple_repo, "async_get_by_track_ids", fake_get)


@pytest.mark.asyncio
async def test_default_playlist_name_follows_apple_title(monkeypatch):
    _patch_repo(monkeypatch, {1: _apple_row(name="germs (I)", artist="Sikora")})
    data = _seed_payload("Sikora - germs (I) (I)")  # the un-renamed in-house default
    await ame.enrich_similarity_data_with_apple(None, data)
    assert data["queried_track"]["title"] == "germs (I)"
    assert data["playlist"]["name"] == "Sikora - germs (I)"


@pytest.mark.asyncio
async def test_user_renamed_playlist_is_never_touched(monkeypatch):
    _patch_repo(monkeypatch, {1: _apple_row(name="germs (I)", artist="Sikora")})
    data = _seed_payload("My Techno Set")
    await ame.enrich_similarity_data_with_apple(None, data)
    assert data["playlist"]["name"] == "My Techno Set"


@pytest.mark.asyncio
async def test_default_name_unchanged_when_apple_matches_inhouse(monkeypatch):
    _patch_repo(monkeypatch, {1: _apple_row(name="germs (I) (I)", artist="Sikora")})
    data = _seed_payload("Sikora - germs (I) (I)")
    await ame.enrich_similarity_data_with_apple(None, data)
    assert data["playlist"]["name"] == "Sikora - germs (I) (I)"


@pytest.mark.asyncio
async def test_default_name_unchanged_without_apple_match(monkeypatch):
    _patch_repo(monkeypatch, {})
    data = _seed_payload("Sikora - germs (I) (I)")
    await ame.enrich_similarity_data_with_apple(None, data)
    assert data["playlist"]["name"] == "Sikora - germs (I) (I)"
