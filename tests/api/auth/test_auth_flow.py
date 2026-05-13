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

async def delete_user_if_exists(email):
    """Delete a user from the database if they exist."""
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        # Delete related data first due to FK constraints if necessary, 
        # but users table has CASCADE for most relationships.
        await conn.execute(
            text("DELETE FROM users WHERE email = :email"),
            {"email": email}
        )
        await conn.commit()
    await engine.dispose()

@pytest.fixture
def test_user_data():
    """Generate unique user data for testing and ensure cleanup."""
    unique_id = str(uuid.uuid4())[:8]
    email = f"test_{unique_id}@example.com"
    data = {
        "email": email,
        "username": f"user_{unique_id}",
        "password": "StrongPass123!",
        "name": "Test User"
    }
    
    # Pre-test cleanup
    import asyncio
    asyncio.run(delete_user_if_exists(email))
    
    yield data
    
    # Post-test cleanup
    try:
        asyncio.run(delete_user_if_exists(email))
    except Exception:
        pass

def test_register_success(test_user_data):
    """Test successful user registration."""
    
    
    response = requests.post(f"{BASE_URL}/auth/register", json=test_user_data)
    if response.status_code != 201:
        print(f"Error Response: {response.text}")
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["email"] == test_user_data["email"]
    assert data["username"] == test_user_data["username"]
    assert "user_uuid" in data

def test_register_duplicate_email(test_user_data):
    """Test registration with an already existing email."""
    # First registration
    requests.post(f"{BASE_URL}/auth/register", json=test_user_data)
    
    # Second registration with same email
    duplicate_data = test_user_data.copy()
    duplicate_data["username"] = "different_user"
    response = requests.post(f"{BASE_URL}/auth/register", json=duplicate_data)
    assert response.status_code == 400
    assert "Email" in response.json()["error"]

def test_register_invalid_username(test_user_data):
    """Test registration with an invalid username format."""
    invalid_data = test_user_data.copy()
    invalid_data["username"] = "1abc"  # Must start with a letter
    response = requests.post(f"{BASE_URL}/auth/register", json=invalid_data)
    assert response.status_code == 422

def test_login_success(test_user_data):
    """Test successful login and token generation."""
    
    
    # Register first
    requests.post(f"{BASE_URL}/auth/register", json=test_user_data)
    
    # Manually verify user in DB
    import asyncio
    asyncio.run(verify_user_in_db(test_user_data["email"]))
    
    # Login
    login_payload = {
        "email_or_username": test_user_data["email"],
        "password": test_user_data["password"]
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()["data"]
    assert "access_token" in data
    assert data["user"]["email"] == test_user_data["email"]
    # Verify refresh token in cookies
    assert "refresh_token" in response.cookies

def test_login_invalid_credentials(test_user_data):
    """Test login with wrong password."""
    requests.post(f"{BASE_URL}/auth/register", json=test_user_data)
    
    # Manually verify user in DB
    import asyncio
    asyncio.run(verify_user_in_db(test_user_data["email"]))
    
    login_payload = {
        "email_or_username": test_user_data["email"],
        "password": "WrongPassword123"
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    assert response.status_code == 401

def test_refresh_token_flow(test_user_data):
    """Test the refresh token rotation flow."""
    session = requests.Session()
    
    # Register
    session.post(f"{BASE_URL}/auth/register", json=test_user_data)
    
    # Manually verify user in DB
    import asyncio
    asyncio.run(verify_user_in_db(test_user_data["email"]))
    
    login_payload = {
        "email_or_username": test_user_data["email"],
        "password": test_user_data["password"]
    }
    # Login (session will store the cookie)
    login_res = session.post(f"{BASE_URL}/auth/login", json=login_payload)
    assert login_res.status_code == 200
    
    # Refresh (session will send the cookie)
    refresh_res = session.post(f"{BASE_URL}/auth/refresh")
    if refresh_res.status_code != 200:
        print(f"Refresh Error: {refresh_res.text}")
        print(f"Session Cookies: {session.cookies.get_dict()}")
    assert refresh_res.status_code == 200
    assert "access_token" in refresh_res.json()["data"]
    assert "refresh_token" in session.cookies

def test_logout(test_user_data):
    """Test user logout and cookie clearing."""
    session = requests.Session()
    
    # Register
    session.post(f"{BASE_URL}/auth/register", json=test_user_data)
    
    # Manually verify user in DB
    import asyncio
    asyncio.run(verify_user_in_db(test_user_data["email"]))
    
    login_payload = {
        "email_or_username": test_user_data["email"],
        "password": test_user_data["password"]
    }
    # Login
    session.post(f"{BASE_URL}/auth/login", json=login_payload)
    
    # Logout
    logout_res = session.post(f"{BASE_URL}/auth/logout")
    if logout_res.status_code != 200:
        print(f"Logout Error: {logout_res.text}")
    assert logout_res.status_code == 200
    # Refresh token cookie should be cleared
    assert session.cookies.get("refresh_token") == "" or "refresh_token" not in session.cookies
