#!/usr/bin/env python3
"""
Search Routes Test
==================

Test file for search endpoints.

Usage: python -m pytest tests/unit/test_routes/test_search_routes.py -v
Or run directly: python tests/unit/test_routes/test_search_routes.py
"""

import requests
import time
from typing import Dict, Any

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

def test_search_tracks_valid():
    """Test GET /search_tracks/ with valid API key and query"""
    print("\n🧪 Testing Search Tracks - Valid Request")
    
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
        
        # Check status code
        if response.status_code != 200:
            print_test_result("Search Valid Status", False, f"Expected 200, got {response.status_code}")
            return False
        
        # Check response format
        try:
            data = response.json()
        except Exception as e:
            print_test_result("Search Valid JSON", False, f"Invalid JSON response: {e}")
            return False
        
        # Check response structure
        if not isinstance(data, dict):
            print_test_result("Search Valid Structure", False, "Response is not a dictionary")
            return False
        
        # Check success field
        if data.get("success") is not True:
            print_test_result("Search Valid Success", False, f"Expected success=True, got {data.get('success')}")
            return False
        
        # Check data field exists
        if "data" not in data:
            print_test_result("Search Valid Data Field", False, "Missing 'data' field in response")
            return False
        
        # Check tracks array
        tracks_data = data["data"]
        if "tracks" not in tracks_data:
            print_test_result("Search Valid Tracks Field", False, "Missing 'tracks' field in data")
            return False
        
        tracks = tracks_data["tracks"]
        if not isinstance(tracks, list):
            print_test_result("Search Valid Tracks Type", False, "Tracks should be a list")
            return False
        
        # Validate track structure if any tracks found
        if tracks:
            track = tracks[0]
            expected_track_keys = {"id", "artist", "duration", "filename"}
            missing_keys = expected_track_keys - track.keys()
            if missing_keys:
                print_test_result("Search Valid Track Structure", False, f"Missing track keys: {missing_keys}")
                return False
        
        print_test_result("Search Tracks Valid", True, f"Found {len(tracks)} tracks", response_time)
        return True
        
    except requests.exceptions.RequestException as e:
        print_test_result("Search Tracks Valid", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Search Tracks Valid", False, f"Unexpected error: {e}")
        return False

def test_search_tracks_invalid_api_key():
    """Test GET /search_tracks/ with invalid API key"""
    print("\n🧪 Testing Search Tracks - Invalid API Key")
    
    try:
        start_time = time.time()
        
        params = {
            'query': 'test',
            'api_key': 'invalid-api-key-12345'
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 403 for invalid API key
        if response.status_code == 403:
            print_test_result("Search Invalid API Key", True, "Correctly rejected invalid API key", response_time)
            return True
        else:
            print_test_result("Search Invalid API Key", False, f"Expected 403, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Search Invalid API Key", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Search Invalid API Key", False, f"Unexpected error: {e}")
        return False

def test_search_tracks_missing_api_key():
    """Test GET /search_tracks/ without API key"""
    print("\n🧪 Testing Search Tracks - Missing API Key")
    
    try:
        start_time = time.time()
        
        params = {
            'query': 'test'
            # No API key provided
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 403 for missing API key
        if response.status_code == 403:
            print_test_result("Search Missing API Key", True, "Correctly rejected missing API key", response_time)
            return True
        else:
            print_test_result("Search Missing API Key", False, f"Expected 403, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Search Missing API Key", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Search Missing API Key", False, f"Unexpected error: {e}")
        return False

def test_search_tracks_empty_query():
    """Test GET /search_tracks/ with empty query"""
    print("\n🧪 Testing Search Tracks - Empty Query")
    
    try:
        start_time = time.time()
        
        params = {
            'query': '',
            'api_key': API_KEY
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 200 but with empty results
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                tracks = data.get("data", {}).get("tracks", [])
                print_test_result("Search Empty Query", True, f"Handled empty query, returned {len(tracks)} tracks", response_time)
                return True
            else:
                print_test_result("Search Empty Query", False, f"Success=False: {data.get('error', 'Unknown error')}")
                return False
        else:
            print_test_result("Search Empty Query", False, f"Expected 200, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Search Empty Query", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Search Empty Query", False, f"Unexpected error: {e}")
        return False

def test_search_tracks_missing_query():
    """Test GET /search_tracks/ without query parameter"""
    print("\n🧪 Testing Search Tracks - Missing Query")
    
    try:
        start_time = time.time()
        
        params = {
            'api_key': API_KEY
            # No query parameter
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 422 for missing required parameter
        if response.status_code == 422:
            print_test_result("Search Missing Query", True, "Correctly rejected missing query parameter", response_time)
            return True
        else:
            print_test_result("Search Missing Query", False, f"Expected 422, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Search Missing Query", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Search Missing Query", False, f"Unexpected error: {e}")
        return False

def test_search_tracks_special_query():
    """Test GET /search_tracks/ with special characters"""
    print("\n🧪 Testing Search Tracks - Special Characters")
    
    try:
        start_time = time.time()
        
        params = {
            'query': 'test@#$%^&*()[]{}',
            'api_key': API_KEY
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should handle special characters gracefully
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                tracks = data.get("data", {}).get("tracks", [])
                print_test_result("Search Special Characters", True, f"Handled special characters, returned {len(tracks)} tracks", response_time)
                return True
            else:
                print_test_result("Search Special Characters", False, f"Success=False: {data.get('error', 'Unknown error')}")
                return False
        else:
            print_test_result("Search Special Characters", False, f"Expected 200, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Search Special Characters", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Search Special Characters", False, f"Unexpected error: {e}")
        return False

def run_search_tests():
    """Run all search-related tests"""
    print("=" * 60)
    print("🔍 SEARCH ROUTES TEST SUITE")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test server connectivity first
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        if response.status_code != 200:
            print("\n🚨 Server not available. Skipping search tests.")
            return
    except:
        print("\n🚨 Server not available. Skipping search tests.")
        return
    
    # Run search tests
    tests = [
        test_search_tracks_valid,
        test_search_tracks_invalid_api_key,
        test_search_tracks_missing_api_key,
        test_search_tracks_empty_query,
        test_search_tracks_missing_query,
        test_search_tracks_special_query,
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
    print("📊 SEARCH TESTS SUMMARY")
    print("=" * 60)
    total = passed + failed
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if failed == 0:
        print("\n🎉 All search tests passed!")
    else:
        print("\n⚠️  Some search tests failed.")

if __name__ == "__main__":
    run_search_tests()
