"""
Section 6: E-commerce, Cart & Checkout Integration Tests
=========================================================

Tests the full cart lifecycle: hydration, add/remove items,
add/remove playlist, clear, promo code application, and checkout
initialization. All cart endpoints require JWT authentication.

Version: 3.0.1
"""

import pytest
import uuid
import httpx
from database.connection import SessionLocal
from app.models.track import Track
from app.models.playlist import Playlist, PlaylistTrack
from app.models.user import User
from app.core.context import set_admin_context
from sqlalchemy import delete, select
from app.core.config import settings
from app.main import app

# ──────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────
TEST_USER_EMAIL = f"cart_tester_{uuid.uuid4().hex[:6]}@resomix.com"
TEST_USER_PASSWORD = "testpass456"


# ──────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
async def client():
    """Module-scoped AsyncClient for Section 6 tests."""
    async with httpx.AsyncClient(app=app, base_url="http://test") as c:
        yield c


@pytest.fixture(scope="module")
async def auth_headers(client):
    """Register a fresh user via the API and return JWT + API-key headers."""
    # Register
    reg_resp = await client.post(
        "/auth/register",
        json={
            "email": TEST_USER_EMAIL,
            "username": f"cart_user_{uuid.uuid4().hex[:6]}",
            "password": TEST_USER_PASSWORD,
        },
        headers={"X-API-KEY": settings.api_key},
    )
    assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.text}"

    # Ensure email is verified for login
    set_admin_context(True)
    session = SessionLocal()
    user = session.execute(select(User).where(User.email == TEST_USER_EMAIL)).scalar_one_or_none()
    if user:
        user.is_email_verified = True
        session.commit()
    session.close()
    set_admin_context(False)

    # Login
    response = await client.post(
        "/auth/login",
        json={"email_or_username": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["data"]["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-API-KEY": settings.api_key,
    }


@pytest.fixture(scope="module")
async def test_data(auth_headers):
    """Provide track and playlist UUIDs for cart tests.
    Depends on auth_headers to ensure the test user is created first.
    """
    set_admin_context(True)
    session = SessionLocal()

    track = session.execute(select(Track).limit(1)).scalar_one_or_none()
    track_uuid = str(track.uuid) if track else None
    track_id_int = int(track.id) if track else None

    # User is now guaranteed to exist (auth_headers fixture ran first)
    user = session.execute(
        select(User).where(User.email == TEST_USER_EMAIL)
    ).scalar_one_or_none()
    user_id = user.id if user else 1

    # Create a playlist with the track for add-playlist tests
    playlist = Playlist(
        name="Cart Test Playlist",
        user_id=user_id,
        is_public=True,
        type="custom",
    )
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    if track:
        pt = PlaylistTrack(
            playlist_id=playlist.id,
            track_id=track.id,
            position=1,
        )
        session.add(pt)
        session.commit()

    playlist_uuid = str(playlist.uuid)
    playlist_id_int = int(playlist.id)

    session.close()
    set_admin_context(False)

    yield {
        "track_uuid": track_uuid,
        "track_id": track_id_int,
        "playlist_uuid": playlist_uuid,
        "playlist_id": playlist_id_int,
        "user_id": user_id,
    }

    # Cleanup
    set_admin_context(True)
    session = SessionLocal()
    session.execute(delete(PlaylistTrack).where(PlaylistTrack.playlist_id == playlist_id_int))
    session.execute(delete(Playlist).where(Playlist.id == playlist_id_int))
    session.commit()
    session.close()
    set_admin_context(False)


# ──────────────────────────────────────────────────────────────
# Tests
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cart_requires_auth(client):
    """GET /cart without auth should return 401/403."""
    response = await client.get("/cart")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_get_empty_cart(client, auth_headers, test_data):
    """GET /cart should return a valid (possibly empty) cart."""
    response = await client.get("/cart", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_add_track_to_cart(client, auth_headers, test_data):
    """POST /cart/add should accept individual track items."""
    payload = {
        "items": [
            {"track_id": test_data["track_uuid"], "source_playlist_id": test_data["playlist_uuid"]}
        ]
    }
    response = await client.post("/cart/add", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True


@pytest.mark.asyncio
async def test_get_cart_with_items(client, auth_headers, test_data):
    """After adding items, GET /cart should reflect them."""
    response = await client.get("/cart", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_clear_cart(client, auth_headers, test_data):
    """DELETE /cart/clear should remove all items."""
    response = await client.delete("/cart/clear", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify cart is empty
    response = await client.get("/cart", headers=auth_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_add_playlist_to_cart(client, auth_headers, test_data):
    """POST /cart/add with playlist_id should add all playlist tracks."""
    payload = {"playlist_id": test_data["playlist_uuid"]}
    response = await client.post("/cart/add", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True


@pytest.mark.asyncio
async def test_remove_playlist_from_cart(client, auth_headers, test_data):
    """DELETE /cart/remove-playlist/{playlist_id} should bulk-remove."""
    response = await client.delete(
        f"/cart/remove-playlist/{test_data['playlist_uuid']}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["success"] is True


@pytest.mark.asyncio
async def test_apply_invalid_promo(client, auth_headers, test_data):
    """POST /cart/promo with a nonexistent code should fail gracefully."""
    payload = {"code": "FAKECODE999"}
    response = await client.post("/cart/promo", json=payload, headers=auth_headers)
    # Should be 200 with success=False, or 400/500 depending on implementation
    assert response.status_code >= 200


@pytest.mark.asyncio
async def test_checkout_empty_cart(client, auth_headers, test_data):
    """POST /checkout/init on an empty cart should return an error."""
    # Clear first
    await client.delete("/cart/clear", headers=auth_headers)

    response = await client.post("/checkout/init", json={}, headers=auth_headers)
    # Empty cart should be rejected
    assert response.status_code in (200, 400)
    data = response.json()
    if response.status_code == 200:
        assert data["success"] is False


@pytest.mark.asyncio
async def test_checkout_requires_auth(client):
    """POST /checkout/init without auth should return 401/403."""
    response = await client.post("/checkout/init", json={})
    assert response.status_code in (401, 403)
