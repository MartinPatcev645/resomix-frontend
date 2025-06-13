#!/usr/bin/env python3
"""
Feedback Routes Test
====================

Test file for feedback endpoints only.

Usage: python -m pytest tests/unit/test_routes/test_feedback_routes.py -v
Or run directly: python tests/unit/test_routes/test_feedback_routes.py
"""

import requests
import time
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8005"
API_KEY = "bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"
TIMEOUT = 30

def print_test_result(test_name: str, success: bool, message: str = "", response_time: float = 0):
    """Print test result with formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    time_str = f"({response_time:.2f}s)" if response_time > 0 else ""
    print(f"{status} {test_name} {time_str}")
    if message:
        print(f"     {message}")

def test_feedback_submit_valid():
    """Test POST /feedback/ with valid data"""
    print("\n🧪 Testing Feedback Submission - Valid Data")
    
    try:
        start_time = time.time()
        
        feedback_data = {
            "satisfaction": 8,
            "recommendation": 9,
            "feedback": "This is a test feedback from the unit test suite",
            "category": "performance",
            "user_id": "test-user-123"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/feedback/",
            json=feedback_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Check status code
        if response.status_code != 200:
            print_test_result("Feedback Submit Valid Status", False, f"Expected 200, got {response.status_code}")
            return False
        
        # Check response format
        try:
            data = response.json()
        except Exception as e:
            print_test_result("Feedback Submit Valid JSON", False, f"Invalid JSON response: {e}")
            return False
        
        # Check success field
        if data.get("success") is not True:
            print_test_result("Feedback Submit Valid Success", False, f"Expected success=True, got {data.get('success')}")
            return False
        
        # Check data field exists
        if "data" not in data:
            print_test_result("Feedback Submit Valid Data Field", False, "Missing 'data' field in response")
            return False
        
        print_test_result("Feedback Submit Valid", True, f"Feedback submitted successfully", response_time)
        return True
        
    except requests.exceptions.RequestException as e:
        print_test_result("Feedback Submit Valid", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Feedback Submit Valid", False, f"Unexpected error: {e}")
        return False

def test_feedback_submit_invalid_ratings():
    """Test POST /feedback/ with invalid rating values"""
    print("\n🧪 Testing Feedback Submission - Invalid Ratings")
    
    try:
        start_time = time.time()
        
        feedback_data = {
            "satisfaction": 15,  # Invalid: must be 1-10
            "recommendation": 0,  # Invalid: must be 1-10
            "feedback": "Test feedback with invalid ratings"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/feedback/",
            json=feedback_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 422 for validation error
        if response.status_code == 422:
            print_test_result("Feedback Submit Invalid Ratings", True, "Correctly rejected invalid ratings", response_time)
            return True
        else:
            print_test_result("Feedback Submit Invalid Ratings", False, f"Expected 422, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Feedback Submit Invalid Ratings", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Feedback Submit Invalid Ratings", False, f"Unexpected error: {e}")
        return False

def test_feedback_submit_missing_required_fields():
    """Test POST /feedback/ with missing required fields"""
    print("\n🧪 Testing Feedback Submission - Missing Required Fields")
    
    try:
        start_time = time.time()
        
        feedback_data = {
            "satisfaction": 8,
            # Missing "recommendation" field
            "feedback": "Test feedback missing recommendation"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/feedback/",
            json=feedback_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 422 for missing field
        if response.status_code == 422:
            print_test_result("Feedback Submit Missing Fields", True, "Correctly rejected missing required fields", response_time)
            return True
        else:
            print_test_result("Feedback Submit Missing Fields", False, f"Expected 422, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Feedback Submit Missing Fields", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Feedback Submit Missing Fields", False, f"Unexpected error: {e}")
        return False

def test_feedback_submit_invalid_api_key():
    """Test POST /feedback/ with invalid API key"""
    print("\n🧪 Testing Feedback - Invalid API Key")
    
    try:
        start_time = time.time()
        
        feedback_data = {
            "satisfaction": 8,
            "recommendation": 9,
            "feedback": "Test feedback with invalid API key"
        }
        
        params = {
            'api_key': 'invalid-api-key-12345'
        }
        
        response = requests.post(
            f"{BASE_URL}/feedback/",
            json=feedback_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 403 for invalid API key
        if response.status_code == 403:
            print_test_result("Feedback Submit Invalid API Key", True, "Correctly rejected invalid API key", response_time)
            return True
        else:
            print_test_result("Feedback Submit Invalid API Key", False, f"Expected 403, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Feedback Submit Invalid API Key", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Feedback Submit Invalid API Key", False, f"Unexpected error: {e}")
        return False

def test_feedback_get_by_id():
    """Test GET /feedback/{feedback_id}"""
    print("\n🧪 Testing Get Feedback by ID")
    
    try:
        start_time = time.time()
        
        # First, create a feedback to get its ID
        feedback_data = {
            "satisfaction": 7,
            "recommendation": 8,
            "feedback": "Test feedback for getting by ID",
            "category": "testing"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        # Create feedback
        create_response = requests.post(
            f"{BASE_URL}/feedback/",
            json=feedback_data,
            params=params,
            timeout=TIMEOUT
        )
        
        if create_response.status_code != 200:
            print_test_result("Feedback Get by ID - Create", False, f"Failed to create feedback: {create_response.status_code}")
            return False
        
        # Try to get feedback by ID (assuming ID 1 exists)
        get_response = requests.get(
            f"{BASE_URL}/feedback/1",
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Check response
        if get_response.status_code == 200:
            print_test_result("Feedback Get by ID", True, "Successfully retrieved feedback", response_time)
            return True
        elif get_response.status_code == 404:
            print_test_result("Feedback Get by ID", True, "Correctly returned 404 for non-existent feedback", response_time)
            return True
        else:
            print_test_result("Feedback Get by ID", False, f"Unexpected status code: {get_response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Feedback Get by ID", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Feedback Get by ID", False, f"Unexpected error: {e}")
        return False

def test_feedback_update_status():
    """Test PATCH /feedback/{feedback_id}/status"""
    print("\n🧪 Testing Update Feedback Status")
    
    try:
        start_time = time.time()
        
        status_data = {
            "status": "resolved"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        # Try to update status (assuming ID 1 exists)
        response = requests.patch(
            f"{BASE_URL}/feedback/1/status",
            json=status_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Check response
        if response.status_code == 200:
            print_test_result("Feedback Update Status", True, "Successfully updated feedback status", response_time)
            return True
        elif response.status_code == 404:
            print_test_result("Feedback Update Status", True, "Correctly returned 404 for non-existent feedback", response_time)
            return True
        else:
            print_test_result("Feedback Update Status", False, f"Unexpected status code: {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Feedback Update Status", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Feedback Update Status", False, f"Unexpected error: {e}")
        return False

def run_feedback_tests():
    """Run all feedback related tests"""
    print("=" * 60)
    print("💬 FEEDBACK ROUTES TEST SUITE")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test server connectivity first
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        if response.status_code != 200:
            print("\n🚨 Server not available. Skipping feedback tests.")
            return
    except:
        print("\n🚨 Server not available. Skipping feedback tests.")
        return
    
    # Run feedback tests
    tests = [
        test_feedback_submit_valid,
        test_feedback_submit_invalid_ratings,
        test_feedback_submit_missing_required_fields,
        test_feedback_submit_invalid_api_key,
        test_feedback_get_by_id,
        test_feedback_update_status,
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
    print("📊 FEEDBACK TESTS SUMMARY")
    print("=" * 60)
    total = passed + failed
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if failed == 0:
        print("\n🎉 All feedback tests passed!")
    else:
        print("\n⚠️  Some feedback tests failed.")

if __name__ == "__main__":
    run_feedback_tests() 