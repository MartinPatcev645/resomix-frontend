
import pytest
import uuid
import httpx
from app.main import app
from database.connection import SessionLocal
from app.models.track import Track

@pytest.mark.asyncio
async def test_tenant_isolation_flow():
    """
    Integration test to verify multi-tenant isolation across public and partner contexts.
    """
    async with httpx.AsyncClient(app=app, base_url="http://testserver") as client:
        # 1. Verify Public/Frontend Access (Partner ID 1)
        response = await client.get("/api/v1/search_tracks/?query=Sleep")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]["tracks"]) > 0

        # 2. Verify Partner 2 Access (Scoped Isolation)
        api_key = "rmx_test_V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"
        
        response = await client.get("/api/v1/search_tracks/?query=Sleep", headers={"Authorization": f"Bearer {api_key}"})
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]["tracks"]) == 0

        # 3. Inject a private track for Partner 2
        from app.core.context import set_admin_context
        p2_track_uuid = str(uuid.uuid4())
        unique_title = f"Secret Partner 2 Track {p2_track_uuid[:8]}"
        
        # Set admin context to bypass failsafe for direct test injection
        set_admin_context(True)
        try:
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
        finally:
            set_admin_context(False)
        
        # 4. Search again with Partner 2 key
        response = await client.get(f"/api/v1/search_tracks/?query={unique_title}", headers={"Authorization": f"Bearer {api_key}"})
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]["tracks"]) >= 1
        assert any(t["title"] == unique_title for t in data["data"]["tracks"])

        # 5. Verify Public Context CANNOT see Partner 2 track
        response = await client.get("/api/v1/search_tracks/?query=Secret")
        data = response.json()
        assert len(data["data"]["tracks"]) == 0

        # 6. Test Track Path Isolation
        set_admin_context(True)
        try:
            with SessionLocal() as session:
                t2 = session.query(Track).filter_by(uuid=p2_track_uuid).first()
                p2_tuuid = t2.uuid
                t1 = session.query(Track).filter_by(partner_id=1).first()
                p1_tuuid = t1.uuid
        finally:
            set_admin_context(False)

        response = await client.post("/api/v1/similarity/search", 
                                json={"track_id": p2_tuuid, "top_sk": 10},
                                headers={"Authorization": f"Bearer {api_key}"})
        # Note: If similarity server is not running, it might return 503 or 404 depending on implementation, 
        # but it shouldn't return 422 if the UUID is valid.
        assert response.status_code != 422

        response = await client.post("/api/v1/similarity/search", 
                                json={"track_id": p1_tuuid, "top_sk": 10},
                                headers={"Authorization": f"Bearer {api_key}"})
        # If tenant isolation works, the repository should not find the track for Partner 2 key
        # Resulting in a 404 Not Found from the controller.
        assert response.status_code == 404

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_tenant_isolation_flow())
