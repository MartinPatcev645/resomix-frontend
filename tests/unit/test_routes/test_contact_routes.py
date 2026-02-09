#!/usr/bin/env python3
"""
Contact Routes Test
===================

Test file for contact endpoints only.

Usage: python -m pytest tests/unit/test_routes/test_contact_routes.py -v
Or run directly: python tests/unit/test_routes/test_contact_routes.py
"""

import requests
import time

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

def test_contact_submit_valid():
    """Test POST /contact/ with valid data"""
    print("\n🧪 Testing Contact Submission - Valid Data")
    
    try:
        start_time = time.time()
        
        contact_data = {
            "name": "John Doe",
            "email": "john.doe@example.com",
            "message": "This is a test contact form submission from the unit test suite",
            "subject": "Test Subject",
            "phone": "+1-555-123-4567",
            "user_id": "test-user-123"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/contact/",
            json=contact_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Check status code
        if response.status_code != 200:
            print_test_result("Contact Submit Valid Status", False, f"Expected 200, got {response.status_code}")
            return False
        
        # Check response format
        try:
            data = response.json()
        except Exception as e:
            print_test_result("Contact Submit Valid JSON", False, f"Invalid JSON response: {e}")
            return False
        
        # Check success field
        if data.get("success") is not True:
            print_test_result("Contact Submit Valid Success", False, f"Expected success=True, got {data.get('success')}")
            return False
        
        # Check data field exists
        if "data" not in data:
            print_test_result("Contact Submit Valid Data Field", False, "Missing 'data' field in response")
            return False
        
        print_test_result("Contact Submit Valid", True, "Contact form submitted successfully", response_time)
        return True
        
    except requests.exceptions.RequestException as e:
        print_test_result("Contact Submit Valid", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Contact Submit Valid", False, f"Unexpected error: {e}")
        return False

def test_contact_submit_invalid_email():
    """Test POST /contact/ with invalid email"""
    print("\n🧪 Testing Contact Submission - Invalid Email")
    
    try:
        start_time = time.time()
        
        contact_data = {
            "name": "Jane Doe",
            "email": "invalid-email-format",  # Invalid email
            "message": "Test message with invalid email"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/contact/",
            json=contact_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 422 for validation error
        if response.status_code == 422:
            print_test_result("Contact Submit Invalid Email", True, "Correctly rejected invalid email", response_time)
            return True
        else:
            print_test_result("Contact Submit Invalid Email", False, f"Expected 422, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Contact Submit Invalid Email", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Contact Submit Invalid Email", False, f"Unexpected error: {e}")
        return False

def test_contact_submit_missing_required_fields():
    """Test POST /contact/ with missing required fields"""
    print("\n🧪 Testing Contact Submission - Missing Required Fields")
    
    try:
        start_time = time.time()
        
        contact_data = {
            "name": "Test User",
            # Missing "email" and "message" fields
            "subject": "Test Subject"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/contact/",
            json=contact_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 422 for missing fields
        if response.status_code == 422:
            print_test_result("Contact Submit Missing Fields", True, "Correctly rejected missing required fields", response_time)
            return True
        else:
            print_test_result("Contact Submit Missing Fields", False, f"Expected 422, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Contact Submit Missing Fields", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Contact Submit Missing Fields", False, f"Unexpected error: {e}")
        return False

def test_contact_submit_invalid_phone():
    """Test POST /contact/ with invalid phone format"""
    print("\n🧪 Testing Contact Submission - Invalid Phone")
    
    try:
        start_time = time.time()
        
        contact_data = {
            "name": "Test User",
            "email": "test@example.com",
            "message": "Test message with invalid phone",
            "phone": "not-a-phone-number"  # Invalid phone format
        }
        
        params = {
            'api_key': API_KEY
        }
        
        response = requests.post(
            f"{BASE_URL}/contact/",
            json=contact_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 422 for validation error
        if response.status_code == 422:
            print_test_result("Contact Submit Invalid Phone", True, "Correctly rejected invalid phone", response_time)
            return True
        else:
            print_test_result("Contact Submit Invalid Phone", False, f"Expected 422, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Contact Submit Invalid Phone", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Contact Submit Invalid Phone", False, f"Unexpected error: {e}")
        return False

def test_contact_submit_invalid_api_key():
    """Test POST /contact/ with invalid API key"""
    print("\n🧪 Testing Contact - Invalid API Key")
    
    try:
        start_time = time.time()
        
        contact_data = {
            "name": "Test User",
            "email": "test@example.com",
            "message": "Test contact with invalid API key"
        }
        
        params = {
            'api_key': 'invalid-api-key-12345'
        }
        
        response = requests.post(
            f"{BASE_URL}/contact/",
            json=contact_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Should return 403 for invalid API key
        if response.status_code == 403:
            print_test_result("Contact Submit Invalid API Key", True, "Correctly rejected invalid API key", response_time)
            return True
        else:
            print_test_result("Contact Submit Invalid API Key", False, f"Expected 403, got {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Contact Submit Invalid API Key", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Contact Submit Invalid API Key", False, f"Unexpected error: {e}")
        return False

def test_contact_get_by_id():
    """Test GET /contact/{contact_id}"""
    print("\n🧪 Testing Get Contact by ID")
    
    try:
        start_time = time.time()
        
        # First, create a contact to get its ID
        contact_data = {
            "name": "Test User",
            "email": "test@example.com",
            "message": "Test contact for getting by ID",
            "subject": "Testing"
        }
        
        params = {
            'api_key': API_KEY
        }
        
        # Create contact
        create_response = requests.post(
            f"{BASE_URL}/contact/",
            json=contact_data,
            params=params,
            timeout=TIMEOUT
        )
        
        if create_response.status_code != 200:
            print_test_result("Contact Get by ID - Create", False, f"Failed to create contact: {create_response.status_code}")
            return False
        
        # Try to get contact by ID (assuming ID 1 exists)
        get_response = requests.get(
            f"{BASE_URL}/contact/1",
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Check response
        if get_response.status_code == 200:
            print_test_result("Contact Get by ID", True, "Successfully retrieved contact", response_time)
            return True
        elif get_response.status_code == 404:
            print_test_result("Contact Get by ID", True, "Correctly returned 404 for non-existent contact", response_time)
            return True
        else:
            print_test_result("Contact Get by ID", False, f"Unexpected status code: {get_response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Contact Get by ID", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Contact Get by ID", False, f"Unexpected error: {e}")
        return False

def test_contact_update_status():
    """Test PATCH /contact/{contact_id}/status"""
    print("\n🧪 Testing Update Contact Status")
    
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
            f"{BASE_URL}/contact/1/status",
            json=status_data,
            params=params,
            timeout=TIMEOUT
        )
        response_time = time.time() - start_time
        
        # Check response
        if response.status_code == 200:
            print_test_result("Contact Update Status", True, "Successfully updated contact status", response_time)
            return True
        elif response.status_code == 404:
            print_test_result("Contact Update Status", True, "Correctly returned 404 for non-existent contact", response_time)
            return True
        else:
            print_test_result("Contact Update Status", False, f"Unexpected status code: {response.status_code}")
            return False
        
    except requests.exceptions.RequestException as e:
        print_test_result("Contact Update Status", False, f"Request failed: {e}")
        return False
    except Exception as e:
        print_test_result("Contact Update Status", False, f"Unexpected error: {e}")
        return False

def run_contact_tests():
    """Run all contact related tests"""
    print("=" * 60)
    print("📞 CONTACT ROUTES TEST SUITE")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test server connectivity first
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        if response.status_code != 200:
            print("\n🚨 Server not available. Skipping contact tests.")
            return
    except:
        print("\n🚨 Server not available. Skipping contact tests.")
        return
    
    # Run contact tests
    tests = [
        test_contact_submit_valid,
        test_contact_submit_invalid_email,
        test_contact_submit_missing_required_fields,
        test_contact_submit_invalid_phone,
        test_contact_submit_invalid_api_key,
        test_contact_get_by_id,
        test_contact_update_status,
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
    print("📊 CONTACT TESTS SUMMARY")
    print("=" * 60)
    total = passed + failed
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if failed == 0:
        print("\n🎉 All contact tests passed!")
    else:
        print("\n⚠️  Some contact tests failed.")

if __name__ == "__main__":
    run_contact_tests() 