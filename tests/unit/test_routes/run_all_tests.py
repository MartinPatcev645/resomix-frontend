#!/usr/bin/env python3
"""
Route Tests Master Runner
==========================

Master test runner for all route test suites.

Usage: 
  python tests/unit/test_routes/run_all_tests.py              # Run all tests
  python tests/unit/test_routes/run_all_tests.py health       # Run specific test suite
  python tests/unit/test_routes/run_all_tests.py --help       # Show help
"""

import sys
import time
import subprocess
import argparse
from pathlib import Path

# Test suite configurations
TEST_SUITES = {
    "health": {
        "module": "test_health_routes",
        "function": "run_health_tests",
        "description": "Health and status endpoints",
        "emoji": "🏥"
    },
    "search": {
        "module": "test_search_routes", 
        "function": "run_search_tests",
        "description": "Search functionality",
        "emoji": "🔍"
    },
    "feedback": {
        "module": "test_feedback_routes",
        "function": "run_feedback_tests", 
        "description": "Feedback submission system",
        "emoji": "💬"
    },
    "contact": {
        "module": "test_contact_routes",
        "function": "run_contact_tests",
        "description": "Contact form system",
        "emoji": "📞"
    },
    "metadata": {
        "module": "test_metadata_routes",
        "function": "run_metadata_tests",
        "description": "Metadata extraction",
        "emoji": "🎵"
    },
    "similarity": {
        "module": "test_similarity_routes",
        "function": "run_similarity_tests",
        "description": "Similarity calculation",
        "emoji": "🎛️"
    }
}

def print_header():
    """Print the main header"""
    print("=" * 80)
    print("🧪 RESOMIX API ROUTE TESTS - MASTER RUNNER")
    print("=" * 80)
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print()

def print_suite_list():
    """Print available test suites"""
    print("📋 Available Test Suites:")
    print("-" * 40)
    for suite_name, config in TEST_SUITES.items():
        print(f"{config['emoji']} {suite_name:<12} - {config['description']}")
    print()

def run_test_suite(suite_name: str) -> tuple:
    """
    Run a specific test suite
    
    Returns:
        tuple: (success: bool, output: str)
    """
    if suite_name not in TEST_SUITES:
        return False, f"Unknown test suite: {suite_name}"
    
    suite_config = TEST_SUITES[suite_name]
    
    try:
        # Import and run the test suite
        module_name = f"tests.unit.test_routes.{suite_config['module']}"
        
        # Try to import the module
        try:
            import importlib
            module = importlib.import_module(module_name)
        except ImportError:
            # Fallback: run as subprocess
            script_path = Path(__file__).parent / f"{suite_config['module']}.py"
            if not script_path.exists():
                return False, f"Test file not found: {script_path}"
            
            result = subprocess.run([sys.executable, str(script_path)], 
                                  capture_output=True, text=True, timeout=120)
            
            if result.returncode == 0:
                return True, result.stdout
            else:
                return False, f"Exit code {result.returncode}: {result.stderr}"
        
        # Run the test function
        test_function = getattr(module, suite_config['function'])
        test_function()
        return True, "Test suite completed successfully"
        
    except Exception as e:
        return False, f"Error running test suite: {e}"

def run_all_tests():
    """Run all test suites"""
    print_header()
    print_suite_list()
    
    results = {}
    total_start_time = time.time()
    
    print("🚀 Running All Test Suites:")
    print("=" * 80)
    
    for suite_name, config in TEST_SUITES.items():
        print(f"\n{config['emoji']} Starting {suite_name.upper()} tests...")
        print("-" * 60)
        
        start_time = time.time()
        success, output = run_test_suite(suite_name)
        end_time = time.time()
        
        results[suite_name] = {
            "success": success,
            "output": output,
            "duration": end_time - start_time
        }
        
        status = "✅ COMPLETED" if success else "❌ FAILED"
        print(f"{status} {suite_name} tests ({end_time - start_time:.1f}s)")
        
        # Print any error output
        if not success and output:
            print(f"Error: {output}")
    
    total_duration = time.time() - total_start_time
    
    # Print final summary
    print("\n" + "=" * 80)
    print("📊 FINAL TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed_suites = sum(1 for r in results.values() if r["success"])
    failed_suites = len(results) - passed_suites
    
    print(f"Total Test Suites: {len(results)}")
    print(f"Passed: {passed_suites} ✅")
    print(f"Failed: {failed_suites} ❌")
    print(f"Total Duration: {total_duration:.1f}s")
    print()
    
    # Detailed results
    for suite_name, result in results.items():
        config = TEST_SUITES[suite_name]
        status = "✅" if result["success"] else "❌"
        print(f"{status} {config['emoji']} {suite_name:<12} ({result['duration']:.1f}s)")
    
    print()
    if failed_suites == 0:
        print("🎉 All test suites passed successfully!")
    else:
        print("⚠️  Some test suites failed. Check individual outputs above.")
    
    return failed_suites == 0

def run_single_test(suite_name: str):
    """Run a single test suite"""
    if suite_name not in TEST_SUITES:
        print(f"❌ Unknown test suite: {suite_name}")
        print("Available suites:", ", ".join(TEST_SUITES.keys()))
        return False
    
    config = TEST_SUITES[suite_name]
    
    print("=" * 60)
    print(f"{config['emoji']} RUNNING {suite_name.upper()} TEST SUITE")
    print("=" * 60)
    print(f"Description: {config['description']}")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    start_time = time.time()
    success, output = run_test_suite(suite_name)
    end_time = time.time()
    
    print(f"\n{'='*60}")
    print(f"📊 {suite_name.upper()} TEST SUMMARY")
    print(f"{'='*60}")
    
    status = "✅ PASSED" if success else "❌ FAILED"
    print(f"Status: {status}")
    print(f"Duration: {end_time - start_time:.1f}s")
    
    if not success and output:
        print(f"Error Details: {output}")
    
    return success

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Run Resomix API route tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_all_tests.py                    # Run all test suites
  python run_all_tests.py health             # Run only health tests
  python run_all_tests.py feedback           # Run only feedback tests
  python run_all_tests.py contact            # Run only contact tests
  python run_all_tests.py similarity         # Run only similarity tests
        """
    )
    
    parser.add_argument(
        'suite',
        nargs='?',
        choices=list(TEST_SUITES.keys()) + ['all'],
        default='all',
        help='Test suite to run (default: all)'
    )
    
    parser.add_argument(
        '--list',
        action='store_true',
        help='List available test suites'
    )
    
    args = parser.parse_args()
    
    if args.list:
        print_header()
        print_suite_list()
        return True
    
    if args.suite == 'all':
        return run_all_tests()
    else:
        return run_single_test(args.suite)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 