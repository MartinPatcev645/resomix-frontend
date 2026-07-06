import pytest
import requests
import uuid
import time
from app.core.config import settings

# Configuration for integration tests
BASE_URL = "http://localhost:8001"

@pytest.fixture(scope="module")
def admin_headers():
    """Admin-role JWT (the static super-key was retired). The live server on :8001 shares this
    process's DB and JWT secret, so a locally-minted admin token authenticates against it.

    Built with the *sync* SessionLocal (no asyncio.run) to avoid an event-loop conflict with the
    session-scoped async test loop."""
    import uuid as _uuid
    from sqlalchemy import select
    from database.connection import SessionLocal
    from app.core.context import set_admin_context
    from app.core.security import hash_password, create_access_token
    from app.models.user import User, Role, UserRole

    set_admin_context(True)
    db = SessionLocal()
    try:
        suffix = _uuid.uuid4().hex[:8]
        user = User(
            username=f"admjwt_{suffix}", email=f"admjwt_{suffix}@example.com",
            password_hash=hash_password("StrongPass123!"), is_active=True, is_email_verified=True,
        )
        db.add(user); db.commit(); db.refresh(user)
        admin_role = db.execute(select(Role).where(Role.name == "admin")).scalar_one()
        db.add(UserRole(user_id=user.id, role_id=admin_role.id)); db.commit()
        token = create_access_token(data={"sub": user.uuid, "role": "admin"})
    finally:
        db.close(); set_admin_context(False)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="module")
def test_partner_data():
    unique_id = str(uuid.uuid4())[:8]
    return {
        "display_name": f"Integration Partner {unique_id}",
        "legal_name": f"Partner Corp {unique_id}",
        "contact_email": f"partner_{unique_id}@example.com",
        "tier": "growth"
    }

def test_partner_management_lifecycle(admin_headers, test_partner_data):
    """
    Test the full lifecycle of a partner and their API keys:
    Create -> Issue Key -> Use Key -> Rotate Key -> Revoke Key -> Delete Partner
    """
    
    # 1. Create Partner
    print("\n[1/8] Creating Partner...")
    response = requests.post(
        f"{BASE_URL}/admin/partners/",
        json=test_partner_data,
        headers=admin_headers
    )
    assert response.status_code == 201
    partner_resp = response.json()
    assert partner_resp["success"] is True
    partner_id = partner_resp["data"]["id"]
    partner_uuid = partner_resp["data"]["partner_uuid"]
    print(f"      Created Partner ID: {partner_id} ({partner_uuid})")

    try:
        # 2. Issue API Key
        print("[2/8] Issuing API Key...")
        issue_payload = {
            "partner_id": partner_id,
            "label": "Primary Integration Key",
            "scopes": ["search", "metadata", "similarity"]
        }
        response = requests.post(
            f"{BASE_URL}/admin/partners/api-keys/issue",
            json=issue_payload,
            headers=admin_headers
        )
        assert response.status_code == 201
        key_resp = response.json()
        assert key_resp["success"] is True
        plaintext_key = key_resp["data"]["plaintext_key"]
        key_prefix = key_resp["data"]["key_prefix"]
        print(f"      Issued key with prefix: {key_prefix}")

        # 3. Verify Partner Context (using new key)
        print("[3/8] Verifying Partner Context (/partner/me)...")
        # Test both header formats
        partner_headers = {"X-API-KEY": plaintext_key}
        response = requests.get(f"{BASE_URL}/partner/me", headers=partner_headers)
        assert response.status_code == 200
        me_resp = response.json()
        assert me_resp["data"]["partner_uuid"] == partner_uuid
        print("      Context verified successfully.")

        # 4. List Partners
        print("[4/8] Listing Partners...")
        response = requests.get(f"{BASE_URL}/admin/partners/", headers=admin_headers)
        assert response.status_code == 200
        list_resp = response.json()
        partner_ids = [p["id"] for p in list_resp["data"]]
        assert partner_id in partner_ids
        print(f"      Partner found in list (total: {list_resp['pagination']['total']})")

        # 5. Rotate API Key
        print("[5/8] Rotating API Key...")
        # Need to find the key_id first
        response = requests.get(f"{BASE_URL}/admin/partners/api-keys/{partner_id}", headers=admin_headers)
        assert response.status_code == 200
        keys_list = response.json()["data"]
        # Verify usage count exists (W2-1)
        for key in keys_list:
            assert "usage_count" in key
            print(f"      Key prefix {key['key_prefix']} usage: {key['usage_count']}")
        
        old_key_id = [k["id"] for k in keys_list if k["key_prefix"] == key_prefix][0]
        
        rotate_payload = {
            "api_key_id": old_key_id,
            "reason": "Security rotation test"
        }
        response = requests.post(
            f"{BASE_URL}/admin/partners/api-keys/rotate",
            json=rotate_payload,
            headers=admin_headers
        )
        assert response.status_code == 201
        rotate_resp = response.json()
        new_plaintext_key = rotate_resp["data"]["plaintext_key"]
        print("      Key rotated successfully.")

        # 6. Verify Key Permissions (Old fails, New passes)
        print("[6/8] Verifying permissions after rotation...")
        # Old key should fail
        response = requests.get(f"{BASE_URL}/partner/me", headers={"X-API-KEY": plaintext_key})
        assert response.status_code == 401
        
        # New key should pass
        response = requests.get(f"{BASE_URL}/partner/me", headers={"X-API-KEY": new_plaintext_key})
        assert response.status_code == 200
        print("      Rotation enforcement verified.")

        # 7. Update Partner
        print("[7/8] Updating Partner info...")
        update_payload = {"display_name": "Updated Partner Name"}
        response = requests.patch(
            f"{BASE_URL}/admin/partners/{partner_id}",
            json=update_payload,
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["data"]["display_name"] == "Updated Partner Name"
        print("      Update verified.")

        # 8. Test Duplicate Partner Prevention
        print("[8/9] Testing Duplicate Partner Prevention...")
        response = requests.post(
            f"{BASE_URL}/admin/partners/",
            json=test_partner_data,
            headers=admin_headers
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["error"]
        print("      Duplicate prevention verified.")

    finally:
        # 9. Delete Partner (Cleanup)
        print("[9/9] Deleting Partner (Cleanup)...")
        response = requests.delete(
            f"{BASE_URL}/admin/partners/{partner_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        print("      Partner deleted successfully.")

        # Verify final deletion
        response = requests.get(f"{BASE_URL}/admin/partners/", headers=admin_headers)
        list_resp = response.json()
        partner_ids = [p["id"] for p in list_resp["data"]]
        assert partner_id not in partner_ids
        print("      Final verification complete.")

def test_admin_unauthorized_access():
    """Verify that admin endpoints reject invalid or missing keys."""
    # No key
    response = requests.get(f"{BASE_URL}/admin/partners/")
    assert response.status_code in [401, 403]
    
    # Invalid key
    response = requests.get(f"{BASE_URL}/admin/partners/", headers={"X-API-KEY": "wrong-key"})
    assert response.status_code in [401, 403]
