#!/usr/bin/env python3
"""
Search Routes Test Suite
=======================

Comprehensive testing for search functionality endpoints.
Tests track search with various parameters and validation scenarios.

Author: AI Assistant
Date: December 2024
"""

import requests
import json
import time
from datetime import datetime


# Configuration
BASE_URL = "http://localhost:8005"
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


def test_search_tracks_valid():
    """Test search tracks with valid parameters."""
    start_time = time.time()
    
    try:
        params = {
            "query": "test track"
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            headers=HEADERS,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                log_test_result(
                    "Search Tracks Valid",
                    True,
                    duration,
                    "Successfully performed search",
                    data
                )
                return True
        
        log_test_result(
            "Search Tracks Valid",
            False,
            duration,
            f"Expected 200 with success, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Search Tracks Valid", False, duration, f"Exception: {str(e)}")
        return False


def test_search_tracks_empty_query():
    """Test search tracks with empty query."""
    start_time = time.time()
    
    try:
        params = {
            "query": ""
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            headers=HEADERS,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should handle empty query gracefully
        if response.status_code in [200, 400, 422]:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else None
            log_test_result(
                "Search Empty Query",
                True,
                duration,
                f"Handled empty query appropriately ({response.status_code})",
                data
            )
            return True
        
        log_test_result(
            "Search Empty Query",
            False,
            duration,
            f"Unexpected status {response.status_code}: {response.text}"
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Search Empty Query", False, duration, f"Exception: {str(e)}")
        return False


def test_search_tracks_missing_query():
    """Test search tracks without query parameter."""
    start_time = time.time()
    
    try:
        params = {
            
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            headers=HEADERS,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return error for missing required query parameter
        if response.status_code == 422:
            data = response.json()
            log_test_result(
                "Search Missing Query",
                True,
                duration,
                "Correctly rejected missing query parameter",
                data
            )
            return True
        
        log_test_result(
            "Search Missing Query",
            False,
            duration,
            f"Expected 422, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Search Missing Query", False, duration, f"Exception: {str(e)}")
        return False


def test_search_tracks_with_pagination():
    """Test search tracks with pagination parameters."""
    start_time = time.time()
    
    try:
        params = {
            "query": "music",
            "page": 1,
            "limit": 10
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            headers=HEADERS,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                log_test_result(
                    "Search With Pagination",
                    True,
                    duration,
                    "Successfully handled pagination parameters",
                    data
                )
                return True
        
        log_test_result(
            "Search With Pagination",
            False,
            duration,
            f"Expected 200 with success, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Search With Pagination", False, duration, f"Exception: {str(e)}")
        return False


def test_search_tracks_invalid_pagination():
    """Test search tracks with invalid pagination parameters."""
    start_time = time.time()
    
    try:
        params = {
            "query": "music",
            "page": -1,
            "limit": 0
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            headers=HEADERS,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should handle invalid pagination gracefully
        if response.status_code in [200, 400, 422]:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else None
            log_test_result(
                "Search Invalid Pagination",
                True,
                duration,
                f"Handled invalid pagination appropriately ({response.status_code})",
                data
            )
            return True
        
        log_test_result(
            "Search Invalid Pagination",
            False,
            duration,
            f"Unexpected status {response.status_code}: {response.text}"
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Search Invalid Pagination", False, duration, f"Exception: {str(e)}")
        return False


def test_search_tracks_special_characters():
    """Test search tracks with special characters in query."""
    start_time = time.time()
    
    try:
        params = {
            "query": "test & special @#$%^&*() characters"
        }
        
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            headers=HEADERS,
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should handle special characters gracefully
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                log_test_result(
                    "Search Special Characters",
                    True,
                    duration,
                    "Successfully handled special characters",
                    data
                )
                return True
        
        log_test_result(
            "Search Special Characters",
            False,
            duration,
            f"Expected 200 with success, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Search Special Characters", False, duration, f"Exception: {str(e)}")
        return False


def test_search_tracks_unauthorized():
    """Test search tracks without API key."""
    start_time = time.time()
    
    try:
        params = {
            "query": "test"
            # No API key provided to test unauthorized access
        }
        
        # Request without API key
        response = requests.get(
            f"{BASE_URL}/search_tracks/",
            params=params,
            timeout=30
        )
        
        duration = time.time() - start_time
        
        # Should return 403 for unauthorized access (as per auth dependency)
        if response.status_code == 403:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else None
            log_test_result(
                "Search Unauthorized",
                True,
                duration,
                "Correctly rejected unauthorized request",
                data
            )
            return True
        
        log_test_result(
            "Search Unauthorized",
            False,
            duration,
            f"Expected 403, got {response.status_code}: {response.text}",
            response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        )
        return False
        
    except Exception as e:
        duration = time.time() - start_time
        log_test_result("Search Unauthorized", False, duration, f"Exception: {str(e)}")
        return False


def run_search_tests():
    """Run all search tests."""
    print("=" * 60)
    print("🔍 SEARCH ROUTES TEST SUITE")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    test_search_tracks_valid()
    test_search_tracks_empty_query()
    test_search_tracks_missing_query()
    test_search_tracks_with_pagination()
    test_search_tracks_invalid_pagination()
    test_search_tracks_special_characters()
    test_search_tracks_unauthorized()
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 SEARCH TESTS SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {test_results['total']}")
    print(f"Passed: {test_results['passed']} ✅")
    print(f"Failed: {test_results['failed']} ❌")
    print(f"Success Rate: {test_results['passed']/test_results['total']*100:.1f}%")
    
    if test_results['failed'] > 0:
        print("\n⚠️  Some search tests failed.")
    else:
        print("\n🎉 All search tests passed!")
    
    return test_results


if __name__ == "__main__":
    run_search_tests()
