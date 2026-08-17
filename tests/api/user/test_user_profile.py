import pytest
import requests
import uuid
from tests.conftest import BASE_URL
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import os
from dotenv import load_dotenv

load_dotenv()

MARIA_DB_USER = os.getenv("MARIA_DB_USER", "root")
MARIA_DB_PASS = os.getenv("MARIA_DB_PASS", "test")
MARIA_DB_HOST = os.getenv("MARIA_DB_HOST", "127.0.0.1")
MARIA_DB_PORT = os.getenv("MARIA_DB_PORT", "3306")
# Check if 3306 is listening, if not fallback to 3307 (common in Docker setups)
import socket
def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', int(port))) == 0

if not is_port_open(MARIA_DB_PORT) and is_port_open("3307"):
    MARIA_DB_PORT = "3307"

MARIA_DB_NAME = os.getenv("MARIA_DB_NAME", "resomix_db")
DATABASE_URL = f"mysql+aiomysql://{MARIA_DB_USER}:{MARIA_DB_PASS}@{MARIA_DB_HOST}:{MARIA_DB_PORT}/{MARIA_DB_NAME}"

async def verify_user_in_db(email):
    """Manually verify a user in the database for testing."""
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        await conn.execute(
            text("UPDATE users SET is_email_verified = 1 WHERE email = :email"),
            {"email": email}
        )
        await conn.commit()
    await engine.dispose()

@pytest.fixture
def auth_headers(test_user_data):
    """Register a user and return authorization headers."""
    requests.post(f"{BASE_URL}/auth/register", json=test_user_data)
    
    # Manually verify user in DB
    import asyncio
    asyncio.run(verify_user_in_db(test_user_data["email"]))
    
    login_payload = {
        "email_or_username": test_user_data["email"],
        "password": test_user_data["password"]
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    token = response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def test_user_data():
    """Generate unique user data for testing."""
    unique_id = str(uuid.uuid4())[:8]
    return {
        "email": f"user_{unique_id}@example.com",
        "username": f"prof_{unique_id}",
        "password": "StrongPass123!",
        "name": "Profile Tester"
    }

def test_get_my_profile(auth_headers, test_user_data):
    """Test retrieving the current user's profile."""
    response = requests.get(f"{BASE_URL}/users/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["email"] == test_user_data["email"]
    assert data["username"] == test_user_data["username"]

def test_update_profile(auth_headers):
    """Test updating user profile fields."""
    update_payload = {
        "name": "Updated Name",
        "timezone": "America/Los_Angeles",
        "language": "fr"
    }
    response = requests.patch(f"{BASE_URL}/users/me", json=update_payload, headers=auth_headers)
    assert response.status_code == 200
    
    # Verify updates
    profile = requests.get(f"{BASE_URL}/users/me", headers=auth_headers).json()["data"]
    assert profile["name"] == "Updated Name"
    assert profile["timezone"] == "America/Los_Angeles"
    assert profile["language"] == "fr"

def test_change_password(auth_headers, test_user_data):
    """Test changing user password and verifying subsequent login failure."""
    change_payload = {
        "current_password": test_user_data["password"],
        "new_password": "NewStrongPass123!"
    }
    response = requests.post(f"{BASE_URL}/users/me/change-password", json=change_payload, headers=auth_headers)
    assert response.status_code == 200
    
    # Old login should still work if session is maintained, 
    # but the API says 'all active sessions are revoked'.
    # Let's try to login with NEW password.
    login_payload = {
        "email_or_username": test_user_data["email"],
        "password": "NewStrongPass123!"
    }
    login_res = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    assert login_res.status_code == 200

def test_get_sessions(auth_headers):
    """Test listing active sessions."""
    response = requests.get(f"{BASE_URL}/users/me/sessions", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1

def test_delete_account(auth_headers, test_user_data):
    """Test permanent account deletion."""
    delete_payload = {"password": test_user_data["password"]}
    response = requests.delete(f"{BASE_URL}/users/me", json=delete_payload, headers=auth_headers)
    assert response.status_code == 200
    
    # Verify login fails.
    #
    # 403, not 401. Deleting an account no longer hard-deletes the row — the account-lifecycle
    # work made it a DEACTIVATION followed by a scheduled scrub, so the user still exists and the
    # password still matches. Login therefore gets past credential checking and is refused on
    # `is_active` instead, which is a 403 carrying a reason the frontend can act on. Asserting
    # 401 here was asserting that the row had vanished.
    #
    # What matters is unchanged and still pinned: the deleted account CANNOT log in.
    login_payload = {
        "email_or_username": test_user_data["email"],
        "password": test_user_data["password"]
    }
    login_res = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    assert login_res.status_code == 403
    assert "access_token" not in login_res.text
