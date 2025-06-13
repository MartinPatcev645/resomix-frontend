#!/usr/bin/env python3
"""
Similarity Routes Test Suite
============================

This module contains comprehensive unit tests for similarity calculation endpoints
in the ResomiX Audio Similarity API. It tests audio file similarity analysis,
selection similarity functionality, and error handling scenarios.

Provides testing for upload-based similarity, ID-based similarity, validation,
authentication, and edge cases with comprehensive result verification.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import requests
import json
import time
import os
from io import BytesIO
from datetime import datetime


# Configuration
BASE_URL = "http://localhost:8005"
API_KEY = "bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"  # Use the actual API key from auth.py
HEADERS = {
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


def test_similarity_valid_files():
    """Test similarity calculation with a valid audio file."""
    start_time = time.time()
    
    try:
        # Use the actual audio1.mp3 file for both files
        audio_data = get_audio_file()
        
        files = {
            'file': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            headers=HEADERS,
            files=files,
            params=params,
            timeout=60  # Similarity calculation might take longer
        )
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "data" in data:
                log_test_result(
                    "Similarity Valid Files",
                    True,
                    duration,
                    "Successfully calculated similarity for audio file",
                    data
                )
                return True
        
        log_test_result(
            "Similarity Valid Files",
            False,
            duration,
            f"Expected 200 with success, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Similarity Valid Files", False, duration, f"Exception: {str(e)}")
        return False


def test_similarity_missing_file():
    """Test similarity calculation with missing file."""
    start_time = time.time()
    
    try:
        # Send request without any file
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            headers=HEADERS,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for missing required file
        if response.status_code == 422:
            data = response.json()
            log_test_result(
                "Similarity Missing File",
                True,
                duration,
                "Correctly rejected missing file",
                data
            )
            return True
        
        log_test_result(
            "Similarity Missing File",
            False,
            duration,
            f"Expected 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Similarity Missing File", False, duration, f"Exception: {str(e)}")
        return False


def test_similarity_invalid_files():
    """Test similarity calculation with an invalid file."""
    start_time = time.time()
    
    try:
        # Create text file instead of audio
        text_data = b"This is not an audio file"
        
        files = {
            'file': ('text1.txt', BytesIO(text_data), 'text/plain')
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            headers=HEADERS,
            files=files,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 415 for unsupported media type
        if response.status_code in [415, 422]:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else None
            log_test_result(
                "Similarity Invalid Files",
                True,
                duration,
                f"Correctly rejected invalid file ({response.status_code})",
                data
            )
            return True
        
        log_test_result(
            "Similarity Invalid Files",
            False,
            duration,
            f"Expected 415/422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Similarity Invalid Files", False, duration, f"Exception: {str(e)}")
        return False


def test_similarity_empty_files():
    """Test similarity calculation with an empty file."""
    start_time = time.time()
    
    try:
        files = {
            'file': ('empty.mp3', BytesIO(b''), 'audio/mpeg')
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            headers=HEADERS,
            files=files,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for empty files
        if response.status_code == 422:
            data = response.json()
            log_test_result(
                "Similarity Empty Files",
                True,
                duration,
                "Correctly rejected empty file",
                data
            )
            return True
        
        log_test_result(
            "Similarity Empty Files",
            False,
            duration,
            f"Expected 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Similarity Empty Files", False, duration, f"Exception: {str(e)}")
        return False


def test_selection_similarity_valid():
    """Test selection similarity with valid data."""
    start_time = time.time()
    
    try:
        # Valid selection similarity data
        selection_data = {
            "track_id": "67ad9cec799206f8d64acdf1",  # Valid MongoDB ObjectId format
            "top_sk": 10
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/get_selection_similarity/",
            headers=HEADERS,
            json=selection_data,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                log_test_result(
                    "Selection Similarity Valid",
                    True,
                    duration,
                    "Successfully calculated selection similarity",
                    data
                )
                return True
        
        log_test_result(
            "Selection Similarity Valid",
            False,
            duration,
            f"Expected 200 with success, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Selection Similarity Valid", False, duration, f"Exception: {str(e)}")
        return False


def test_selection_similarity_missing_data():
    """Test selection similarity with missing data."""
    start_time = time.time()
    
    try:
        # Missing track_id
        selection_data = {
            "top_sk": 10
            # Missing required track_id
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/get_selection_similarity/",
            headers=HEADERS,
            json=selection_data,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for validation error
        if response.status_code == 422:
            data = response.json()
            log_test_result(
                "Selection Similarity Missing Data",
                True,
                duration,
                "Correctly rejected missing required data",
                data
            )
            return True
        
        log_test_result(
            "Selection Similarity Missing Data",
            False,
            duration,
            f"Expected 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Selection Similarity Missing Data", False, duration, f"Exception: {str(e)}")
        return False


def test_selection_similarity_invalid_data():
    """Test selection similarity with invalid data types."""
    start_time = time.time()
    
    try:
        # Invalid track_id format
        selection_data = {
            "track_id": "invalid-track-id-format",
            "top_sk": 999  # Also invalid value
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/get_selection_similarity/",
            headers=HEADERS,
            json=selection_data,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for validation error
        if response.status_code == 422:
            data = response.json()
            log_test_result(
                "Selection Similarity Invalid Data",
                True,
                duration,
                "Correctly rejected invalid data types",
                data
            )
            return True
        
        log_test_result(
            "Selection Similarity Invalid Data",
            False,
            duration,
            f"Expected 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Selection Similarity Invalid Data", False, duration, f"Exception: {str(e)}")
        return False


def test_similarity_unauthorized():
    """Test similarity endpoints without API key."""
    start_time = time.time()
    
    try:
        audio_data = get_audio_file()
        
        files = {
            'file': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        # Request without API key
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            files=files,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 403 for unauthorized access (as per auth dependency)
        if response.status_code == 403:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else None
            log_test_result(
                "Similarity Unauthorized",
                True,
                duration,
                "Correctly rejected unauthorized request",
                data
            )
            return True
        
        log_test_result(
            "Similarity Unauthorized",
            False,
            duration,
            f"Expected 403, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Similarity Unauthorized", False, duration, f"Exception: {str(e)}")
        return False


def run_similarity_tests():
    """Run all similarity tests."""
    print("=" * 60)
    print("🎯 SIMILARITY ROUTES TEST SUITE")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    test_similarity_valid_files()
    test_similarity_missing_file()
    test_similarity_invalid_files()
    test_similarity_empty_files()
    test_selection_similarity_valid()
    test_selection_similarity_missing_data()
    test_selection_similarity_invalid_data()
    test_similarity_unauthorized()
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 SIMILARITY TESTS SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {test_results['total']}")
    print(f"Passed: {test_results['passed']} ✅")
    print(f"Failed: {test_results['failed']} ❌")
    print(f"Success Rate: {test_results['passed']/test_results['total']*100:.1f}%")
    
    if test_results['failed'] > 0:
        print(f"\n⚠️  Some similarity tests failed.")
    else:
        print(f"\n🎉 All similarity tests passed!")
    
    return test_results


if __name__ == "__main__":
    run_similarity_tests() 