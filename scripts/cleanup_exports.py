"""
Cleanup Old Export Files
========================

This script removes export files older than 24 hours from the exports directory.
Can be run manually or scheduled via cron job.

Usage:
    python scripts/cleanup_exports.py

Cron (daily at 2 AM):
    0 2 * * * cd /path/to/app && /path/to/venv/bin/python scripts/cleanup_exports.py

Author: Muhammad Usman Naeem
Date: October 2, 2025
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))


def cleanup_old_exports(max_age_hours: int = 24, dry_run: bool = False):
    """
    Remove export files older than specified hours.
    
    Args:
        max_age_hours: Maximum age of files in hours (default: 24)
        dry_run: If True, only print what would be deleted without actually deleting
    """
    # Get exports directory path
    project_root = Path(__file__).parent.parent
    export_dir = project_root / 'exports'
    
    if not export_dir.exists():
        print(f"Export directory does not exist: {export_dir}")
        return
    
    print(f"Checking exports directory: {export_dir}")
    print(f"Removing files older than {max_age_hours} hours...")
    print("-" * 60)
    
    now = datetime.now()
    deleted_count = 0
    total_size = 0
    
    # Iterate through all CSV files in exports directory
    for file_path in export_dir.glob("feedback_export_*.csv"):
        try:
            # Get file modification time
            file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
            file_age = now - file_mtime
            file_size = file_path.stat().st_size
            
            # Check if file is older than max age
            if file_age > timedelta(hours=max_age_hours):
                if dry_run:
                    print(f"[DRY RUN] Would delete: {file_path.name}")
                    print(f"  Age: {file_age}")
                    print(f"  Size: {file_size} bytes")
                else:
                    print(f"Deleting: {file_path.name}")
                    print(f"  Age: {file_age}")
                    print(f"  Size: {file_size} bytes")
                    file_path.unlink()
                
                deleted_count += 1
                total_size += file_size
            else:
                print(f"Keeping: {file_path.name} (age: {file_age})")
        
        except Exception as e:
            print(f"Error processing {file_path.name}: {e}")
    
    print("-" * 60)
    if dry_run:
        print(f"[DRY RUN] Would delete {deleted_count} file(s), total size: {total_size:,} bytes")
    else:
        print(f"Deleted {deleted_count} file(s), freed {total_size:,} bytes")
    print(f"Cleanup complete at {now.strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Clean up old export files")
    parser.add_argument(
        "--max-age",
        type=int,
        default=24,
        help="Maximum age of files in hours (default: 24)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without actually deleting"
    )
    
    args = parser.parse_args()
    
    cleanup_old_exports(max_age_hours=args.max_age, dry_run=args.dry_run)
