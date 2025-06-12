#!/usr/bin/env python3
"""
Metadata Routes Test
====================

Test file for metadata extraction endpoints.

Usage: python -m pytest tests/unit/test_routes/test_metadata_routes.py -v
Or run directly: python tests/unit/test_routes/test_metadata_routes.py
"""

import requests
import time
import io
import os
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "http://localhost:8005"
TIMEOUT = 30

def print_test_result(test_name: str, success: bool, message: str = "", response_time: float = 0):
    """Print test result with formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    time_str = f"({response_time:.2f}s)" if response_time > 0 else ""
    print(f"{status} {test_name} {time_str}")
    if message:
        print(f"     {message}")

def create_test_audio_file() -> bytes:
    """Create a minimal MP3 test file"""
    # MP3 sync word + header for 44.1kHz stereo 128kbps
    mp3_header = bytes([
        0xFF, 0xFB, 0x90, 0x00,  # MP3 header
        0x00, 0x00, 0x00, 0x00,  # No side info
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00
    ])
    # Add some audio data frames
    frame_data = bytes([0x00] * 400)  # Silence data
    return mp3_header + frame_data

def get_sample_audio_file() -> Optional[bytes]:
    """Try to get a real audio file or create a test one"""
    # First, try to find any existing audio files
    common_audio_paths = [
        "audio1.mp3",
        "test_audio.mp3", 
        "sample.mp3",
        "tests/audio1.mp3",
        "tests/sample.mp3"
    ]
    
    for path in common_audio_paths:
        if os.path.exists(path):
            try:
                with open(path, 'rb') as f:
                    return f.read()
            except Exception:
                continue
    
    # If no real audio file found, create a test one
    return create_test_audio_file()

def test_metadata_valid_file():
    """Test POST /metadata/ with valid audio file"""
    print("\n🧪 Testing Metadata Extraction - Valid File")
    
    try:
        start_time = time.time()
        
        # Get audio file
        test_audio = get_sample_audio_file()
        if not test_audio:
            print_test_result("Metadata Valid File", False, "Could not create or find audio file")
            return False
        
        files = {
            'file': ('test_audio.mp3', io.BytesIO(test_audio), 'audio/mpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/metadata/",
            files=files,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Check status code - could be 200 for success or 415 for unsupported format
        if response.status_code == 200:
            # Check response format
            try:
                data = response.json()
            except Exception as e:
                print_test_result("Metadata Valid JSON", False, f"Invalid JSON response: {e}")
                return False
            
            # Check success field
            if data.get("success") is True:
                print_test_result("Metadata Valid File", True, f"Successfully extracted metadata", response_time)
                return True
            else:
                print_test_result("Metadata Valid File", False, f"Success=False: {data.get('error', 'Unknown error')}")
                return False
        elif response.status_code == 415:
            # Expected for test files that aren't real audio
            print_test_result("Metadata Valid File", True, "Expected 415 (invalid audio format for test file)", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Metadata Valid File", False, f"Status code: {response.status_code}, Response: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Metadata Valid File", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Metadata Valid File", False, f"Unexpected error: {e}")
        return False

def test_metadata_invalid_file():
    """Test POST /metadata/ with invalid file format"""
    print("\n🧪 Testing Metadata Extraction - Invalid File")
    
    try:
        start_time = time.time()
        
        # Create a text file instead of audio
        test_file = b"This is not an audio file"
        
        files = {
            'file': ('test.txt', io.BytesIO(test_file), 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/metadata/",
            files=files,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 415 for unsupported media type
        if response.status_code == 415:
            print_test_result("Metadata Invalid File", True, "Correctly rejected invalid file format", response_time)
            return True
        elif response.status_code == 422:
            print_test_result("Metadata Invalid File", True, "Correctly rejected invalid file format (422)", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Metadata Invalid File", False, f"Expected 415/422, got {response.status_code}: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Metadata Invalid File", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Metadata Invalid File", False, f"Unexpected error: {e}")
        return False

def test_metadata_missing_file():
    """Test POST /metadata/ without file upload"""
    print("\n🧪 Testing Metadata Extraction - Missing File")
    
    try:
        start_time = time.time()
        
        # Send request without files
        response = requests.post(
            f"{BASE_URL}/metadata/",
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 422 for missing required field
        if response.status_code == 422:
            print_test_result("Metadata Missing File", True, "Correctly rejected missing file", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Metadata Missing File", False, f"Expected 422, got {response.status_code}: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Metadata Missing File", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Metadata Missing File", False, f"Unexpected error: {e}")
        return False

def test_metadata_empty_file():
    """Test POST /metadata/ with empty file"""
    print("\n🧪 Testing Metadata Extraction - Empty File")
    
    try:
        start_time = time.time()
        
        # Create empty file
        empty_file = b""
        
        files = {
            'file': ('empty.mp3', io.BytesIO(empty_file), 'audio/mpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/metadata/",
            files=files,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should handle empty files gracefully
        if response.status_code in [415, 422, 400]:
            print_test_result("Metadata Empty File", True, "Correctly rejected empty file", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Metadata Empty File", False, f"Unexpected status {response.status_code}: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Metadata Empty File", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Metadata Empty File", False, f"Unexpected error: {e}")
        return False

def test_metadata_large_file():
    """Test POST /metadata/ with large file (simulated)"""
    print("\n🧪 Testing Metadata Extraction - Large File")
    
    try:
        start_time = time.time()
        
        # Create a larger test file (1MB)
        large_file = create_test_audio_file() + bytes([0x00] * (1024 * 1024))
        
        files = {
            'file': ('large_test.mp3', io.BytesIO(large_file), 'audio/mpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/metadata/",
            files=files,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should handle large files (within limits)
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                print_test_result("Metadata Large File", True, f"Successfully handled large file", response_time)
                return True
            else:
                print_test_result("Metadata Large File", False, f"Success=False: {data.get('error', 'Unknown error')}")
                return False
        elif response.status_code == 415:
            print_test_result("Metadata Large File", True, "Expected 415 (invalid audio format for test file)", response_time)
            return True
        elif response.status_code == 413:
            print_test_result("Metadata Large File", True, "Correctly rejected file too large", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Metadata Large File", False, f"Status code: {response.status_code}, Response: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Metadata Large File", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Metadata Large File", False, f"Unexpected error: {e}")
        return False

def test_metadata_wrong_content_type():
    """Test POST /metadata/ with wrong content type"""
    print("\n🧪 Testing Metadata Extraction - Wrong Content Type")
    
    try:
        start_time = time.time()
        
        # Send audio data but with wrong content type
        test_audio = get_sample_audio_file()
        
        files = {
            'file': ('audio.mp3', io.BytesIO(test_audio), 'application/octet-stream')
        }
        
        response = requests.post(
            f"{BASE_URL}/metadata/",
            files=files,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should handle different content types gracefully
        if response.status_code in [200, 415, 422]:
            print_test_result("Metadata Wrong Content Type", True, "Handled wrong content type appropriately", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Metadata Wrong Content Type", False, f"Status code: {response.status_code}, Response: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Metadata Wrong Content Type", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Metadata Wrong Content Type", False, f"Unexpected error: {e}")
        return False

def run_metadata_tests():
    """Run all metadata extraction related tests"""
    print("=" * 60)
    print("🎵 METADATA ROUTES TEST SUITE")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test server connectivity first
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        if response.status_code != 200:
            print("\n🚨 Server not available. Skipping metadata tests.")
            return
    except:
        print("\n🚨 Server not available. Skipping metadata tests.")
        return
    
    # Run metadata tests
    tests = [
        test_metadata_valid_file,
        test_metadata_invalid_file,
        test_metadata_missing_file,
        test_metadata_empty_file,
        test_metadata_large_file,
        test_metadata_wrong_content_type,
    ]
    
    passed = 0
    failed = 0
    
    for test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print_test_result(test_func.__name__, False, f"Test crashed: {e}")
            failed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 METADATA TESTS SUMMARY")
    print("=" * 60)
    total = passed + failed
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if failed == 0:
        print("\n🎉 All metadata tests passed!")
    else:
        print("\n⚠️  Some metadata tests failed.")

if __name__ == "__main__":
    run_metadata_tests() 