#!/usr/bin/env python3
"""
Monthly Pipeline Routes Test Suite
==================================

This module contains comprehensive unit tests for monthly pipeline track endpoints
in the Resomix Audio Similarity API. It tests track processing, embedding preview generation,
database storage, and error handling scenarios.

Provides testing for monthly pipeline track upload, validation, authentication,
and edge cases with comprehensive result verification.

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
BASE_URL = "http://localhost:8001"  # Update to your server port
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


def test_monthly_pipeline_valid_upload():
    """Test monthly pipeline with a valid audio file."""
    start_time = time.time()
    
    try:
        # Use the actual audio1.mp3 file
        audio_data = get_audio_file()
        
        files = {
            'file': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        data = {
            'path': '/monthly/tracks/test_track_001.mp3'
        }
        
        params = {
            
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ingest/monthly/track/",
            headers=HEADERS,
            files=files,
            data=data,
            params=params,
            timeout=120  # Monthly pipeline processing might take longer
        )
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            resp_data = response.json()
            if (resp_data.get("success") and 
                "data" in resp_data and 
                "track_uuid" in resp_data["data"] and
                "path" in resp_data["data"] and
                resp_data["data"]["path"] == '/monthly/tracks/test_track_001.mp3'):
                log_test_result(
                    "Monthly Pipeline Valid Upload",
                    True,
                    duration,
                    "Successfully processed track through monthly pipeline",
                    resp_data
                )
                return True
        
        log_test_result(
            "Monthly Pipeline Valid Upload",
            False,
            duration,
            f"Expected 200 with success, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Monthly Pipeline Valid Upload", False, duration, f"Exception: {str(e)}")
        return False


def test_monthly_pipeline_missing_file():
    """Test monthly pipeline with missing file."""
    start_time = time.time()
    
    try:
        # Send request without any file
        data = {
            'path': '/monthly/tracks/test_track_002.mp3'
        }
        
        params = {
            
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ingest/monthly/track/",
            headers=HEADERS,
            data=data,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for missing required file
        if response.status_code == 422:
            resp_data = response.json()
            log_test_result(
                "Monthly Pipeline Missing File",
                True,
                duration,
                "Correctly rejected missing file",
                resp_data
            )
            return True
        
        log_test_result(
            "Monthly Pipeline Missing File",
            False,
            duration,
            f"Expected 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Monthly Pipeline Missing File", False, duration, f"Exception: {str(e)}")
        return False


def test_monthly_pipeline_missing_path():
    """Test monthly pipeline with missing path field."""
    start_time = time.time()
    
    try:
        # Use the actual audio1.mp3 file but omit path
        audio_data = get_audio_file()
        
        files = {
            'file': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        params = {
            
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ingest/monthly/track/",
            headers=HEADERS,
            files=files,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for missing required path field
        if response.status_code == 422:
            resp_data = response.json()
            log_test_result(
                "Monthly Pipeline Missing Path",
                True,
                duration,
                "Correctly rejected missing path field",
                resp_data
            )
            return True
        
        log_test_result(
            "Monthly Pipeline Missing Path",
            False,
            duration,
            f"Expected 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Monthly Pipeline Missing Path", False, duration, f"Exception: {str(e)}")
        return False


def test_monthly_pipeline_empty_path():
    """Test monthly pipeline with empty path field."""
    start_time = time.time()
    
    try:
        # Use the actual audio1.mp3 file but with empty path
        audio_data = get_audio_file()
        
        files = {
            'file': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        data = {
            'path': ''  # Empty path
        }
        
        params = {
            
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ingest/monthly/track/",
            headers=HEADERS,
            files=files,
            data=data,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for empty path (min_length=1 in schema)
        if response.status_code == 422:
            resp_data = response.json()
            log_test_result(
                "Monthly Pipeline Empty Path",
                True,
                duration,
                "Correctly rejected empty path field",
                resp_data
            )
            return True
        
        log_test_result(
            "Monthly Pipeline Empty Path",
            False,
            duration,
            f"Expected 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Monthly Pipeline Empty Path", False, duration, f"Exception: {str(e)}")
        return False


def test_monthly_pipeline_invalid_file():
    """Test monthly pipeline with an invalid file."""
    start_time = time.time()
    
    try:
        # Create text file instead of audio
        text_data = b"This is not an audio file, just plain text data"
        
        files = {
            'file': ('text1.txt', BytesIO(text_data), 'text/plain')
        }
        
        data = {
            'path': '/monthly/tracks/invalid_file.txt'
        }
        
        params = {
            
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ingest/monthly/track/",
            headers=HEADERS,
            files=files,
            data=data,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 415 for unsupported media type
        if response.status_code == 415:
            resp_data = response.json()
            log_test_result(
                "Monthly Pipeline Invalid File",
                True,
                duration,
                "Correctly rejected non-audio file",
                resp_data
            )
            return True
        
        log_test_result(
            "Monthly Pipeline Invalid File",
            False,
            duration,
            f"Expected 415, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Monthly Pipeline Invalid File", False, duration, f"Exception: {str(e)}")
        return False


def test_monthly_pipeline_empty_file():
    """Test monthly pipeline with an empty file."""
    start_time = time.time()
    
    try:
        # Create empty audio file
        empty_data = b""
        
        files = {
            'file': ('empty.mp3', BytesIO(empty_data), 'audio/mpeg')
        }
        
        data = {
            'path': '/monthly/tracks/empty_file.mp3'
        }
        
        params = {
            
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ingest/monthly/track/",
            headers=HEADERS,
            files=files,
            data=data,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for empty file
        if response.status_code == 422:
            resp_data = response.json()
            log_test_result(
                "Monthly Pipeline Empty File",
                True,
                duration,
                "Correctly rejected empty file",
                resp_data
            )
            return True
        
        log_test_result(
            "Monthly Pipeline Empty File",
            False,
            duration,
            f"Expected 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Monthly Pipeline Empty File", False, duration, f"Exception: {str(e)}")
        return False


def test_monthly_pipeline_large_file():
    """Test monthly pipeline with a file that exceeds size limit."""
    start_time = time.time()
    
    try:
        # Create a file larger than typical limit (assuming 100MB limit)
        # Create 1MB of data as a sample (adjust based on your actual limits)
        large_data = b"X" * (1024 * 1024)  # 1MB of X's
        
        files = {
            'file': ('large_audio.mp3', BytesIO(large_data), 'audio/mpeg')
        }
        
        data = {
            'path': '/monthly/tracks/large_file.mp3'
        }
        
        params = {
            
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ingest/monthly/track/",
            headers=HEADERS,
            files=files,
            data=data,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for file too large (if 1MB exceeds limit) or 415 for invalid audio
        if response.status_code in [422, 415]:
            resp_data = response.json()
            log_test_result(
                "Monthly Pipeline Large File",
                True,
                duration,
                f"Correctly rejected large/invalid file with status {response.status_code}",
                resp_data
            )
            return True
        
        log_test_result(
            "Monthly Pipeline Large File",
            False,
            duration,
            f"Expected 422 or 415, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Monthly Pipeline Large File", False, duration, f"Exception: {str(e)}")
        return False


def test_monthly_pipeline_large_mp3_mix_filter():
    """Test monthly pipeline with a large MP3 file that should be rejected by mix filter."""
    start_time = time.time()
    
    try:
        # Create a 55MB MP3 file (exceeds 50MB limit for MP3s)
        large_mp3_data = b"ID3" + b"X" * (55 * 1024 * 1024 - 3)  # 55MB with ID3 header
        
        files = {
            'file': ('large_mix.mp3', BytesIO(large_mp3_data), 'audio/mpeg')
        }
        
        data = {
            'path': '/monthly/tracks/large_mix.mp3'
        }
        
        params = {
            
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ingest/monthly/track/",
            headers=HEADERS,
            files=files,
            data=data,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for mix filter rejection
        if response.status_code == 422:
            resp_data = response.json()
            error_message = resp_data.get("error", "")
            if "mix filter" in error_message.lower() and "50mb" in error_message.lower():
                log_test_result(
                    "Monthly Pipeline Large MP3 Mix Filter",
                    True,
                    duration,
                    "Correctly rejected large MP3 file by mix filter",
                    resp_data
                )
                return True
        
        log_test_result(
            "Monthly Pipeline Large MP3 Mix Filter",
            False,
            duration,
            f"Expected 422 with mix filter message, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Monthly Pipeline Large MP3 Mix Filter", False, duration, f"Exception: {str(e)}")
        return False


def test_monthly_pipeline_unauthorized():
    """Test monthly pipeline without authentication."""
    start_time = time.time()
    
    try:
        # Use the actual audio1.mp3 file but without API key
        audio_data = get_audio_file()
        
        files = {
            'file': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        data = {
            'path': '/monthly/tracks/unauthorized_test.mp3'
        }
        
        # No API key in params
        response = requests.post(
            f"{BASE_URL}/api/v1/ingest/monthly/track/",
            headers=HEADERS,
            files=files,
            data=data,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 403 for unauthorized
        if response.status_code == 403:
            resp_data = response.json()
            log_test_result(
                "Monthly Pipeline Unauthorized",
                True,
                duration,
                "Correctly rejected unauthorized request",
                resp_data
            )
            return True
        
        log_test_result(
            "Monthly Pipeline Unauthorized",
            False,
            duration,
            f"Expected 403, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Monthly Pipeline Unauthorized", False, duration, f"Exception: {str(e)}")
        return False


def test_monthly_pipeline_very_long_path():
    """Test monthly pipeline with an extremely long path."""
    start_time = time.time()
    
    try:
        # Use the actual audio1.mp3 file with very long path
        audio_data = get_audio_file()
        
        files = {
            'file': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        # Create path longer than max_length=1000 in schema
        long_path = '/monthly/tracks/' + 'a' * 1000 + '.mp3'
        
        data = {
            'path': long_path
        }
        
        params = {
            
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ingest/monthly/track/",
            headers=HEADERS,
            files=files,
            data=data,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 422 for path too long (max_length=1000)
        if response.status_code == 422:
            resp_data = response.json()
            log_test_result(
                "Monthly Pipeline Very Long Path",
                True,
                duration,
                "Correctly rejected path that exceeds maximum length",
                resp_data
            )
            return True
        
        log_test_result(
            "Monthly Pipeline Very Long Path",
            False,
            duration,
            f"Expected 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Monthly Pipeline Very Long Path", False, duration, f"Exception: {str(e)}")
        return False


def test_monthly_pipeline_special_characters_path():
    """Test monthly pipeline with special characters in path."""
    start_time = time.time()
    
    try:
        # Use the actual audio1.mp3 file with special characters in path
        audio_data = get_audio_file()
        
        files = {
            'file': ('audio1.mp3', BytesIO(audio_data), 'audio/mpeg')
        }
        
        data = {
            'path': '/monthly/tracks/test-file_with.special#chars@2025.mp3'
        }
        
        params = {
            
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/ingest/monthly/track/",
            headers=HEADERS,
            files=files,
            data=data,
            params=params,
            timeout=300
        )
        
        duration = time.time() - start_time
        
        # Should either succeed (200) or fail gracefully based on validation rules
        if response.status_code == 200:
            resp_data = response.json()
            if (resp_data.get("success") and 
                "data" in resp_data and 
                "track_uuid" in resp_data["data"]):
                log_test_result(
                    "Monthly Pipeline Special Characters Path",
                    True,
                    duration,
                    "Successfully processed track with special characters in path",
                    resp_data
                )
                return True
        elif response.status_code == 422:
            # Also acceptable if validation rejects special characters
            resp_data = response.json()
            log_test_result(
                "Monthly Pipeline Special Characters Path",
                True,
                duration,
                "Correctly handled special characters (validation rejected)",
                resp_data
            )
            return True
        
        log_test_result(
            "Monthly Pipeline Special Characters Path",
            False,
            duration,
            f"Expected 200 or 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Monthly Pipeline Special Characters Path", False, duration, f"Exception: {str(e)}")
        return False


def print_test_summary():
    """Print comprehensive test summary."""
    print("\n" + "="*60)
    print("🧪 MONTHLY PIPELINE TESTS SUMMARY")
    print("="*60)
    
    print("\n📊 Overall Results:")
    print(f"   Total Tests: {test_results['total']}")
    print(f"   ✅ Passed: {test_results['passed']}")
    print(f"   ❌ Failed: {test_results['failed']}")
    
    if test_results['total'] > 0:
        pass_rate = (test_results['passed'] / test_results['total']) * 100
        print(f"   📈 Pass Rate: {pass_rate:.1f}%")
    
    print("\n📋 Detailed Results:")
    for i, test in enumerate(test_results['tests'], 1):
        status = "✅" if test['passed'] else "❌"
        print(f"   {i:2d}. {status} {test['name']} ({test['duration']:.2f}s)")
        if not test['passed'] and test['details']:
            print(f"       🔍 {test['details']}")
    
    print(f"\n🏁 Test run completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)


def run_monthly_pipeline_tests():
    """Run all monthly pipeline tests."""
    print("\n🚀 Starting Monthly Pipeline Route Tests")
    print("="*60)
    print(f"📡 Testing against: {BASE_URL}")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test cases in order of complexity
    test_functions = [
        test_monthly_pipeline_valid_upload,           # Basic success case
        test_monthly_pipeline_missing_file,           # Missing file validation
        test_monthly_pipeline_missing_path,           # Missing path validation  
        test_monthly_pipeline_empty_path,             # Empty path validation
        test_monthly_pipeline_invalid_file,           # Invalid file type
        test_monthly_pipeline_empty_file,             # Empty file validation
        test_monthly_pipeline_large_file,             # File size validation
        test_monthly_pipeline_large_mp3_mix_filter,    # Large MP3 mix filter validation
        test_monthly_pipeline_unauthorized,           # Authentication
        test_monthly_pipeline_very_long_path,         # Path length validation
        test_monthly_pipeline_special_characters_path # Special characters handling
    ]
    
    print(f"\n📋 Running {len(test_functions)} test cases...")
    
    for test_func in test_functions:
        try:
            test_func()
        except Exception as e:
            log_test_result(test_func.__name__, False, 0, f"Test setup failed: {str(e)}")
    
    print_test_summary()
    
    # Return success if all tests passed
    return test_results['failed'] == 0


if __name__ == "__main__":
    success = run_monthly_pipeline_tests()
    exit(0 if success else 1) 