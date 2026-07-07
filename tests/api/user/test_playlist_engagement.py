
import pytest
import uuid
import httpx
import os
import asyncio
from database.connection import SessionLocal
from app.models.track import Track
from app.models.audio_file import AudioFile
from app.models.playlist import Playlist
from app.models.user import User
from app.core.context import set_admin_context
from sqlalchemy import delete, text, select
from app.core.config import settings
from unittest.mock import patch, MagicMock
from app.main import app

# Test constants
PARTNER_2_API_KEY = "rmx_test_V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"
# We need a real user for JWT-based tests. Using the one from seed if possible.
TEST_USER_EMAIL = "listener@resomix.com" 

@pytest.fixture(scope="module")
async def client():
    """Session-scoped AsyncClient for Section 5 tests."""
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture(scope="module")
async def auth_headers(client):
    """Get JWT headers for the test user."""
    # Ensure user exists for testing
    from app.models.user import User
    from app.core.security import hash_password
    from database.connection import AsyncSessionLocal
    import uuid

    password = "password123"
    hashed_password = hash_password(password)
    
    async with AsyncSessionLocal() as session:
        # Check if user exists
        result = await session.execute(select(User).where(User.email == TEST_USER_EMAIL))
        user = result.scalar_one_or_none()
        
        if not user:
            user = User(
                email=TEST_USER_EMAIL,
                username="test_listener",
                password_hash=hashed_password,
                is_email_verified=True,
                is_active=True,
                uuid=str(uuid.uuid4())
            )
            session.add(user)
            await session.commit()
        else:
            # Ensure it's verified and has the right password for the test
            user.is_email_verified = True
            user.password_hash = hashed_password
            await session.commit()

    # 1. Login to get authentication headers
    response = await client.post(
        "/auth/login", 
        json={"email_or_username": TEST_USER_EMAIL, "password": password}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["data"]["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-API-KEY": settings.api_key
    }


@pytest.fixture
def test_data():
    """Session-scoped test data (tracks, playlists) for Section 5."""
    set_admin_context(True)
    session = SessionLocal()
    
    # 1. Get a test track
    track = session.execute(select(Track).limit(1)).scalar_one_or_none()
    track_uuid = str(track.uuid) if track else str(uuid.uuid4())
    
    # 2. Create a test playlist owned by the test user

    # Find user_id first
    user = session.execute(select(User).where(User.email == TEST_USER_EMAIL)).scalar_one_or_none()
    user_id_int = user.id if user else 1
    user_uuid = str(user.uuid) if user else str(uuid.uuid4())

    # Check if a test playlist already exists for this user to avoid unique constraint issues
    playlist = session.execute(
        select(Playlist).where(Playlist.user_id == user_id_int, Playlist.name == "Engagement Test Playlist")
    ).scalar_one_or_none()

    if not playlist:
        playlist = Playlist(
            name="Engagement Test Playlist",
            user_id=user_id_int,
            is_public=True,
            type="custom"
        )
        session.add(playlist)
        session.commit()
        session.refresh(playlist)
    
    playlist_uuid = str(playlist.uuid)
    playlist_id_int = int(playlist.id)

    session.close()
    set_admin_context(False)
    
    yield {

        "track_uuid": track_uuid,
        "playlist_uuid": playlist_uuid,
        "playlist_id": playlist_id_int,
        "user_uuid": user_uuid
    }
    
    # Cleanup
    set_admin_context(True)
    session = SessionLocal()
    session.execute(delete(Playlist).where(Playlist.uuid == playlist_uuid))
    session.commit()
    session.close()
    set_admin_context(False)


@pytest.mark.asyncio
async def test_get_user_playlists(client, auth_headers, test_data):
    """Verify listing all user playlists."""
    response = await client.get("/api/v1/playlists/get-all-playlists/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    # Should at least find the one we created in test_data
    playlists = [p["id"] for p in data["data"]]
    assert test_data["playlist_uuid"] in playlists

@pytest.mark.asyncio
async def test_playlist_rename_and_visibility(client, auth_headers, test_data):
    """Verify renaming and changing visibility of a playlist."""
    # 1. Rename
    new_name = "Renamed Playlist"
    payload = {"playlist_id": test_data["playlist_uuid"], "new_name": new_name}
    response = await client.put("/api/v1/playlists/rename/", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True
    
    # 2. Toggle Visibility
    payload = {"playlist_id": test_data["playlist_uuid"], "is_public": True}
    response = await client.put("/api/v1/playlists/visibility/", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Forking is disabled/not live in frontend, so we skip testing it for now.

@pytest.mark.asyncio
async def test_playlist_engagement_fav_follow(client, auth_headers, test_data):
    """Verify adding/removing favorites and follows."""
    playlist_uuid = test_data["playlist_uuid"]
    
    # 1. Add Favorite
    response = await client.post(f"/playlist/add-favorite/{playlist_uuid}", headers=auth_headers)
    assert response.status_code == 200
    
    # 2. Remove Favorite
    response = await client.post(f"/playlist/remove-favorite/{playlist_uuid}", headers=auth_headers)
    assert response.status_code == 200
    
    # 3. Follow
    response = await client.post(f"/playlist/follow/{playlist_uuid}", headers=auth_headers)
    assert response.status_code == 200
    
    # 4. Unfollow
    response = await client.post(f"/playlist/unfollow/{playlist_uuid}", headers=auth_headers)
    assert response.status_code == 200

@pytest.fixture
def guest_playlist():
    """A playlist created by a guest: no owning user_id, only a visitor_id, public by default."""
    set_admin_context(True)
    session = SessionLocal()
    pl = Playlist(
        name="Guest Farm Playlist",
        user_id=None,
        is_public=True,
        type="similarity",
        guest_visitor_id="vid_" + uuid.uuid4().hex,
    )
    session.add(pl)
    session.commit()
    session.refresh(pl)
    pl_uuid = str(pl.uuid)
    session.close()
    set_admin_context(False)

    yield pl_uuid

    set_admin_context(True)
    session = SessionLocal()
    session.execute(delete(Playlist).where(Playlist.uuid == pl_uuid))
    session.commit()
    session.close()
    set_admin_context(False)


@pytest.mark.asyncio
async def test_cannot_favorite_guest_playlist(client, auth_headers, guest_playlist):
    """Anti-abuse: a guest-created playlist (user_id IS NULL) can't be favorited. Otherwise a user
    at their playlist cap could farm free playlists in an incognito tab and collect them as
    favorites to bypass the limit. The response is a clear 403, and the playlist never lands in the
    user's favorites list."""
    response = await client.post(f"/playlist/add-favorite/{guest_playlist}", headers=auth_headers)
    assert response.status_code == 403, response.text
    body = response.json()
    assert body["success"] is False
    assert "guest" in body["error"].lower()

    # It must NOT have been recorded as a favorite.
    fav = await client.get(
        "/api/v1/playlists/get-all-playlists/?all_favorites=true", headers=auth_headers
    )
    assert fav.status_code == 200
    fav_ids = [p["id"] for p in fav.json()["data"]]
    assert guest_playlist not in fav_ids


@pytest.mark.asyncio
async def test_favorite_appears_in_all_favorites_list(client, auth_headers, test_data):
    """A favorited (owned, public) playlist shows up in the library favorites tab (all_favorites)."""
    playlist_uuid = test_data["playlist_uuid"]

    add = await client.post(f"/playlist/add-favorite/{playlist_uuid}", headers=auth_headers)
    assert add.status_code == 200, add.text

    fav = await client.get(
        "/api/v1/playlists/get-all-playlists/?all_favorites=true", headers=auth_headers
    )
    assert fav.status_code == 200
    fav_ids = [p["id"] for p in fav.json()["data"]]
    assert playlist_uuid in fav_ids

    # Cleanup so the fixture teardown / other tests start clean.
    await client.post(f"/playlist/remove-favorite/{playlist_uuid}", headers=auth_headers)


@pytest.mark.asyncio
async def test_ratings_flow(client, auth_headers, test_data):
    """Verify track and playlist rating system."""
    # 1. Rate Track (0/1 similarity)
    payload = {
        "track_id": test_data["track_uuid"],
        "playlist_id": test_data["playlist_uuid"],
        "rating": 1
    }
    response = await client.post("/api/v1/ratings/tracks/", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True
    
    # 2. Get Track Stats
    response = await client.get(f"/api/v1/ratings/tracks/{test_data['track_uuid']}/stats", headers=auth_headers)
    assert response.status_code == 200
    
    assert response.json().get("success") is True
    assert response.json()["data"]["total_ratings"] >= 1
    assert response.json()["data"]["rating_distribution"]["1"] >= 1
    
    # 3. Rate Playlist (0-3 stars)
    payload = {
        "playlist_id": test_data["playlist_uuid"],
        "rating": 3,
        "message": "Excellent flow!"
    }
    response = await client.post("/api/v1/ratings/playlists/", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True
    
    # 4. Get Playlist Stats (using UUID)
    response = await client.get(f"/api/v1/ratings/playlists/{test_data['playlist_uuid']}/stats", headers=auth_headers)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert res_json["data"]["total_ratings"] >= 1
    assert res_json["data"]["rating_distribution"]["3"] >= 1


@pytest.mark.asyncio
async def test_telemetry_sync(client, auth_headers, test_data):
    """Verify stream telemetry batch synchronization."""
    payload = {
        "events": [
            {
                "tab_id": "test_tab_123",
                "track_id": test_data["track_uuid"],
                "playlist_id": test_data["playlist_uuid"],
                "event_type": "stream_start",
                "start_time": 1714000000,
                "duration_seconds": 0,
                "context": "playlist_view",
                "client_ts": 1714000000000
            },
            {
                "tab_id": "test_tab_123",
                "track_id": test_data["track_uuid"],
                "playlist_id": test_data["playlist_uuid"],
                "event_type": "stream_complete",
                "start_time": 1714000000,
                "duration_seconds": 120,
                "context": "playlist_view",
                "client_ts": 1714000120000
            }
        ]
    }
    # Telemetry is public (guest beacons → System Partner 1); no credentials needed.
    response = await client.post("/api/v1/telemetry/sync", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["data"]["accepted"] == 2

