import pytest
import os
import csv
from unittest.mock import AsyncMock, patch, MagicMock
from pathlib import Path
from app.services.ingestion_service import process_ingestion_batch
from app.models.b2b import IngestLog, IngestionError

@pytest.mark.asyncio
class TestIngestionValidation:
    
    @patch("app.services.ingestion_service.AsyncSessionLocal")
    async def test_process_ingestion_batch_with_validation_error_preflight(self, mock_session_local):
        """Test that passing a preflight validation_error aborts processing early and logs failure."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
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
        
        # Check that the log entry added has FAILED status
        args, _ = mock_db.add.call_args_list[0]
        log_entry = args[0]
        assert log_entry.status == "FAILED"
        assert log_entry.error_message == "checksum mismatch — file may be corrupted or truncated"

    @patch("app.services.ingestion_service.AsyncSessionLocal")
    async def test_process_ingestion_batch_with_missing_headers(self, mock_session_local, tmp_path):
        """Test that missing required columns in the CSV header rejects the batch early."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_session_local.return_value.__aenter__.return_value = mock_db
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
        
        # Create CSV missing 'audio_filename' and 'display_artist'
        csv_file = tmp_path / "corrupted_headers.csv"
        csv_file.write_text("isrc,title\nUSUM71701234,Starlight\n")
        
        await process_ingestion_batch(
            partner_id=42,
            batch_path=str(tmp_path),
            csv_path=str(csv_file),
            checksum_verified=True
        )
        
        # Check that errors were logged
        logged_errors = []
        for call in mock_db.add.call_args_list:
            arg = call[0][0]
            if isinstance(arg, IngestionError):
                logged_errors.append(arg)
            elif isinstance(arg, IngestLog):
                log_entry = arg
                
        assert len(logged_errors) == 1
        assert logged_errors[0].error_code == "MISSING_HEADERS"
        assert "audio_filename" in logged_errors[0].error_message
        assert log_entry.status == "FAILED"
        assert log_entry.track_count == 0

    @patch("app.services.ingestion_service.AsyncSessionLocal")
    async def test_process_ingestion_batch_row_validation_errors(self, mock_session_local, tmp_path):
        """Test that diverse formatting/type errors are identified and reject ingestion atomically."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_session_local.return_value.__aenter__.return_value = mock_db
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
        
        # Create physical files for rows that *do* pass file presence checks,
        # but fail other checks like BPM, release_date, or ISRC pattern.
        (tmp_path / "audio_bpm.wav").write_text("dummy")
        (tmp_path / "audio_date.wav").write_text("dummy")
        (tmp_path / "audio_isrc.wav").write_text("dummy")
        
        csv_file = tmp_path / "validation_errors.csv"
        headers = ["isrc", "title", "audio_filename", "display_artist", "bpm", "release_date"]
        
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            # Row 2: Invalid BPM range (999)
            writer.writerow({
                "isrc": "USUM71701234",
                "title": "Invalid BPM Track",
                "audio_filename": "audio_bpm.wav",
                "display_artist": "The Electrobeats",
                "bpm": "999",
                "release_date": "2026-05-15"
            })
            # Row 3: Invalid Release Date format
            writer.writerow({
                "isrc": "GBBGD1987654",
                "title": "Invalid Date Track",
                "audio_filename": "audio_date.wav",
                "display_artist": "DJ Solarflare",
                "bpm": "120",
                "release_date": "15/05/2026"
            })
            # Row 4: Malformed ISRC format
            writer.writerow({
                "isrc": "MALFORMED_ISRC",
                "title": "Invalid ISRC Track",
                "audio_filename": "audio_isrc.wav",
                "display_artist": "Vocal Haze",
                "bpm": "95",
                "release_date": "2026-02-10"
            })
            
        await process_ingestion_batch(
            partner_id=42,
            batch_path=str(tmp_path),
            csv_path=str(csv_file),
            checksum_verified=True
        )
        
        # Collect generated errors
        logged_errors = {}
        log_entry = None
        for call in mock_db.add.call_args_list:
            arg = call[0][0]
            if isinstance(arg, IngestionError):
                logged_errors[arg.error_code] = arg.error_message
            elif isinstance(arg, IngestLog):
                log_entry = arg
                
        assert len(logged_errors) == 3
        assert "INVALID_BPM" in logged_errors
        assert "BPM '999' must be an integer between 30 and 300" in logged_errors["INVALID_BPM"]
        assert "INVALID_RELEASE_DATE" in logged_errors
        assert "must be in YYYY-MM-DD format" in logged_errors["INVALID_RELEASE_DATE"]
        assert "INVALID_ISRC_FORMAT" in logged_errors
        assert "Must be 12 alphanumeric characters" in logged_errors["INVALID_ISRC_FORMAT"]
        
        assert log_entry.status == "FAILED"
        assert log_entry.track_count == 0 # Rolled back!

    @patch("app.services.ingestion_service.AsyncSessionLocal")
    async def test_process_ingestion_batch_missing_audio_file(self, mock_session_local, tmp_path):
        """Test that physical audio file absence is flagged as a validation failure."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_session_local.return_value.__aenter__.return_value = mock_db
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
        
        # CSV declares track1.wav, but track1.wav does not exist in tmp_path
        csv_file = tmp_path / "missing_file.csv"
        headers = ["isrc", "title", "audio_filename", "display_artist"]
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerow({
                "isrc": "USUM71701234",
                "title": "Missing File Track",
                "audio_filename": "non_existent.wav",
                "display_artist": "The Electrobeats"
            })
            
        await process_ingestion_batch(
            partner_id=42,
            batch_path=str(tmp_path),
            csv_path=str(csv_file),
            checksum_verified=True
        )
        
        logged_errors = []
        for call in mock_db.add.call_args_list:
            arg = call[0][0]
            if isinstance(arg, IngestionError):
                logged_errors.append(arg)
                
        assert len(logged_errors) == 1
        assert logged_errors[0].error_code == "MISSING_AUDIO_FILE"
        assert "not found in the incoming directory" in logged_errors[0].error_message

    @patch("app.services.ingestion_service.AsyncSessionLocal")
    async def test_process_ingestion_batch_duplicate_isrc_in_file(self, mock_session_local, tmp_path):
        """Test that identical ISRCs duplicated inside the same CSV batch are rejected."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_session_local.return_value.__aenter__.return_value = mock_db
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
        
        # Write the physical audio file
        (tmp_path / "audio.wav").write_text("dummy")
        
        csv_file = tmp_path / "duplicate_isrcs.csv"
        headers = ["isrc", "title", "audio_filename", "display_artist"]
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerow({
                "isrc": "USUM71701234",
                "title": "Original Track",
                "audio_filename": "audio.wav",
                "display_artist": "The Electrobeats"
            })
            writer.writerow({
                "isrc": "USUM71701234",
                "title": "Duplicate Track Entry",
                "audio_filename": "audio.wav",
                "display_artist": "The Electrobeats"
            })
            
        await process_ingestion_batch(
            partner_id=42,
            batch_path=str(tmp_path),
            csv_path=str(csv_file),
            checksum_verified=True
        )
        
        logged_errors = []
        for call in mock_db.add.call_args_list:
            arg = call[0][0]
            if isinstance(arg, IngestionError):
                logged_errors.append(arg)
                
        assert len(logged_errors) == 1
        assert logged_errors[0].error_code == "DUPLICATE_ISRC_IN_BATCH"
        assert "duplicated within the same ingestion batch" in logged_errors[0].error_message
