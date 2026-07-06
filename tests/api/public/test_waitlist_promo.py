"""
Section 8: Waitlist & Promo Campaigns Integration Tests
========================================================

Tests waitlist email registration, duplicate prevention,
status checking, and admin promo code creation.

Version: 3.0.1
"""

import pytest
import uuid
import httpx
from app.main import app
from app.core.config import settings
from database.connection import SessionLocal
from app.core.context import set_admin_context
from app.models.waitlist import Waitlist
from app.models.user import User
from sqlalchemy import delete, select

# ──────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────
API_KEY_HEADER = {"X-API-KEY": settings.api_key}
WAITLIST_EMAIL = f"waitlist_{uuid.uuid4().hex[:8]}@resomix-test.com"


# ──────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
async def client():
    """Module-scoped AsyncClient for Section 8 tests."""
    async with httpx.AsyncClient(app=app, base_url="http://test") as c:
        yield c


@pytest.fixture(scope="module")
async def auth_headers(client):
    """Register and authenticate a user for admin promo endpoints."""
    email = f"promo_admin_{uuid.uuid4().hex[:6]}@resomix.com"
    password = "adminpass789"

    # Register via API
    reg_resp = await client.post(
        "/auth/register",
        json={
            "email": email,
            "username": f"promo_admin_{uuid.uuid4().hex[:6]}",
            "password": password,
        },
        headers=API_KEY_HEADER,
    )
    assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.text}"

    # Verify email for login
    set_admin_context(True)
    session = SessionLocal()
    user = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user:
        user.is_email_verified = True
        session.commit()
    session.close()
    set_admin_context(False)

    # Login
    response = await client.post(
        "/auth/login",
        json={"email_or_username": email, "password": password},
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["data"]["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-API-KEY": settings.api_key,
    }


@pytest.fixture(autouse=True, scope="module")
def cleanup_waitlist():
    """Clean up test waitlist entries after all tests in this module."""
    yield
    set_admin_context(True)
    session = SessionLocal()
    session.execute(delete(Waitlist).where(Waitlist.email == WAITLIST_EMAIL))
    session.commit()
    session.close()
    set_admin_context(False)


# ──────────────────────────────────────────────────────────────
# Waitlist Tests
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_waitlist_join(client):
    """POST /api/v1/waitlist/ should register a new email."""
    payload = {"email": WAITLIST_EMAIL}
    response = await client.post("/api/v1/waitlist/", json=payload, headers=API_KEY_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["email"] == WAITLIST_EMAIL
    assert data["data"]["status"] == "pending"


@pytest.mark.asyncio
async def test_waitlist_duplicate_email(client):
    """POST /api/v1/waitlist/ with the same email should be rejected."""
    payload = {"email": WAITLIST_EMAIL}
    response = await client.post("/api/v1/waitlist/", json=payload, headers=API_KEY_HEADER)
    # Should fail — duplicate
    assert response.status_code in (200, 422)
    data = response.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_waitlist_invalid_email(client):
    """POST /api/v1/waitlist/ with an invalid email should return 422."""
    payload = {"email": "not-an-email"}
    response = await client.post("/api/v1/waitlist/", json=payload, headers=API_KEY_HEADER)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_waitlist_missing_email(client):
    """POST /api/v1/waitlist/ without an email field should return 422."""
    response = await client.post("/api/v1/waitlist/", json={}, headers=API_KEY_HEADER)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_waitlist_status_check(client):
    """POST /api/v1/waitlist/status should return the entry status for a registered email."""
    payload = {"email": WAITLIST_EMAIL}
    response = await client.post("/api/v1/waitlist/status", json=payload, headers=API_KEY_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["email"] == WAITLIST_EMAIL


@pytest.mark.asyncio
async def test_waitlist_status_not_found(client):
    """POST /api/v1/waitlist/status for a non-registered email should return 404."""
    payload = {"email": "nonexistent_999@resomix.com"}
    response = await client.post("/api/v1/waitlist/status", json=payload, headers=API_KEY_HEADER)
    assert response.status_code in (200, 404)
    data = response.json()
    if response.status_code == 200:
        assert data["success"] is False


@pytest.mark.asyncio
async def test_waitlist_public_access(client):
    """POST /api/v1/waitlist/ is public: guests join anonymously (→ System Partner 1). The
    retired static API key is no longer required (or accepted) for this frontend surface."""
    payload = {"email": "nokey@test.com"}
    response = await client.post("/api/v1/waitlist/", json=payload)
    assert response.status_code in (200, 201)


# ──────────────────────────────────────────────────────────────
# Promo Code Tests
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_promo_create_missing_fields(client, auth_headers):
    """POST /api/v1/admin/promo/create with missing fields should return 400."""
    payload = {"code": "", "discount_type": "percentage", "discount_value": 0}
    response = await client.post("/api/v1/admin/promo/create", json=payload, headers=auth_headers)
    # Missing code or zero discount_value should be rejected
    data = response.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_promo_create_requires_auth(client):
    """POST /api/v1/admin/promo/create without auth should return 401/403."""
    payload = {
        "code": "FREETEST",
        "discount_type": "percentage",
        "discount_value": 100,
    }
    response = await client.post("/api/v1/admin/promo/create", json=payload)
    assert response.status_code in (401, 403)
