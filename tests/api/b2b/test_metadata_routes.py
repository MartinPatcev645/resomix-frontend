#!/usr/bin/env python3
"""
Metadata Routes Test Suite
=========================

Comprehensive testing for metadata extraction endpoints.
Tests file upload validation, metadata extraction, and error handling.

Author: AI Assistant
Date: December 2024
"""

import requests
import json
import time
import os
from io import BytesIO
from datetime import datetime


# Configuration
BASE_URL = "http://localhost:8005"
API_KEY = "sk-proj-test-key-12345"  # Update with your actual API key
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "application/json"
}

# Test Results Storage
test_results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "tests": []
}


def log_test_result(test_name: str, passed: bool, duration: float, details: str = "", response_data: dict = None):
    """Log test result with detailed information."""
    global test_results
    
    test_results["total"] += 1
    if passed:
        test_results["passed"] += 1
        status = "✅ PASS"
    else:
        test_results["failed"] += 1
        status = "❌ FAIL"
    
    result = {
        "name": test_name,
        "passed": passed,
        "duration": duration,
        "details": details,
        "response_data": response_data
    }
    test_results["tests"].append(result)
    
    print(f"\n🧪 Testing {test_name}")
    if passed:
        print(f"{status} {test_name} ({duration:.2f}s)")
        if details:
            print(f"     {details}")
        if response_data:
            print(f"     Response: {json.dumps(response_data, indent=2)}")
    else:
        print(f"{status} {test_name}")
        if details:
            print(f"     {details}")
        if response_data:
            print(f"     Full Response: {json.dumps(response_data, indent=2)}")


def get_audio_file():
    """Get the actual audio1.mp3 file for testing."""
    audio_path = os.path.join(os.path.dirname(__file__), "audio1.mp3")
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"audio1.mp3 not found at {audio_path}")
    
    with open(audio_path, 'rb') as f:
        return f.read()


def test_metadata_valid_file():
    """Test metadata extraction with a valid audio file."""
    start_time = time.time()
    
    try:
        # Use the actual audio1.mp3 file
        audio_data = get_audio_file()
        files = {
            'file': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/metadata/track",
            headers=HEADERS,
            files=files,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "data" in data:
                log_test_result(
                    "Metadata Valid File", 
                    True, 
                    duration, 
                    "Successfully extracted metadata",
                    data
                )
                return True
        
        log_test_result(
            "Metadata Valid File", 
            False, 
            duration, 
            f"Expected 200 with success, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Metadata Valid File", False, duration, f"Exception: {str(e)}")
        return False


def test_metadata_invalid_file():
    """Test metadata extraction with an invalid file (text file)."""
    start_time = time.time()
    
    try:
        # Create a text file
        text_data = b"This is not an audio file, just plain text content."
        files = {
            'file': ('test.txt', BytesIO(text_data), 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/metadata/track",
            headers=HEADERS,
            files=files,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 415 (unsupported media type) for text files
        if response.status_code == 415:
            data = response.json()
            log_test_result(
                "Metadata Invalid File", 
                True, 
                duration, 
                "Correctly rejected invalid file format",
                data
            )
            return True
        
        log_test_result(
            "Metadata Invalid File", 
            False, 
            duration, 
            f"Expected 415, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Metadata Invalid File", False, duration, f"Exception: {str(e)}")
        return False


def test_metadata_missing_file():
    """Test metadata extraction without providing a file."""
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/metadata/track",
            headers=HEADERS,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for missing required field
        if response.status_code == 422:
            log_test_result("Metadata Missing File", True, duration, "Correctly rejected missing file")
            return True
        
        log_test_result(
            "Metadata Missing File", 
            False, 
            duration, 
            f"Expected 422, got {response.status_code}: {response.text}"
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Metadata Missing File", False, duration, f"Exception: {str(e)}")
        return False


def test_metadata_empty_file():
    """Test metadata extraction with an empty file."""
    start_time = time.time()
    
    try:
        # Create empty file
        files = {
            'file': ('empty.mp3', BytesIO(b''), 'audio/mpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/metadata/track",
            headers=HEADERS,
            files=files,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for empty file
        if response.status_code == 422:
            data = response.json()
            log_test_result(
                "Metadata Empty File", 
                True, 
                duration, 
                "Correctly rejected empty file",
                data
            )
            return True
        
        log_test_result(
            "Metadata Empty File", 
            False, 
            duration, 
            f"Expected 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Metadata Empty File", False, duration, f"Exception: {str(e)}")
        return False


def test_metadata_large_file():
    """Test metadata extraction with a large file."""
    start_time = time.time()
    
    try:
        # Create a large file (10MB of dummy data)
        large_data = b'\x00' * (10 * 1024 * 1024)
        files = {
            'file': ('large_test.bin', BytesIO(large_data), 'application/octet-stream')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/metadata/track",
            headers=HEADERS,
            files=files,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should handle appropriately (likely 415 for unsupported format)
        if response.status_code in [415, 422]:
            log_test_result("Metadata Large File", True, duration, f"Handled large file appropriately ({response.status_code})")
            return True
        
        log_test_result(
            "Metadata Large File", 
            False, 
            duration, 
            f"Unexpected status {response.status_code}: {response.text}"
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Metadata Large File", False, duration, f"Exception: {str(e)}")
        return False


def test_metadata_wrong_content_type():
    """Test metadata extraction with wrong content type."""
    start_time = time.time()
    
    try:
        # Send audio data but with wrong content type
        audio_data = get_audio_file()
        files = {
            'file': ('audio1.mp3', BytesIO(audio_data), 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/metadata/track",
            headers=HEADERS,
            files=files,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should either work (if it processes by filename) or reject appropriately
        if response.status_code in [200, 415]:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else None
            log_test_result(
                "Metadata Wrong Content Type", 
                True, 
                duration, 
                "Handled wrong content type appropriately",
                data
            )
            return True
        
        log_test_result(
            "Metadata Wrong Content Type", 
            False, 
            duration, 
            f"Unexpected status {response.status_code}: {response.text}"
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Metadata Wrong Content Type", False, duration, f"Exception: {str(e)}")
        return False


def run_metadata_tests():
    """Run all metadata tests."""
    print("=" * 60)
    print("🎵 METADATA ROUTES TEST SUITE")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    test_metadata_valid_file()
    test_metadata_invalid_file()
    test_metadata_missing_file()
    test_metadata_empty_file()
    test_metadata_large_file()
    test_metadata_wrong_content_type()
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 METADATA TESTS SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {test_results['total']}")
    print(f"Passed: {test_results['passed']} ✅")
    print(f"Failed: {test_results['failed']} ❌")
    print(f"Success Rate: {test_results['passed']/test_results['total']*100:.1f}%")
    
    if test_results['failed'] > 0:
        print("\n⚠️  Some metadata tests failed.")
    else:
        print("\n🎉 All metadata tests passed!")
    
    return test_results


if __name__ == "__main__":
    run_metadata_tests() 