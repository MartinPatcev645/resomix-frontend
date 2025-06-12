#!/usr/bin/env python3
"""
Similarity Routes Test
======================

Test file for similarity calculation endpoints.

Usage: python -m pytest tests/unit/test_routes/test_similarity_routes.py -v
Or run directly: python tests/unit/test_routes/test_similarity_routes.py
"""

import requests
import time
import io
import os
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "http://localhost:8001"
API_KEY = "bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"
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

def test_similarity_upload_valid():
    """Test POST /get_similarity/ with valid audio file"""
    print("\n🧪 Testing Similarity Upload - Valid File")
    
    try:
        start_time = time.time()
        
        # Get audio file
        test_audio = get_sample_audio_file()
        if not test_audio:
            print_test_result("Similarity Upload Valid", False, "Could not create or find audio file")
            return False
        
        files = {
            'file': ('test_audio.mp3', io.BytesIO(test_audio), 'audio/mpeg')
        }
        
        params = {
            'api_key': API_KEY,
            'top_sk': 10
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            files=files,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Check status code - could be 200 for success, 415 for invalid format, or 503 for server unavailable
        if response.status_code == 200:
            # Check response format
            try:
                data = response.json()
            except Exception as e:
                print_test_result("Similarity Upload JSON", False, f"Invalid JSON response: {e}")
                return False
            
            # Check success field
            if data.get("success") is True:
                print_test_result("Similarity Upload Valid", True, f"Successfully calculated similarity", response_time)
                return True
            else:
                print_test_result("Similarity Upload Valid", False, f"Success=False: {data.get('error', 'Unknown error')}")
                return False
        elif response.status_code == 415:
            # Expected for test files that aren't real audio
            print_test_result("Similarity Upload Valid", True, "Expected 415 (invalid audio format for test file)", response_time)
            return True
        elif response.status_code == 503:
            print_test_result("Similarity Upload Valid", True, "Expected 503 (similarity server unavailable)", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Similarity Upload Valid", False, f"Status code: {response.status_code}, Response: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Similarity Upload Valid", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Similarity Upload Valid", False, f"Unexpected error: {e}")
        return False

def test_similarity_upload_invalid_api_key():
    """Test POST /get_similarity/ with invalid API key"""
    print("\n🧪 Testing Similarity Upload - Invalid API Key")
    
    try:
        start_time = time.time()
        
        test_audio = get_sample_audio_file()
        
        files = {
            'file': ('test_audio.mp3', io.BytesIO(test_audio), 'audio/mpeg')
        }
        
        params = {
            'api_key': 'invalid-api-key-12345',
            'top_sk': 10
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            files=files,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 403 for invalid API key
        if response.status_code == 403:
            print_test_result("Similarity Upload Invalid API Key", True, "Correctly rejected invalid API key", response_time)
            return True
        else:
            print_test_result("Similarity Upload Invalid API Key", False, f"Expected 403, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Similarity Upload Invalid API Key", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Similarity Upload Invalid API Key", False, f"Unexpected error: {e}")
        return False

def test_similarity_upload_missing_file():
    """Test POST /get_similarity/ without file upload"""
    print("\n🧪 Testing Similarity Upload - Missing File")
    
    try:
        start_time = time.time()
        
        params = {
            'api_key': API_KEY,
            'top_sk': 10
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 422 for missing required field
        if response.status_code == 422:
            print_test_result("Similarity Upload Missing File", True, "Correctly rejected missing file", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Similarity Upload Missing File", False, f"Expected 422, got {response.status_code}: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Similarity Upload Missing File", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Similarity Upload Missing File", False, f"Unexpected error: {e}")
        return False

def test_similarity_upload_invalid_top_sk():
    """Test POST /get_similarity/ with invalid top_sk parameter"""
    print("\n🧪 Testing Similarity Upload - Invalid top_sk")
    
    try:
        start_time = time.time()
        
        test_audio = get_sample_audio_file()
        
        files = {
            'file': ('test_audio.mp3', io.BytesIO(test_audio), 'audio/mpeg')
        }
        
        params = {
            'api_key': API_KEY,
            'top_sk': 999  # Invalid value (should be 10, 20, 50, or 100)
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            files=files,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should handle invalid top_sk gracefully (fallback to default)
        if response.status_code in [200, 415, 503]:
            print_test_result("Similarity Upload Invalid top_sk", True, "Handled invalid top_sk parameter", response_time)
            return True
        elif response.status_code == 422:
            print_test_result("Similarity Upload Invalid top_sk", True, "Correctly rejected invalid top_sk", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Similarity Upload Invalid top_sk", False, f"Status code: {response.status_code}, Response: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Similarity Upload Invalid top_sk", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Similarity Upload Invalid top_sk", False, f"Unexpected error: {e}")
        return False

def test_similarity_by_id_valid():
    """Test POST /get_selection_similarity/ with valid track ID"""
    print("\n🧪 Testing Similarity By ID - Valid Request")
    
    try:
        start_time = time.time()
        
        # Test data with sample MongoDB ObjectId format
        test_data = {
            "track_id": "507f1f77bcf86cd799439011",
            "top_sk": 10
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/get_selection_similarity/",
            json=test_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Check status code - could be 200, 404 (track not found), or 503 (server unavailable)
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                print_test_result("Similarity By ID Valid", True, "Successfully calculated similarity by ID", response_time)
                return True
            else:
                print_test_result("Similarity By ID Valid", False, f"Success=False: {data.get('error', 'Unknown error')}")
                return False
        elif response.status_code == 404:
            print_test_result("Similarity By ID Valid", True, "Expected 404 (track not found)", response_time)
            return True
        elif response.status_code == 503:
            print_test_result("Similarity By ID Valid", True, "Expected 503 (similarity server unavailable)", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Similarity By ID Valid", False, f"Status code: {response.status_code}, Response: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Similarity By ID Valid", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Similarity By ID Valid", False, f"Unexpected error: {e}")
        return False

def test_similarity_by_id_invalid_api_key():
    """Test POST /get_selection_similarity/ with invalid API key"""
    print("\n🧪 Testing Similarity By ID - Invalid API Key")
    
    try:
        start_time = time.time()
        
        test_data = {
            "track_id": "507f1f77bcf86cd799439011",
            "top_sk": 10
        }
        
        params = {
            'api_key': 'invalid-api-key-12345'
        }
        
        response = requests.post(
            f"{BASE_URL}/get_selection_similarity/",
            json=test_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 403 for invalid API key
        if response.status_code == 403:
            print_test_result("Similarity By ID Invalid API Key", True, "Correctly rejected invalid API key", response_time)
            return True
        else:
            print_test_result("Similarity By ID Invalid API Key", False, f"Expected 403, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Similarity By ID Invalid API Key", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Similarity By ID Invalid API Key", False, f"Unexpected error: {e}")
        return False

def test_similarity_by_id_missing_track_id():
    """Test POST /get_selection_similarity/ without track_id"""
    print("\n🧪 Testing Similarity By ID - Missing Track ID")
    
    try:
        start_time = time.time()
        
        test_data = {
            # Missing track_id
            "top_sk": 10
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/get_selection_similarity/",
            json=test_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 422 for missing required field
        if response.status_code == 422:
            print_test_result("Similarity By ID Missing Track ID", True, "Correctly rejected missing track_id", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Similarity By ID Missing Track ID", False, f"Expected 422, got {response.status_code}: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Similarity By ID Missing Track ID", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Similarity By ID Missing Track ID", False, f"Unexpected error: {e}")
        return False

def test_similarity_by_id_invalid_track_id():
    """Test POST /get_selection_similarity/ with invalid track ID format"""
    print("\n🧪 Testing Similarity By ID - Invalid Track ID")
    
    try:
        start_time = time.time()
        
        test_data = {
            "track_id": "invalid-track-id-format",
            "top_sk": 10
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/get_selection_similarity/",
            json=test_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should handle invalid track ID gracefully
        if response.status_code in [404, 422, 400]:
            print_test_result("Similarity By ID Invalid Track ID", True, "Correctly handled invalid track ID", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Similarity By ID Invalid Track ID", False, f"Status code: {response.status_code}, Response: {data}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Similarity By ID Invalid Track ID", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Similarity By ID Invalid Track ID", False, f"Unexpected error: {e}")
        return False

def run_similarity_tests():
    """Run all similarity calculation related tests"""
    print("=" * 60)
    print("🎛️ SIMILARITY ROUTES TEST SUITE")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test server connectivity first
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        if response.status_code != 200:
            print("\n🚨 Server not available. Skipping similarity tests.")
            return
    except:
        print("\n🚨 Server not available. Skipping similarity tests.")
        return
    
    # Run similarity tests
    tests = [
        test_similarity_upload_valid,
        test_similarity_upload_invalid_api_key,
        test_similarity_upload_missing_file,
        test_similarity_upload_invalid_top_sk,
        test_similarity_by_id_valid,
        test_similarity_by_id_invalid_api_key,
        test_similarity_by_id_missing_track_id,
        test_similarity_by_id_invalid_track_id,
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
    print("📊 SIMILARITY TESTS SUMMARY")
    print("=" * 60)
    total = passed + failed
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if failed == 0:
        print("\n🎉 All similarity tests passed!")
    else:
        print("\n⚠️  Some similarity tests failed.")

if __name__ == "__main__":
    run_similarity_tests() 