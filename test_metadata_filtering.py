#!/usr/bin/env python3
"""
Test script for metadata filtering functionality.
Tests the new meta stopper strings and meta stopper regex features.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.services.metadata_service import MetadataService
from app.core.config import settings

def test_meta_filtering():
    """Test the metadata filtering functionality."""
    print("🧪 Testing Metadata Filtering Functionality")
    print("=" * 50)
    
    # Test cases for various metadata fields
    test_cases = [
        # Title field tests (gets both title and meta filtering)
        {
            "field": "Title",
            "input": "Amazing Track",
            "expected": "Amazing Track",
            "description": "Normal title - should pass through"
        },
        {
            "field": "Title", 
            "input": "Great Song (Original Mix)",
            "expected": "Great Song",
            "description": "Title with (Original Mix) - should be removed"
        },
        {
            "field": "Title",
            "input": "Cool Track https://example.com",
            "expected": "Cool Track",
            "description": "Title with URL at end - should be truncated"
        },
        {
            "field": "Title",
            "input": "https://example.com/track.mp3",
            "expected": "",
            "description": "Title that's entirely a URL - should be removed"
        },
        {
            "field": "Title",
            "input": "www.example.com",
            "expected": "",
            "description": "Title that's entirely a domain - should be removed"
        },
        {
            "field": "Title",
            "input": "example.com",
            "expected": "",
            "description": "Title that's a simple domain - should be removed"
        },
        {
            "field": "Title",
            "input": "Track Name www.site.com more text",
            "expected": "Track Name",
            "description": "Title with www domain in middle - should truncate"
        },
        
        # Artist field tests (gets meta filtering only)
        {
            "field": "Artist",
            "input": "Cool Artist",
            "expected": "Cool Artist", 
            "description": "Normal artist - should pass through"
        },
        {
            "field": "Artist",
            "input": "Artist Name (Original Mix)",
            "expected": "Artist Name (Original Mix)",
            "description": "Artist with (Original Mix) - should NOT be removed (title-specific filter)"
        },
        {
            "field": "Artist",
            "input": "https://soundcloud.com/artist",
            "expected": "",
            "description": "Artist that's entirely a URL - should be removed"
        },
        {
            "field": "Artist",
            "input": "Artist Name https://link.com",
            "expected": "Artist Name",
            "description": "Artist with URL at end - should be truncated"
        },
        {
            "field": "Artist",
            "input": "beatport.com",
            "expected": "",
            "description": "Artist that's a domain - should be removed"
        },
        
        # Album field tests
        {
            "field": "Album",
            "input": "Great Album",
            "expected": "Great Album",
            "description": "Normal album - should pass through"
        },
        {
            "field": "Album",
            "input": "Album Name www.label.com",
            "expected": "Album Name",
            "description": "Album with domain - should be truncated"
        },
        {
            "field": "Album",
            "input": "electrobuzz.com",
            "expected": "",
            "description": "Album that's a domain - should be removed"
        },
        
        # Genre field tests
        {
            "field": "Genre",
            "input": "House",
            "expected": "House",
            "description": "Normal genre - should pass through"
        },
        {
            "field": "Genre",
            "input": "Techno _www.site.com",
            "expected": "Techno",
            "description": "Genre with _www domain - should be truncated"
        },
        {
            "field": "Genre",
            "input": "alpha.co",
            "expected": "",
            "description": "Genre that's a short domain - should be removed"
        },
        
        # Label field tests
        {
            "field": "Label", 
            "input": "Cool Records",
            "expected": "Cool Records",
            "description": "Normal label - should pass through"
        },
        {
            "field": "Label",
            "input": "Label Name https://www.label.com/releases",
            "expected": "Label Name",
            "description": "Label with full URL - should be truncated"
        },
        {
            "field": "Label",
            "input": "www.recordlabel.net",
            "expected": "",
            "description": "Label that's entirely a domain - should be removed"
        },
        
        # Edge cases
        {
            "field": "Artist",
            "input": "  Artist with spaces  ",
            "expected": "Artist with spaces",
            "description": "Field with extra whitespace - should be trimmed"
        },
        {
            "field": "Title",
            "input": "",
            "expected": "",
            "description": "Empty field - should remain empty"
        },
        {
            "field": "Genre",
            "input": "House Music https: incomplete",
            "expected": "House Music",
            "description": "Field with partial stopper string - should be truncated"
        }
    ]
    
    # Run tests
    passed = 0
    failed = 0
    
    for i, test_case in enumerate(test_cases, 1):
        field = test_case["field"]
        input_value = test_case["input"]
        expected = test_case["expected"]
        description = test_case["description"]
        
        # Apply appropriate filtering based on field type
        if field == "Title":
            result = MetadataService._filter_title_field(input_value)
        else:
            result = MetadataService._filter_metadata_field(input_value, field)
        
        # Check result
        if result == expected:
            status = "✅ PASS"
            passed += 1
        else:
            status = "❌ FAIL"
            failed += 1
        
        print(f"Test {i:2d}: {status}")
        print(f"  Field: {field}")
        print(f"  Input: '{input_value}'")
        print(f"  Expected: '{expected}'")
        print(f"  Got: '{result}'")
        print(f"  Description: {description}")
        print()
    
    # Summary
    print("=" * 50)
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    print(f"Success rate: {passed/(passed+failed)*100:.1f}%")
    
    if failed == 0:
        print("🎉 All tests passed!")
    else:
        print("⚠️  Some tests failed - check implementation")
    
    return failed == 0

def test_configuration():
    """Test that configuration values are properly loaded."""
    print("\n🔧 Testing Configuration")
    print("=" * 30)
    
    print(f"Meta stopper strings: {settings.meta_stopper_strings}")
    print(f"Meta stopper regex: {settings.meta_stopper_regex}")
    print(f"Title stopper strings: {settings.title_stopper_strings}")
    print(f"Title removal strings: {settings.title_removal_strings}")

def test_regex_patterns():
    """Test the regex pattern against various URL/domain formats."""
    print("\n🔍 Testing Regex Patterns")
    print("=" * 30)
    
    import re
    
    test_patterns = [
        ("https://example.com", True, "HTTPS URL"),
        ("http://example.com", True, "HTTP URL"),
        ("www.example.com", True, "WWW domain"),
        ("example.com", True, "Simple domain"),
        ("subdomain.example.com", True, "Subdomain"),
        ("example.co.uk", True, "Multi-part TLD"),
        ("alpha.co", True, "Short domain"),
        ("electrobuzz.com", True, "Real domain example"),
        ("beatport.com/track/123", True, "Domain with path"),
        ("https://soundcloud.com/artist/track", True, "Full URL with path"),
        ("Normal Text", False, "Normal text"),
        ("Artist Name", False, "Normal artist name"),
        ("House Music", False, "Normal genre"),
        ("Cool Records", False, "Normal label"),
        ("Track (Original Mix)", False, "Track with remix info"),
        ("", False, "Empty string"),
    ]
    
    for pattern, should_match, description in test_patterns:
        try:
            matches = bool(re.match(settings.meta_stopper_regex, pattern, re.IGNORECASE))
            status = "✅" if matches == should_match else "❌"
            print(f"{status} '{pattern}' -> {matches} (expected {should_match}) - {description}")
        except re.error as e:
            print(f"❌ Regex error for '{pattern}': {e}")

if __name__ == "__main__":
    print("🚀 Starting Metadata Filtering Tests\n")
    
    # Test configuration loading
    test_configuration()
    
    # Test regex patterns
    test_regex_patterns()
    
    # Test filtering functionality
    success = test_meta_filtering()
    
    print("\n" + "=" * 60)
    if success:
        print("🎊 All metadata filtering tests completed successfully!")
        sys.exit(0)
    else:
        print("💥 Some tests failed. Please review the implementation.")
        sys.exit(1) 