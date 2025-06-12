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
        "description": "Feedback and contact forms",
        "emoji": "💬"
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
        print(f"Error: {output}")
    
    return success

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Resomix API Route Tests Master Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Available test suites:
{chr(10).join(f"  {name:<12} - {config['description']}" for name, config in TEST_SUITES.items())}

Examples:
  python {__file__}                    # Run all tests
  python {__file__} health            # Run health tests only
  python {__file__} search feedback   # Run search and feedback tests
        """
    )
    
    parser.add_argument(
        'suites',
        nargs='*',
        help='Specific test suites to run (default: all)'
    )
    
    parser.add_argument(
        '--list', '-l',
        action='store_true',
        help='List available test suites and exit'
    )
    
    args = parser.parse_args()
    
    if args.list:
        print_suite_list()
        return
    
    if not args.suites:
        # Run all tests
        success = run_all_tests()
        sys.exit(0 if success else 1)
    else:
        # Run specific test suites
        all_passed = True
        
        for suite_name in args.suites:
            if len(args.suites) > 1:
                print()  # Spacing between multiple tests
            
            success = run_single_test(suite_name)
            if not success:
                all_passed = False
        
        if len(args.suites) > 1:
            # Summary for multiple tests
            passed = sum(1 for suite in args.suites if run_single_test(suite))
            failed = len(args.suites) - passed
            
            print(f"\n{'='*60}")
            print("📊 MULTIPLE SUITES SUMMARY")
            print(f"{'='*60}")
            print(f"Passed: {passed}/{len(args.suites)} ✅")
            print(f"Failed: {failed}/{len(args.suites)} ❌")
        
        sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main() 