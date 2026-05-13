#!/usr/bin/env python3
"""
Test script to verify antivirus service functionality
"""

import os
import sys
import pytest
from app.services.antivirus_service import AntivirusService

# EICAR test virus string
EICAR_TEST = b'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

# Clean file content (just some text)
CLEAN_FILE = b'This is a clean test file with no malicious content.'


def test_antivirus_service():
    """Test the antivirus service with clean and malicious files."""
    
    print("=" * 70)
    print("ANTIVIRUS SERVICE TEST")
    print("=" * 70)
    
    av_service = AntivirusService()
    
    # Check availability
    print("\n1. Checking ClamAV availability...")
    print("-" * 70)
    
    try:
        clamd_available = av_service.is_clamd_available()
    except Exception as e:
        print(f"ClamAV not available: {e}")
        pytest.skip("ClamAV daemon not running or reachable")
    print(f"   clamd daemon:      {'✓ Available' if clamd_available else '✗ Not available'}")
    
    clamscan_available = av_service.is_clamscan_available()
    print(f"   clamscan command:  {'✓ Available' if clamscan_available else '✗ Not available'}")
    
    if not clamd_available and not clamscan_available:
        print("\n   ⚠️  WARNING: No antivirus method available!")
        print("   Please ensure ClamAV is installed and running.")
        return
    
    # Test with EICAR test virus
    print("\n2. Testing with EICAR test virus (should be detected)...")
    print("-" * 70)
    
    result = av_service.scan_bytes(EICAR_TEST, "eicar_test.txt")
    print(f"   Success:    {result.get('success')}")
    print(f"   Clean:      {result.get('clean')}")
    print(f"   Threat:     {result.get('threat', 'N/A')}")
    print(f"   Method:     {result.get('method', 'N/A')}")
    print(f"   Error:      {result.get('error', 'N/A')}")
    
    if result.get('success') and not result.get('clean'):
        print(f"   ✓ PASS: Malware detected correctly: {result.get('threat')}")
    else:
        print("   ✗ FAIL: Expected malware to be detected")
    
    # Test with clean file
    print("\n3. Testing with clean file (should pass)...")
    print("-" * 70)
    
    result = av_service.scan_bytes(CLEAN_FILE, "clean_test.txt")
    print(f"   Success:    {result.get('success')}")
    print(f"   Clean:      {result.get('clean')}")
    print(f"   Threat:     {result.get('threat', 'N/A')}")
    print(f"   Method:     {result.get('method', 'N/A')}")
    print(f"   Error:      {result.get('error', 'N/A')}")
    
    if result.get('success') and result.get('clean'):
        print("   ✓ PASS: Clean file passed scan")
    else:
        print("   ✗ FAIL: Expected clean file to pass")
    
    # Test with empty file
    print("\n4. Testing with empty file (should fail gracefully)...")
    print("-" * 70)
    
    result = av_service.scan_bytes(b'', "empty.txt")
    print(f"   Success:    {result.get('success')}")
    print(f"   Clean:      {result.get('clean')}")
    print(f"   Error:      {result.get('error', 'N/A')}")
    
    if not result.get('success') and result.get('error'):
        print("   ✓ PASS: Empty file handled correctly")
    else:
        print("   ✗ FAIL: Expected error for empty file")
    
    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    test_antivirus_service()

