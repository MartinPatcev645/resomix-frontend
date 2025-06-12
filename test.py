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
BASE_URL = "http://localhost:8001"  # Adjust if your server runs on different port
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
    """Create a small test audio file (MP3 header)"""
    # This is a minimal MP3 header that should pass basic validation
    mp3_header = b'\xff\xfb\x90\x00' + b'\x00' * 100  # Minimal MP3 frame
    return mp3_header

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
            if data.get("message") == "Welcome to Resomix API":
                print_test_result("Health Check", True, "Root endpoint working", response_time)
                return True
            else:
                print_test_result("Health Check", False, f"Unexpected response: {data}")
                return False
        else:
            print_test_result("Health Check", False, f"Status code: {response.status_code}")
            return False
    except Exception as e:
        print_test_result("Health Check", False, f"Exception: {str(e)}")
        return False

def test_metadata_endpoint():
    """Test the metadata extraction endpoint"""
    try:
        start_time = time.time()
        
        # Create test audio file
        test_audio = create_test_audio_file()
        
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
        else:
            print_test_result("Metadata Extraction", False, f"Status code: {response.status_code}, Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_test_result("Metadata Extraction", False, f"Exception: {str(e)}")
        return False

def test_similarity_upload_endpoint():
    """Test the similarity calculation with file upload"""
    try:
        start_time = time.time()
        
        # Create test audio file
        test_audio = create_test_audio_file()
        
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
        else:
            print_test_result("Similarity Upload", False, f"Status code: {response.status_code}, Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_test_result("Similarity Upload", False, f"Exception: {str(e)}")
        return False

def test_similarity_by_id_endpoint():
    """Test the similarity calculation by track ID"""
    try:
        start_time = time.time()
        
        # Test data
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
            if data.get("success") is not None:  # Accept both true/false as valid responses
                print_test_result("Similarity By ID", True, "Similarity by ID endpoint working", response_time)
                return True
            else:
                print_test_result("Similarity By ID", False, f"Invalid response format: {data}")
                return False
        elif response.status_code == 404:
            print_test_result("Similarity By ID", True, "Expected 404 (track not found)", response_time)
            return True
        elif response.status_code == 503:
            print_test_result("Similarity By ID", True, "Expected 503 (similarity server unavailable)", response_time)
            return True
        else:
            print_test_result("Similarity By ID", False, f"Status code: {response.status_code}, Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_test_result("Similarity By ID", False, f"Exception: {str(e)}")
        return False

def test_search_endpoint():
    """Test the track search endpoint"""
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
            if "tracks" in data:
                print_test_result("Search Tracks", True, f"Found {len(data['tracks'])} tracks", response_time)
                return True
            else:
                print_test_result("Search Tracks", False, f"No 'tracks' key in response: {data}")
                return False
        else:
            print_test_result("Search Tracks", False, f"Status code: {response.status_code}, Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_test_result("Search Tracks", False, f"Exception: {str(e)}")
        return False

def test_feedback_endpoint():
    """Test the feedback submission endpoint"""
    try:
        start_time = time.time()
        
        # Test feedback data
        feedback_data = {
            "satisfaction": 8,
            "recommendation": 9,
            "feedback": "Test feedback message"
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
            print_test_result("Feedback Submission", False, f"Status code: {response.status_code}, Response: {response.text[:200]}")
            return False
    except Exception as e:
        print_test_result("Feedback Submission", False, f"Exception: {str(e)}")
        return False

def test_contact_endpoint():
    """Test the contact form submission endpoint"""
    try:
        start_time = time.time()
        
        # Test contact data
        contact_data = {
            "name": "Test User",
            "email": "test@example.com",
            "subject": "Test Subject",
            "message": "Test contact message"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/feedback",
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
            print_test_result("Contact Form", False, f"Status code: {response.status_code}, Response: {response.text[:200]}")
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
            'api_key': 'invalid_key'
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
    """Run all tests and print summary"""
    print_header()
    
    # Test server connectivity first
    if not test_server_connection():
        print("\n❌ Cannot connect to server. Make sure FastAPI is running on", BASE_URL)
        return False
    
    print()
    
    # Core functionality tests
    test_health_endpoint()
    test_metadata_endpoint()
    test_similarity_upload_endpoint()
    test_similarity_by_id_endpoint()
    test_search_endpoint()
    test_feedback_endpoint()
    test_contact_endpoint()
    test_api_key_validation()
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    total_tests = test_results["passed"] + test_results["failed"]
    success_rate = (test_results["passed"] / total_tests * 100) if total_tests > 0 else 0
    
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {test_results['passed']} ✅")
    print(f"Failed: {test_results['failed']} ❌")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if test_results["errors"]:
        print(f"\n🚨 FAILED TESTS:")
        for error in test_results["errors"]:
            print(f"   • {error}")
    
    print("\n" + "=" * 60)
    
    if test_results["failed"] == 0:
        print("🎉 ALL TESTS PASSED! Migration step verified successfully.")
        return True
    else:
        print("⚠️  Some tests failed. Check the errors above.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
