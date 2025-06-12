#!/usr/bin/env python3
"""
Health Routes Test
==================

Test file for health and status endpoints.

Usage: python -m pytest tests/unit/test_routes/test_health_routes.py -v
Or run directly: python tests/unit/test_routes/test_health_routes.py
"""

import requests
import time
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8005"
TIMEOUT = 30

def print_test_result(test_name: str, success: bool, message: str = "", response_time: float = 0):
    """Print test result with formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    time_str = f"({response_time:.2f}s)" if response_time > 0 else ""
    print(f"{status} {test_name} {time_str}")
    if message:
        print(f"     {message}")

def test_root_endpoint():
    """Test GET / - Root health check endpoint"""
    print("\n🧪 Testing Root Endpoint (GET /)")
    
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/", timeout=TIMEOUT)
        response_time = time.time() - start_time
        
        # Check status code
        if response.status_code != 200:
            print_test_result("Root Endpoint Status", False, f"Expected 200, got {response.status_code}")
            return False
        
        # Check response format
        try:
            data = response.json()
        except Exception as e:
            print_test_result("Root Endpoint JSON", False, f"Invalid JSON response: {e}")
            return False
        
        # Check required fields
        expected_keys = {"name", "version", "status", "docs_url"}
        missing_keys = expected_keys - data.keys()
        if missing_keys:
            print_test_result("Root Endpoint Fields", False, f"Missing keys: {missing_keys}")
            return False
        
        # Check status value
        if data.get("status") != "running":
            print_test_result("Root Endpoint Status Value", False, f"Expected 'running', got '{data.get('status')}'")
            return False
        
        print_test_result("Root Endpoint", True, f"All checks passed - {data}", response_time)
        return True
        
    except requests.exceptions.RequestException as e:
        print_test_result("Root Endpoint", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Root Endpoint", False, f"Unexpected error: {e}")
        return False

def test_health_endpoint():
    """Test GET /health - Dedicated health check endpoint"""
    print("\n🧪 Testing Health Endpoint (GET /health)")
    
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/health", timeout=TIMEOUT)
        response_time = time.time() - start_time
        
        # Check status code
        if response.status_code != 200:
            print_test_result("Health Endpoint Status", False, f"Expected 200, got {response.status_code}")
            return False
        
        # Check response format
        try:
            data = response.json()
        except Exception as e:
            print_test_result("Health Endpoint JSON", False, f"Invalid JSON response: {e}")
            return False
        
        # Check required fields
        expected_keys = {"status", "service"}
        missing_keys = expected_keys - data.keys()
        if missing_keys:
            print_test_result("Health Endpoint Fields", False, f"Missing keys: {missing_keys}")
            return False
        
        # Check status value
        if data.get("status") != "healthy":
            print_test_result("Health Endpoint Status Value", False, f"Expected 'healthy', got '{data.get('status')}'")
            return False
        
        # Check service value
        if data.get("service") != "Resomix API":
            print_test_result("Health Endpoint Service Value", False, f"Expected 'Resomix API', got '{data.get('service')}'")
            return False
        
        print_test_result("Health Endpoint", True, f"All checks passed - {data}", response_time)
        return True
        
    except requests.exceptions.RequestException as e:
        print_test_result("Health Endpoint", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Health Endpoint", False, f"Unexpected error: {e}")
        return False

def test_server_connectivity():
    """Test basic server connectivity"""
    print("\n🧪 Testing Server Connectivity")
    
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            print_test_result("Server Connectivity", True, "FastAPI docs accessible", response_time)
            return True
        else:
            print_test_result("Server Connectivity", False, f"Docs returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_test_result("Server Connectivity", False, f"Cannot connect to server: {e}")
        return False

def run_health_tests():
    """Run all health-related tests"""
    print("=" * 60)
    print("🏥 HEALTH ROUTES TEST SUITE")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test server connectivity first
    if not test_server_connectivity():
        print("\n🚨 Server not available. Skipping health tests.")
        return
    
    # Run health tests
    tests = [
        test_root_endpoint,
        test_health_endpoint,
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
    print("📊 HEALTH TESTS SUMMARY")
    print("=" * 60)
    total = passed + failed
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if failed == 0:
        print("\n🎉 All health tests passed!")
    else:
        print("\n⚠️  Some health tests failed.")

if __name__ == "__main__":
    run_health_tests()
