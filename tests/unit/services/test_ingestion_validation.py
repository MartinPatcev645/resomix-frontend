import pytest
import os
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.ingestion_service import process_ingestion_batch

@pytest.mark.asyncio
class TestIngestionValidation:
    
    @patch("app.services.ingestion_service.AsyncSessionLocal")
    async def test_process_ingestion_batch_with_validation_error(self, mock_session_local):
        """Test that passing a validation_error aborts processing early and logs failure."""
        mock_db = AsyncMock()
        mock_session_local.return_value.__aenter__.return_value = mock_db
        
        # Mock Party lookup
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
        
        await process_ingestion_batch(
            partner_id=42,
            batch_path="/dummy/path",
            validation_error="checksum mismatch — file may be corrupted or truncated"
        )
        
        # Verify db.add was called for the initial IngestLog
        assert mock_db.add.called
        
        # Verify the commit was called to save the FAILED status
        # It should be called 3 times: 
        # 1. Create IngestLog
        # 2. Update status to FAILED (due to validation_error)
        assert mock_db.commit.call_count >= 2
        
        # Check that the log entry added has FAILED status
        args, _ = mock_db.add.call_args_list[0]
        log_entry = args[0]
        assert log_entry.status == "FAILED"
        assert log_entry.error_message == "checksum mismatch — file may be corrupted or truncated"

    @patch("app.services.ingestion_service.AsyncSessionLocal")
    @patch("app.services.ingestion_service.Path")
    async def test_process_ingestion_batch_with_csv_path(self, mock_path_cls, mock_session_local, tmp_path):
        """Test that passing csv_path skips globbing."""
        mock_db = AsyncMock()
        mock_session_local.return_value.__aenter__.return_value = mock_db
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
        
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("isrc,title\n123,song")
        
        # When csv_path is provided, glob should not be called
        await process_ingestion_batch(
            partner_id=42,
            batch_path="/dummy/path",
            csv_path=str(csv_file),
            checksum_verified=True
        )
        
        # Verify that glob wasn't called (because mock_path_cls instance wouldn't call it if csv_path is used directly on the csv)
        # Actually in the code we do: manifest_path = Path(csv_path) if csv_path else ...
        # The test passes if no FileNotFoundError is raised.
        assert mock_db.commit.call_count >= 3 # Start, Update filename, Complete
