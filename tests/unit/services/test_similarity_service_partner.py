import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.similarity_service import SimilarityService
from app.core.config import settings

@pytest.mark.asyncio
async def test_calculate_similarity_for_upload_passes_partner_id():
    """Verify that calculate_similarity_for_upload includes partner_id in the request to Hetzner."""
    service = SimilarityService()
    
    # Mock dependencies
    db = AsyncMock()
    audio_bytes = b"fake audio data"
    filename = "test.mp3"
    track_uuid = "test-uuid"
    partner_id = 123
    
    # Mock internal methods and external calls
    with patch.object(service, "_call_similarity_server", new_callable=AsyncMock) as mock_call, \
         patch.object(service.similarity_repository, "async_get_track_details_by_uuids", new_callable=AsyncMock) as mock_uuids, \
         patch.object(service.similarity_repository, "async_get_reference_track_details_by_uuid", new_callable=AsyncMock) as mock_ref:
        
        mock_call.return_value = {"status": "success", "results": []}
        mock_uuids.return_value = {}
        mock_ref.return_value = {"id": track_uuid, "title": "Test Track"}
        
        with patch("app.services.similarity_service.get_duration_from_bytes_sync", return_value=120.0):
            await service.calculate_similarity_for_upload(
                db=db,
                audio_bytes=audio_bytes,
                original_filename=filename,
                track_uuid=track_uuid,
                partner_id=partner_id
            )
            
            # Verify the call to the similarity server
            mock_call.assert_called_once()
            args, kwargs = mock_call.call_args
            
            # Check the data payload
            data = kwargs.get("data", {})
            assert data.get("partner_id") == partner_id
            assert data.get("track_uuid") == track_uuid

@pytest.mark.asyncio
async def test_get_similarity_by_path_passes_partner_id():
    """Verify that get_similarity_by_path includes partner_id in the request to Hetzner."""
    service = SimilarityService()
    
    # Mock dependencies
    db = AsyncMock()
    server_path = "path/to/audio.mp3"
    track_uuid = "test-uuid"
    partner_id = 456
    
    # Mock internal methods and external calls
    with patch.object(service, "_call_similarity_server", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = {"status": "success", "results": []}
        
        # Mock repository response
        service.similarity_repository.async_get_reference_track_details_by_path = AsyncMock(
            return_value={"id": track_uuid}
        )
        
        await service.get_similarity_by_path(
            db=db,
            server_track_path=server_path,
            queried_track_uuid=track_uuid,
            partner_id=partner_id
        )
        
        # Verify the call to the similarity server
        mock_call.assert_called_once()
        args, kwargs = mock_call.call_args
        
        # Check the data payload
        data = kwargs.get("data", {})
        assert data.get("partner_id") == partner_id
        assert data.get("track_uuid") == track_uuid

@pytest.mark.asyncio
async def test_rebuild_faiss_indexes_passes_partner_id():
    """Verify that rebuild_faiss_indexes includes partner_id in the request to Hetzner."""
    service = SimilarityService()
    partner_id = 789
    
    with patch.object(service, "_call_similarity_server", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = {"status": "success"}
        
        await service.rebuild_faiss_indexes(partner_id=partner_id)
        
        mock_call.assert_called_once_with(
            "/admin/similarity/rebuild-index/",
            data={"partner_id": partner_id}
        )

@pytest.mark.asyncio
async def test_rebuild_faiss_indexes_no_partner_id():
    """Verify that rebuild_faiss_indexes works without partner_id."""
    service = SimilarityService()
    
    with patch.object(service, "_call_similarity_server", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = {"status": "success"}
        
        await service.rebuild_faiss_indexes()
        
        mock_call.assert_called_once_with(
            "/admin/similarity/rebuild-index/",
            data={}
        )
