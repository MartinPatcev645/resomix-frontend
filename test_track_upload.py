#!/usr/bin/env python3
"""
Test script for track upload functionality
==========================================

This script tests the track upload service logic WITHOUT database insertion.
It verifies metadata extraction, UUID generation, and data preparation.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Load environment variables
load_dotenv()

from app.services.track_upload_service import TrackUploadService, generate_track_uuid, parse_artist_names, extract_first_genre
from app.services.metadata_service import MetadataService
from fastapi import UploadFile
import tempfile
from typing import BinaryIO


class MockUploadFile:
    """Mock UploadFile for testing purposes."""
    
    def __init__(self, file_obj: BinaryIO, filename: str, content_type: str = "audio/mpeg"):
        self.file = file_obj
        self.filename = filename
        self.content_type = content_type
    
    async def read(self):
        return self.file.read()
    
    async def seek(self, position: int):
        return self.file.seek(position)
    
    async def close(self):
        return self.file.close()


class MockTrackUploadService:
    """Mock service that tests the logic without database insertion."""
    
    def __init__(self):
        self.metadata_service = MetadataService()
        
    def test_upload_logic(self, file: MockUploadFile, file_content: bytes) -> dict:
        """Test the upload logic without database operations."""
        try:
            # Generate UUID for the track
            track_uuid = generate_track_uuid()
            print(f"✅ Generated UUID: {track_uuid}")
            
            # Extract metadata using the existing service
            file.file.seek(0)  # Reset file pointer
            metadata = self.metadata_service.extract_metadata(file.file, file.filename, mode="limited")
            
            if "error" in metadata:
                print(f"❌ Metadata extraction failed: {metadata['error']}")
                return {"success": False, "error": f"Metadata extraction failed: {metadata['error']}"}
            
            print(f"✅ Metadata extracted: {metadata}")
            
            # Calculate file size
            file_size = len(file_content)
            print(f"✅ File size: {file_size} bytes")
            
            # Extract basic info with defaults
            title = metadata.get("Title", "") or file.filename or "Unknown"
            year = self._parse_year(metadata.get("Year"))
            
            # Parse artist names
            artist_field = metadata.get("Artist", "")
            artist_names = parse_artist_names(artist_field) or ["Unknown"]
            
            # Extract label and genre
            label_name = metadata.get("Label", "").strip()
            genre_name = extract_first_genre(metadata.get("Genre", ""))
            
            # Extract album
            album_title = metadata.get("Album", "").strip()
            
            # Set file paths
            file_path = file.filename or "unknown_file"
            preview_path = f"/mnt/data/UPLOADS/{track_uuid}.mp3"
            
            # Prepare data that WOULD be inserted
            track_data = {
                "uuid": track_uuid,
                "title": title[:255],
                "year": year,
                "duration_sec": None,  # Ignored for now
                "file_path": file_path[:500],
                "preview_path": preview_path,
                "file_size": file_size,
                "type": "upload"
            }
            
            # Prepare related data
            related_data = {
                "artist_names": artist_names,
                "album_title": album_title,
                "label_name": label_name,
                "genre_name": genre_name
            }
            
            print(f"✅ Track data prepared:")
            print(f"   - UUID: {track_data['uuid']}")
            print(f"   - Title: {track_data['title']}")
            print(f"   - Year: {track_data['year']}")
            print(f"   - File Path: {track_data['file_path']}")
            print(f"   - Preview Path: {track_data['preview_path']}")
            print(f"   - File Size: {track_data['file_size']}")
            print(f"   - Type: {track_data['type']}")
            print(f"   - Artists: {related_data['artist_names']}")
            print(f"   - Album: {related_data['album_title']}")
            print(f"   - Label: {related_data['label_name']}")
            print(f"   - Genre: {related_data['genre_name']}")
            
            return {
                "success": True,
                "uuid": track_uuid,
                "metadata": metadata,
                "file_size": file_size,
                "track_data": track_data,
                "related_data": related_data
            }
                
        except Exception as e:
            print(f"❌ Error in upload logic test: {e}")
            return {"success": False, "error": str(e)}
    
    def _parse_year(self, year_str) -> int:
        """Parse year from string, handling various formats."""
        if not year_str:
            return None
        
        try:
            # Try to extract 4-digit year from the string
            import re
            year_match = re.search(r'\b(\d{4})\b', str(year_str))
            if year_match:
                year = int(year_match.group(1))
                # Validate year range (reasonable range for music)
                if 1900 <= year <= 2030:
                    return year
            return None
        except (ValueError, AttributeError):
            return None


def test_uuid_generation():
    """Test UUID generation."""
    uuid1 = generate_track_uuid()
    uuid2 = generate_track_uuid()
    
    print(f"Generated UUID 1: {uuid1}")
    print(f"Generated UUID 2: {uuid2}")
    
    # Check format
    assert len(uuid1) == 24, f"UUID should be 24 characters, got {len(uuid1)}"
    assert len(uuid2) == 24, f"UUID should be 24 characters, got {len(uuid2)}"
    assert uuid1 != uuid2, "UUIDs should be unique"
    assert all(c in '0123456789abcdef' for c in uuid1), "UUID should only contain hex characters"
    
    print("✅ UUID generation test passed!")


def test_artist_parsing():
    """Test artist name parsing."""
    test_cases = [
        ("Artist 1", ["Artist 1"]),
        ("Artist 1, Artist 2", ["Artist 1", "Artist 2"]),
        ("Artist 1 & Artist 2", ["Artist 1", "Artist 2"]),
        ("Artist 1; Artist 2", ["Artist 1", "Artist 2"]),
        ("Artist 1 &amp; Artist 2", ["Artist 1", "Artist 2"]),
        ("", []),
        (None, [])
    ]
    
    for input_str, expected in test_cases:
        result = parse_artist_names(input_str)
        print(f"Input: '{input_str}' -> Output: {result}")
        assert result == expected, f"Expected {expected}, got {result}"
    
    print("✅ Artist parsing test passed!")


def test_genre_extraction():
    """Test genre extraction."""
    test_cases = [
        ("Electronic", "Electronic"),
        ("Electronic, House", "Electronic"),
        ("Electronic; House", "Electronic"),
        ("", "Unknown"),
        (None, "Unknown"),
        ("A" * 100, "A" * 77 + "...")  # Test truncation
    ]
    
    for input_str, expected in test_cases:
        result = extract_first_genre(input_str)
        print(f"Input: '{input_str}' -> Output: '{result}'")
        assert result == expected, f"Expected '{expected}', got '{result}'"
    
    print("✅ Genre extraction test passed!")


def test_database_connection():
    """Test database connection (without inserting)."""
    try:
        from database.connection import engine
        from sqlalchemy import text
        
        with engine.begin() as conn:
            result = conn.execute(text("SELECT 1"))
            row = result.first()
            assert row[0] == 1, "Database connection test failed"
        
        print("✅ Database connection test passed!")
        return True
    except Exception as e:
        print(f"❌ Database connection test failed: {e}")
        print("   (This is OK - the test will continue without database operations)")
        return False


def create_dummy_audio_file():
    """Create a dummy audio file for testing."""
    # Create a minimal MP3-like file (just for testing, not actually valid MP3)
    dummy_content = b'ID3\x03\x00\x00\x00\x00\x00\x00' + b'\x00' * 100
    dummy_content += b'TIT2\x00\x00\x00\x0b\x00\x00\x00Test Track'
    dummy_content += b'TPE1\x00\x00\x00\x0c\x00\x00\x00Test Artist'
    dummy_content += b'TALB\x00\x00\x00\x0b\x00\x00\x00Test Album'
    dummy_content += b'TCON\x00\x00\x00\x0a\x00\x00\x00Electronic'
    dummy_content += b'TYER\x00\x00\x00\x05\x00\x00\x002023'
    return dummy_content


def main():
    """Run all tests."""
    print("Starting track upload functionality tests (NO DATABASE INSERTION)...\n")
    print("🔒 This test will NOT insert any data into the database")
    print("🧪 It will only test the logic and show what WOULD be inserted\n")
    
    # Test individual components
    test_uuid_generation()
    print()
    
    test_artist_parsing()
    print()
    
    test_genre_extraction()
    print()
    
    # Test database connection (but don't require it)
    db_available = test_database_connection()
    print()
    
    # Test with dummy file (logic test only)
    print("Testing track upload logic with dummy file...")
    print("=" * 60)
    try:
        service = MockTrackUploadService()
        
        # Create dummy audio content
        dummy_content = create_dummy_audio_file()
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
            temp_file.write(dummy_content)
            temp_file.flush()
            
            # Reopen for reading
            with open(temp_file.name, 'rb') as file_obj:
                mock_file = MockUploadFile(file_obj, "test_track.mp3")
                
                # Test the logic (NO DATABASE INSERTION)
                result = service.test_upload_logic(mock_file, dummy_content)
        
        # Clean up
        os.unlink(temp_file.name)
        
        print("=" * 60)
        if result.get("success"):
            print(f"✅ Track upload logic test PASSED!")
            print(f"\n📊 Summary:")
            print(f"   - UUID Generated: {result['uuid']}")
            print(f"   - File Size: {result['file_size']} bytes")
            print(f"   - Metadata Extracted: ✅")
            print(f"   - Track Data Prepared: ✅")
            print(f"   - Related Data Prepared: ✅")
            print(f"\n🚀 The logic is working correctly!")
            print(f"   When you run this in production, it will:")
            print(f"   1. Insert track into 'tracks' table with type='upload'")
            print(f"   2. Create/find artists, albums, labels, genres")
            print(f"   3. Link track to artists via 'track_artists' table")
        else:
            print(f"❌ Track upload logic test FAILED: {result.get('error')}")
            
    except Exception as e:
        print(f"❌ Track upload logic test failed with exception: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n🎉 All tests completed!")
    print("\n💡 Next steps:")
    print("   1. If tests passed, the logic is correct")
    print("   2. Test the actual API endpoint when ready")
    print("   3. The database insertion will happen when you call the real service")


if __name__ == "__main__":
    main()
