#!/usr/bin/env python3
"""
Similarity Routes Test Suite
===========================

Comprehensive testing for similarity calculation endpoints.
Tests audio file similarity analysis and selection similarity functionality.

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


def test_similarity_valid_files():
    """Test similarity calculation with valid audio files."""
    start_time = time.time()
    
    try:
        # Use the actual audio1.mp3 file for both files
        audio_data = get_audio_file()
        
        files = {
            'file1': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg'),
            'file2': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            headers=HEADERS,
            files=files,
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
                    "Successfully calculated similarity",
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
        # Only provide one file
        audio_data = get_audio_file()
        files = {
            'file1': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            headers=HEADERS,
            files=files,
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
    """Test similarity calculation with invalid files."""
    start_time = time.time()
    
    try:
        # Create text files instead of audio
        text1 = b"This is not an audio file"
        text2 = b"This is also not an audio file"
        
        files = {
            'file1': ('text1.txt', BytesIO(text1), 'text/plain'),
            'file2': ('text2.txt', BytesIO(text2), 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            headers=HEADERS,
            files=files,
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
                f"Correctly rejected invalid files ({response.status_code})",
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
    """Test similarity calculation with empty files."""
    start_time = time.time()
    
    try:
        files = {
            'file1': ('empty1.mp3', BytesIO(b''), 'audio/mpeg'),
            'file2': ('empty2.mp3', BytesIO(b''), 'audio/mpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            headers=HEADERS,
            files=files,
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
                "Correctly rejected empty files",
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
            "track_ids": ["track1", "track2", "track3"],
            "user_preferences": {
                "genre": "electronic",
                "energy": 0.8,
                "valence": 0.6
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/get_selection_similarity/",
            headers=HEADERS,
            json=selection_data,
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
        # Missing track_ids
        selection_data = {
            "user_preferences": {
                "genre": "electronic"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/get_selection_similarity/",
            headers=HEADERS,
            json=selection_data,
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
        # Invalid data types
        selection_data = {
            "track_ids": "not_a_list",
            "user_preferences": "not_an_object"
        }
        
        response = requests.post(
            f"{BASE_URL}/get_selection_similarity/",
            headers=HEADERS,
            json=selection_data,
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
            'file1': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg'),
            'file2': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        # Request without authorization header
        response = requests.post(
            f"{BASE_URL}/get_similarity/",
            files=files,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 401 for unauthorized access
        if response.status_code == 401:
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
            f"Expected 401, got {response.status_code}: {response.text}",
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