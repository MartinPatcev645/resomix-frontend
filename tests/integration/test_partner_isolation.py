
import pytest
import uuid
import httpx
from sqlalchemy import text
from app.main import app
from database.connection import SessionLocal, engine
from app.models.track import Track
from app.models.partner import Partner, PartnerApiKey

@pytest.mark.asyncio
async def test_tenant_isolation_flow():
    """
    Integration test to verify multi-tenant isolation across public and partner contexts.
    """
    print("\n--- Starting Tenant Isolation Integration Test ---")

    async with httpx.AsyncClient(app=app, base_url="http://testserver") as client:
        # 1. Verify Public/Frontend Access (Partner ID 1)
        print("Testing Public Access (Partner 1)...")
        response = await client.get("/search_tracks/?query=Sleep")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]["tracks"]) > 0
        print(f"✓ Public access returned {len(data['data']['tracks'])} tracks.")

        # 2. Verify Partner 2 Access (Scoped Isolation)
        api_key = "rmx_test_V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"
        print("\nTesting Partner 2 Access (Isolation Check)...")
        
        response = await client.get("/search_tracks/?query=Sleep", headers={"Authorization": f"Bearer {api_key}"})
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]["tracks"]) == 0
        print("✓ Partner 2 correctly isolated from Partner 1 tracks.")

        # 3. Inject a private track for Partner 2
        print("\nInjecting private track for Partner 2...")
        p2_track_uuid = str(uuid.uuid4())
        unique_title = f"Secret Partner 2 Track {p2_track_uuid[:8]}"
        with SessionLocal() as session:
            new_track = Track(
                uuid=p2_track_uuid,
                title=unique_title,
                isrc=f"P2-{p2_track_uuid[:8]}",
                partner_id=2,
                ingestion_source="csv",
                is_active=True
            )
            session.add(new_track)
            session.commit()
        print(f"✓ Track {p2_track_uuid} added to Partner 2.")
        
        # 4. Search again with Partner 2 key
        print(f"Searching for Partner 2 track with title '{unique_title}'...")
        response = await client.get(f"/search_tracks/?query={unique_title}", headers={"Authorization": f"Bearer {api_key}"})
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]["tracks"]) >= 1
        assert any(t["title"] == unique_title for t in data["data"]["tracks"])
        print("✓ Partner 2 can see their own private track.")

        # 5. Verify Public Context CANNOT see Partner 2 track
        print("Verifying Public context cannot see Partner 2 track...")
        response = await client.get("/search_tracks/?query=Secret")
        data = response.json()
        assert len(data["data"]["tracks"]) == 0
        print("✓ Public context correctly blocked from Partner 2 track.")

        # 6. Test Track Path Isolation
        print("\nTesting Track Path Isolation (Similarity Internal Logic)...")
        with SessionLocal() as session:
            t2 = session.query(Track).filter_by(uuid=p2_track_uuid).first()
            p2_tuuid = t2.uuid
            t1 = session.query(Track).filter_by(partner_id=1).first()
            p1_tuuid = t1.uuid

        print(f"Partner 2 requesting similarity for their OWN track UUID {p2_tuuid}...")
        response = await client.post("/get_selection_similarity/", 
                               json={"track_id": p2_tuuid, "top_sk": 10},
                               headers={"Authorization": f"Bearer {api_key}"})
        # Note: If similarity server is not running, it might return 503 or 404 depending on implementation, 
        # but it shouldn't return 422 if the UUID is valid.
        assert response.status_code != 422
        print(f"✓ Partner 2 authorized for their own track UUID (Status: {response.status_code}).")

        print(f"Partner 2 requesting similarity for Partner 1's track UUID {p1_tuuid}...")
        response = await client.post("/get_selection_similarity/", 
                               json={"track_id": p1_tuuid, "top_sk": 10},
                               headers={"Authorization": f"Bearer {api_key}"})
        # If tenant isolation works, the repository should not find the track for Partner 2 key
        # Resulting in a 404 Not Found from the controller.
        assert response.status_code == 404
        print("✓ Partner 2 BLOCKED from Partner 1's track (Cross-tenant leak prevented).")

    print("\n--- Tenant Isolation Integration Test Completed Successfully! ---")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_tenant_isolation_flow())
