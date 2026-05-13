
import pytest
import uuid
import httpx
from database.connection import SessionLocal
from app.models.track import Track
from app.models.audio_file import AudioFile
from app.core.context import set_admin_context
from sqlalchemy import delete, text
import os

# Test constants
BASE_URL = "http://localhost:8001"
PARTNER_1_ID = 1  # Sandbox
PARTNER_2_ID = 2
PARTNER_2_API_KEY = "rmx_test_V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"

@pytest.fixture(scope="module")
def test_tracks():
    """Inject test tracks and audio files for multiple partners and clean up after."""
    set_admin_context(True)
    
    p1_tracks = []
    p2_tracks = []
    track_ids = []
    
    # Use real party and ingest log from the DB
    party_id = "ARGO_01"
    ingest_log_id = 1
    
    with SessionLocal() as session:
        # Verify party and ingest log exist or fallback to first available
        try:
            res = session.execute(text("SELECT party_id FROM parties LIMIT 1")).fetchone()
            if res: party_id = res[0]
            res = session.execute(text("SELECT id FROM ingest_logs LIMIT 1")).fetchone()
            if res: ingest_log_id = res[0]
        except Exception:
            pass

        # Create tracks for Partner 1
        for i in range(3):
            track_uuid = str(uuid.uuid4())
            track = Track(
                uuid=track_uuid,
                title=f"Partner 1 Track {i} {track_uuid[:4]}",
                display_artist="Artist 1",
                isrc=f"P1-TEST-{track_uuid[:8]}",
                partner_id=PARTNER_1_ID,
                ingestion_source="csv",
                is_active=True
            )
            session.add(track)
            session.flush() # Get track.id
            
            # Add AudioFile so similarity lookup doesn't 404
            audio = AudioFile(
                track_id=track.id,
                partner_id=PARTNER_1_ID,
                party_id=party_id,
                ingest_log_id=ingest_log_id,
                original_filename="test.mp3",
                stored_path=f"/tmp/test_p1_{i}.mp3",
                asset_class="Master",
                mime_type="audio/mpeg"
            )
            session.add(audio)
            p1_tracks.append(track_uuid)
            track_ids.append(track.id)
            
        # Create tracks for Partner 2
        for i in range(3):
            track_uuid = str(uuid.uuid4())
            track = Track(
                uuid=track_uuid,
                title=f"Partner 2 Track {i} {track_uuid[:4]}",
                display_artist="Artist 2",
                isrc=f"P2-TEST-{track_uuid[:8]}",
                partner_id=PARTNER_2_ID,
                ingestion_source="csv",
                is_active=True
            )
            session.add(track)
            session.flush()
            
            # Add AudioFile
            audio = AudioFile(
                track_id=track.id,
                partner_id=PARTNER_2_ID,
                party_id=party_id,
                ingest_log_id=ingest_log_id,
                original_filename="test.mp3",
                stored_path=f"/tmp/test_p2_{i}.mp3",
                asset_class="Master",
                mime_type="audio/mpeg"
            )
            session.add(audio)
            p2_tracks.append(track_uuid)
            track_ids.append(track.id)
            
        session.commit()
    
    set_admin_context(False)
    
    yield {"p1": p1_tracks, "p2": p2_tracks}
    
    # Cleanup
    set_admin_context(True)
    with SessionLocal() as session:
        if track_ids:
            session.execute(delete(AudioFile).where(AudioFile.track_id.in_(track_ids)))
            session.execute(delete(Track).where(Track.id.in_(track_ids)))
            session.commit()
    set_admin_context(False)

@pytest.mark.asyncio
async def test_search_tracks_scoping(test_tracks):
    """Verify that search results are correctly scoped to the partner."""
    async with httpx.AsyncClient(base_url=BASE_URL, follow_redirects=True) as client:
        # 1. Search as Partner 1 (Public/Default)
        response = await client.get("/search_tracks/?query=Partner 1")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]["tracks"]) > 0
        for track in data["data"]["tracks"]:
            assert "Partner 1" in track["title"]
            assert "Partner 2" not in track["title"]

        # 2. Search as Partner 2 (using API Key)
        headers = {"Authorization": f"Bearer {PARTNER_2_API_KEY}"}
        response = await client.get("/search_tracks/?query=Partner 2", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]["tracks"]) > 0
        for track in data["data"]["tracks"]:
            assert "Partner 2" in track["title"]
            assert "Partner 1" not in track["title"]

@pytest.mark.asyncio
async def test_search_tracks_query_validation():
    """Verify query parameter validation (min_length)."""
    async with httpx.AsyncClient(base_url=BASE_URL, follow_redirects=True) as client:
        # Empty query
        response = await client.get("/search_tracks/?query=")
        assert response.status_code == 422

@pytest.mark.asyncio
async def test_similarity_by_id_scoping(test_tracks):
    """Verify that similarity by ID enforces tenant isolation (404 for cross-tenant)."""
    p1_track_uuid = test_tracks["p1"][0]
    p2_track_uuid = test_tracks["p2"][0]
    
    async with httpx.AsyncClient(base_url=BASE_URL, follow_redirects=True) as client:
        headers_p2 = {"Authorization": f"Bearer {PARTNER_2_API_KEY}"}
        
        # 1. Partner 2 requests similarity for their OWN track
        response = await client.post(
            "/get_selection_similarity/",
            json={"track_id": p2_track_uuid, "top_sk": 10},
            headers=headers_p2
        )
        assert response.status_code != 404
        assert response.status_code != 401

        # 2. Partner 2 requests similarity for Partner 1's track -> Should 404
        response = await client.post(
            "/get_selection_similarity/",
            json={"track_id": p1_track_uuid, "top_sk": 10},
            headers=headers_p2
        )
        assert response.status_code == 404

@pytest.mark.asyncio
async def test_get_preview_scoping(test_tracks):
    """Verify that preview generation enforces tenant isolation."""
    p1_track_uuid = test_tracks["p1"][0]
    p2_track_uuid = test_tracks["p2"][0]
    
    async with httpx.AsyncClient(base_url=BASE_URL, follow_redirects=True) as client:
        headers_p2 = {"Authorization": f"Bearer {PARTNER_2_API_KEY}"}
        
        # 1. Partner 2 requests preview for their OWN track
        response = await client.get(
            f"/preview/get_preview/?track_id={p2_track_uuid}",
            headers=headers_p2
        )
        assert response.status_code != 401
        assert response.status_code != 403

        # 2. Partner 2 requests preview for Partner 1's track -> Should 404
        response = await client.get(
            f"/preview/get_preview/?track_id={p1_track_uuid}",
            headers=headers_p2
        )
        assert response.status_code == 404

@pytest.mark.asyncio
async def test_search_sqli_protection():
    """Verify that special characters in search don't cause crashes."""
    async with httpx.AsyncClient(base_url=BASE_URL, follow_redirects=True) as client:
        sqli_queries = [
            "' OR '1'='1",
            "\"; DROP TABLE users; --",
            "%) OR 1=1 --",
        ]
        for query in sqli_queries:
            response = await client.get(f"/search_tracks/?query={query}")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert len(data["data"]["tracks"]) == 0

@pytest.mark.asyncio
async def test_similarity_upload_flow():
    """Verify the multi-step upload and analysis flow with a real audio file."""
    if not os.path.exists("prelisten.mp3"):
        pytest.skip("prelisten.mp3 not found")
        
    timeout = httpx.Timeout(30.0, connect=5.0)
    async with httpx.AsyncClient(base_url=BASE_URL, follow_redirects=True, timeout=timeout) as client:
        headers = {"Authorization": f"Bearer {PARTNER_2_API_KEY}"}
        with open("prelisten.mp3", "rb") as f:
            files = {"file": ("prelisten.mp3", f, "audio/mpeg")}
            response = await client.post(
                "/get_similarity/",
                files=files,
                headers=headers
            )
        
        # 200 for success (even with empty results), 503 if similarity engine is completely down
        assert response.status_code in [200, 503]
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True
            assert "queried_track" in data["data"]
            assert "similar_tracks" in data["data"]
            
            # Database Verification: Check if the track was correctly stored with partner_id = 2
            track_uuid = data["data"]["queried_track"].get("id")
            if track_uuid:
                set_admin_context(True)
                with SessionLocal() as session:
                    # Directly query DB to verify scoping at rest
                    res = session.execute(
                        text("SELECT partner_id FROM tracks WHERE uuid = :uuid"), 
                        {"uuid": track_uuid}
                    ).fetchone()
                    assert res is not None
                    assert res[0] == PARTNER_2_ID
                    
                    # Cleanup
                    t_id = session.execute(text("SELECT id FROM tracks WHERE uuid = :uuid"), {"uuid": track_uuid}).scalar()
                    if t_id:
                        session.execute(delete(AudioFile).where(AudioFile.track_id == t_id))
                        session.execute(delete(Track).where(Track.id == t_id))
                        session.commit()
                set_admin_context(False)

@pytest.mark.asyncio
async def test_similarity_upload_invalid_mime():
    """Verify 415 for invalid MIME types in similarity upload."""
    async with httpx.AsyncClient(base_url=BASE_URL, follow_redirects=True) as client:
        headers = {"Authorization": f"Bearer {PARTNER_2_API_KEY}"}
        files = {"file": ("test.txt", b"not an audio file", "text/plain")}
        
        response = await client.post(
            "/get_similarity/",
            files=files,
            headers=headers
        )
        assert response.status_code in [415, 422]
        assert response.json()["success"] is False
