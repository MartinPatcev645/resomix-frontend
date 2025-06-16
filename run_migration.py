#!/usr/bin/env python3
"""
Migration Runner Script
=======================

Simple script to run the track type column migration.
This script executes the 002_add_track_type_column migration
to add the type column to the tracks table.

Usage:
    python run_migration.py

Version: 3.0.1
Created: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import sys
import os
from pathlib import Path
from database.migration_manager import MigrationManager

def main():
    """Run the track type column migration."""
    print("Running track type column migration...")
    
    try:
        # Initialize migration manager
        migration_manager = MigrationManager()
        
        # Get migration status
        status = migration_manager.get_migration_status()
        print(f"Total migrations: {status['total_migrations']}")
        print(f"Applied: {status['applied_count']}")
        print(f"Pending: {status['pending_count']}")
        
        if status['pending_count'] > 0:
            print("\nPending migrations:")
            for migration in status['migrations']:
                if migration['status'] == 'pending':
                    print(f"  - {migration['version']}: {migration['description']}")
            
            # Run migrations
            print("\nRunning migrations...")
            success = migration_manager.run_migrations()
            
            if success:
                print("✅ Migrations completed successfully!")
                print("\nThe 'type' column has been added to the tracks table.")
                print("Default value: 'electrobuzz' for existing tracks")
                print("Use 'upload' for uploaded tracks")
            else:
                print("❌ Migration failed!")
                return 1
        else:
            print("✅ All migrations are up to date!")
        
        return 0
        
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
