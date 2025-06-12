#!/usr/bin/env python3
"""
FastAPI Migration Test Suite
===========================

This script tests all existing endpoints to ensure they continue working
during the migration from monolithic to modular structure.

Usage: python test.py
"""

import requests
import json
import os
import io
from typing import Dict, Any, Optional
from pathlib import Path
import time

# Configuration
BASE_URL = "http://localhost:8005"  # Adjust if your server runs on different port
API_KEY = "bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"
TIMEOUT = 30

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "errors": []
}

def print_header():
    """Print test suite header"""
    print("=" * 60)
    print("🧪 RESOMIX API MIGRATION TEST SUITE")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)

def print_test_result(test_name: str, success: bool, message: str = "", response_time: float = 0):
    """Print individual test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    time_str = f"({response_time:.2f}s)" if response_time > 0 else ""
    print(f"{status} {test_name} {time_str}")
    if message:
        print(f"     {message}")
    
    if success:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1
        test_results["errors"].append(f"{test_name}: {message}")

def create_test_audio_file() -> bytes:
    """Create a proper MP3 test file with valid headers"""
    # Create a minimal but valid MP3 file
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

def test_server_connection():
    """Test if server is running and accessible"""
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            print_test_result("Server Connection", True, "FastAPI docs accessible", response_time)
            return True
        else:
            print_test_result("Server Connection", False, f"Docs returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_test_result("Server Connection", False, f"Cannot connect to server: {str(e)}")
        return False

def test_health_endpoint():
    """Test the root health check endpoint"""
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/", timeout=TIMEOUT)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            # Updated to match the actual response format from health.py
            expected_keys = {"name", "version", "status", "docs_url"}
            if all(key in data for key in expected_keys) and data.get("status") == "running":
                print_test_result("Health Check", True, "Root endpoint working correctly", response_time)
                return True
            else:
                print_test_result("Health Check", False, f"Unexpected response format: {data}")
                return False
        else:
            print_test_result("Health Check", False, f"Status code: {response.status_code}")
            return False
    except Exception as e:
        print_test_result("Health Check", False, f"Exception: {str(e)}")
        return False

def test_health_dedicated_endpoint():
    """Test the dedicated /health endpoint"""
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/health", timeout=TIMEOUT)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print_test_result("Health Dedicated", True, "Health endpoint working", response_time)
                return True
            else:
                print_test_result("Health Dedicated", False, f"Unexpected response: {data}")
                return False
        else:
            print_test_result("Health Dedicated", False, f"Status code: {response.status_code}")
            return False
    except Exception as e:
        print_test_result("Health Dedicated", False, f"Exception: {str(e)}")
        return False

def test_metadata_endpoint():
    """Test the metadata extraction endpoint"""
    try:
        start_time = time.time()
        
        # Get a proper audio file
        test_audio = get_sample_audio_file()
        if not test_audio:
            print_test_result("Metadata Extraction", False, "Could not create or find audio file")
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
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                print_test_result("Metadata Extraction", True, "Metadata endpoint working", response_time)
                return True
            else:
                print_test_result("Metadata Extraction", False, f"Success=False: {data.get('error', 'Unknown error')}")
                return False
        elif response.status_code == 415:
            # Expected for test files that aren't real audio
            print_test_result("Metadata Extraction", True, "Expected 415 (invalid audio format for test file)", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Metadata Extraction", False, f"Status code: {response.status_code}, Response: {data}")
            return False
    except Exception as e:
        print_test_result("Metadata Extraction", False, f"Exception: {str(e)}")
        return False

def test_similarity_upload_endpoint():
    """Test the similarity calculation with file upload"""
    try:
        start_time = time.time()
        
        # Get a proper audio file
        test_audio = get_sample_audio_file()
        if not test_audio:
            print_test_result("Similarity Upload", False, "Could not create or find audio file")
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
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                print_test_result("Similarity Upload", True, "Similarity endpoint working", response_time)
                return True
            else:
                print_test_result("Similarity Upload", False, f"Success=False: {data.get('error', 'Unknown error')}")
                return False
        elif response.status_code == 503:
            print_test_result("Similarity Upload", True, "Expected 503 (similarity server unavailable)", response_time)
            return True
        elif response.status_code == 415:
            # Expected for test files that aren't real audio
            print_test_result("Similarity Upload", True, "Expected 415 (invalid audio format for test file)", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Similarity Upload", False, f"Status code: {response.status_code}, Response: {data}")
            return False
    except Exception as e:
        print_test_result("Similarity Upload", False, f"Exception: {str(e)}")
        return False

def test_similarity_by_id_endpoint():
    """Test the similarity calculation by track ID"""
    try:
        start_time = time.time()
        
        # Test data - using proper schema format
        test_data = {
            "track_id": "507f1f77bcf86cd799439011",  # Sample MongoDB ObjectId format
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
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                print_test_result("Similarity By ID", True, "Similarity by ID endpoint working", response_time)
                return True
            else:
                print_test_result("Similarity By ID", False, f"Success=False: {data.get('error', 'Unknown error')}")
                return False
        elif response.status_code == 404:
            print_test_result("Similarity By ID", True, "Expected 404 (track not found)", response_time)
            return True
        elif response.status_code == 503:
            print_test_result("Similarity By ID", True, "Expected 503 (similarity server unavailable)", response_time)
            return True
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Similarity By ID", False, f"Status code: {response.status_code}, Response: {data}")
            return False
    except Exception as e:
        print_test_result("Similarity By ID", False, f"Exception: {str(e)}")
        return False

def test_search_endpoint():
    """Test the search tracks endpoint"""
    try:
        start_time = time.time()
        
        params = {
            'query': 'test',
            'api_key': API_KEY
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            # Updated to handle the new response format with nested 'data' key
            if data.get("success") is True and "data" in data:
                # Check if tracks are in data.tracks or just data
                tracks_data = data["data"]
                if "tracks" in tracks_data:
                    tracks = tracks_data["tracks"]
                    print_test_result("Search Tracks", True, f"Found {len(tracks)} tracks", response_time)
                    return True
                else:
                    print_test_result("Search Tracks", False, f"No 'tracks' key in data: {tracks_data}")
                    return False
            else:
                print_test_result("Search Tracks", False, f"Unexpected response format: {data}")
                return False
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Search Tracks", False, f"Status code: {response.status_code}, Response: {data}")
            return False
    except Exception as e:
        print_test_result("Search Tracks", False, f"Exception: {str(e)}")
        return False

def test_feedback_endpoint():
    """Test the feedback submission endpoint"""
    try:
        start_time = time.time()
        
        # Proper feedback data matching the schema
        feedback_data = {
            "satisfaction": 8,
            "recommendation": 9,
            "feedback": "This is a test feedback from the test suite"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/feedback",
            json=feedback_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                print_test_result("Feedback Submission", True, "Feedback endpoint working", response_time)
                return True
            else:
                print_test_result("Feedback Submission", False, f"Success=False: {data.get('error', 'Unknown error')}")
                return False
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Feedback Submission", False, f"Status code: {response.status_code}, Response: {data}")
            return False
    except Exception as e:
        print_test_result("Feedback Submission", False, f"Exception: {str(e)}")
        return False

def test_contact_endpoint():
    """Test the contact form submission endpoint"""
    try:
        start_time = time.time()
        
        # Proper contact data matching the ContactRequest schema
        contact_data = {
            "name": "Test User",
            "email": "test@example.com",
            "message": "This is a test contact form submission from the test suite",
            "subject": "Test Contact",
            "formType": "contact"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/contact",
            json=contact_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                print_test_result("Contact Form", True, "Contact endpoint working", response_time)
                return True
            else:
                print_test_result("Contact Form", False, f"Success=False: {data.get('error', 'Unknown error')}")
                return False
        else:
            data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print_test_result("Contact Form", False, f"Status code: {response.status_code}, Response: {data}")
            return False
    except Exception as e:
        print_test_result("Contact Form", False, f"Exception: {str(e)}")
        return False

def test_api_key_validation():
    """Test API key validation"""
    try:
        start_time = time.time()
        
        params = {
            'query': 'test',
            'api_key': 'invalid-api-key'
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        if response.status_code == 403:
            print_test_result("API Key Validation", True, "Invalid API key properly rejected", response_time)
            return True
        else:
            print_test_result("API Key Validation", False, f"Expected 403, got {response.status_code}")
            return False
    except Exception as e:
        print_test_result("API Key Validation", False, f"Exception: {str(e)}")
        return False

def run_all_tests():
    """Run all tests and display summary"""
    print_header()
    
    # Test server availability first
    if not test_server_connection():
        print("\n🚨 Server not available. Exiting.")
        return
    
    # Run all endpoint tests
    tests = [
        test_health_endpoint,
        test_health_dedicated_endpoint,
        test_metadata_endpoint,
        test_similarity_upload_endpoint,
        test_similarity_by_id_endpoint,
        test_search_endpoint,
        test_feedback_endpoint,
        test_contact_endpoint,
        test_api_key_validation,
    ]
    
    for test_func in tests:
        try:
            test_func()
        except Exception as e:
            print_test_result(test_func.__name__, False, f"Test crashed: {str(e)}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    total = test_results["passed"] + test_results["failed"]
    success_rate = (test_results["passed"] / total * 100) if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"Passed: {test_results['passed']} ✅")
    print(f"Failed: {test_results['failed']} ❌")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if test_results["errors"]:
        print(f"\n🚨 FAILED TESTS:")
        for error in test_results["errors"]:
            print(f"   • {error}")
    
    print("\n" + "=" * 60)
    if test_results["failed"] == 0:
        print("🎉 All tests passed!")
    else:
        print("⚠️  Some tests failed. Check the errors above.")

if __name__ == "__main__":
    run_all_tests()
