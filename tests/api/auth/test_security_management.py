import pytest
import requests
import uuid
from tests.conftest import BASE_URL
from tests.api.auth.test_auth_flow import verify_user_in_db, delete_user_if_exists

@pytest.fixture
def auth_session():
    """Create an authenticated session for a test user."""
    session = requests.Session()
    unique_id = str(uuid.uuid4())[:8]
    email = f"mgmt_{unique_id}@example.com"
    user_data = {
        "email": email,
        "username": f"mgr_{unique_id}",
        "password": "StrongPass123!",
        "name": "Management Test User"
    }
    
    # Register
    requests.post(f"{BASE_URL}/auth/register", json=user_data)
    
    # Verify in DB (required for login)
    import asyncio
    asyncio.run(verify_user_in_db(email))
    
    # Login
    login_payload = {
        "email_or_username": email,
        "password": user_data["password"]
    }
    response = session.post(f"{BASE_URL}/auth/login", json=login_payload)
    assert response.status_code == 200
    
    # Set the access token in the session headers
    access_token = response.json()["data"]["access_token"]
    session.headers.update({"Authorization": f"Bearer {access_token}"})
    
    yield session, user_data
    
    # Cleanup
    try:
        asyncio.run(delete_user_if_exists(email))
    except:
        pass

def test_get_active_sessions(auth_session):
    """Test retrieving active sessions for a user."""
    session, _ = auth_session
    response = session.get(f"{BASE_URL}/users/me/sessions")
    assert response.status_code == 200
    resp_json = response.json()
    assert resp_json["success"] is True
    sessions = resp_json["data"]["sessions"]
    assert isinstance(sessions, list)
    assert len(sessions) >= 1
    assert "session_id" in sessions[0]

def test_revoke_specific_session(auth_session):
    """Test revoking a specific session."""
    session, user_data = auth_session
    
    # 1. Get current sessions
    response = session.get(f"{BASE_URL}/users/me/sessions")
    sessions = response.json()["data"]["sessions"]
    session_id = sessions[0]["session_id"]
    
    # 2. Revoke it
    revoke_res = session.delete(f"{BASE_URL}/users/me/sessions/{session_id}")
    assert revoke_res.status_code == 200
    assert revoke_res.json()["success"] is True
    
    # 3. Verify it's gone (or at least refresh fails)
    # Note: Since we revoked the current session, refresh should fail
    refresh_res = session.post(f"{BASE_URL}/auth/refresh")
    assert refresh_res.status_code == 401

def test_enable_disable_2fa(auth_session):
    """Test enabling and disabling 2FA."""
    session, user_data = auth_session
    
    # 1. Enable 2FA
    enable_payload = {"method": "email"}
    response = session.post(f"{BASE_URL}/users/me/enable-2fa", json=enable_payload)
    assert response.status_code == 200
    assert response.json()["data"]["is_two_factor_enabled"] is True
    
    # 2. Verify profile reflects 2FA status
    profile_res = session.get(f"{BASE_URL}/users/me")
    assert profile_res.json()["data"]["is_two_factor_enabled"] is True
    
    # 3. Disable 2FA
    disable_payload = {"password": user_data["password"]}
    response = session.post(f"{BASE_URL}/users/me/disable-2fa", json=disable_payload)
    assert response.status_code == 200
    assert response.json()["success"] is True
    
    # 4. Verify profile reflects it's disabled
    profile_res = session.get(f"{BASE_URL}/users/me")
    assert profile_res.json()["data"]["is_two_factor_enabled"] is False
