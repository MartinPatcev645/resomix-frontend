#!/usr/bin/env python3
"""
Database Management CLI
========================

Comprehensive database management command-line interface for the Resomix Audio Similarity API.
This script provides a unified interface for database operations including migrations,
seeding, backups, maintenance, and monitoring.

Supports migration management, data seeding, backup/restore operations,
health monitoring, and database maintenance tasks.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import sys
import argparse
import json
import logging
from pathlib import Path
from typing import Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.migration_manager import MigrationManager
from scripts.seed_data import SeedDataManager
from database.utils import DatabaseUtils
from database.connection import test_connection, get_connection_info

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DatabaseManager:
    """Unified database management interface."""
    
    def __init__(self):
        self.migration_manager = MigrationManager()
        self.seed_manager = SeedDataManager()
        self.utils = DatabaseUtils()
    
    def status(self) -> bool:
        """Show comprehensive database status."""
        try:
            print("=" * 60)
            print("DATABASE STATUS")
            print("=" * 60)
            
            # Connection test
            print("\n🔗 CONNECTION TEST")
            if test_connection():
                print("✓ Database connection: HEALTHY")
            else:
                print("✗ Database connection: FAILED")
                return False
            
            # Connection info
            print("\n📊 CONNECTION INFO")
            conn_info = get_connection_info()
            for key, value in conn_info.items():
                print(f"  {key}: {value}")
            
            # Migration status
            print("\n🔄 MIGRATION STATUS")
            migration_status = self.migration_manager.get_migration_status()
            print(f"  Total migrations: {migration_status['total_migrations']}")
            print(f"  Applied: {migration_status['applied_count']}")
            print(f"  Pending: {migration_status['pending_count']}")
            
            if migration_status['pending_count'] > 0:
                print("  ⚠️  Pending migrations found!")
                for migration in migration_status['migrations']:
                    if migration['status'] == 'pending':
                        print(f"    - {migration['version']}: {migration['description']}")
            
            # Health check
            print("\n🏥 HEALTH CHECK")
            health = self.utils.health_check()
            print(f"  Overall status: {health['status'].upper()}")
            
            if health['metrics'].get('database_size_mb'):
                print(f"  Database size: {health['metrics']['database_size_mb']} MB")
            
            if health['metrics'].get('table_counts'):
                total_records = sum(health['metrics']['table_counts'].values())
                print(f"  Total records: {total_records:,}")
            
            if health['issues']:
                print("  ⚠️  Issues found:")
                for issue in health['issues']:
                    print(f"    - {issue}")
            
            print("\n" + "=" * 60)
            return True
            
        except Exception as e:
            logger.error(f"Failed to get database status: {e}")
            return False
    
    def setup(self, with_sample_data: bool = False) -> bool:
        """Set up database from scratch."""
        try:
            print("🚀 Setting up database...")
            
            # Run migrations
            print("\n📦 Running migrations...")
            if not self.migration_manager.run_migrations():
                print("❌ Migration failed")
                return False
            print("✅ Migrations completed")
            
            # Seed data if requested
            if with_sample_data:
                print("\n🌱 Seeding sample data...")
                if not self.seed_manager.seed_all():
                    print("❌ Seeding failed")
                    return False
                print("✅ Sample data seeded")
            
            print("\n🎉 Database setup completed successfully!")
            return True
            
        except Exception as e:
            logger.error(f"Database setup failed: {e}")
            return False
    
    def reset(self, confirm: bool = False) -> bool:
        """Reset database (destructive operation)."""
        try:
            if not confirm:
                response = input("⚠️  This will DELETE ALL DATA. Type 'yes' to confirm: ")
                if response.lower() != 'yes':
                    print("Operation cancelled")
                    return True
            
            print("🗑️  Resetting database...")
            
            # Clear all data
            if not self.seed_manager.clear_all_data():
                print("❌ Failed to clear data")
                return False
            
            print("✅ Database reset completed")
            return True
            
        except Exception as e:
            logger.error(f"Database reset failed: {e}")
            return False
    
    def backup(self, output_dir: str = "backups", schema_only: bool = False) -> bool:
        """Create database backup."""
        try:
            print(f"💾 Creating {'schema' if schema_only else 'full'} backup...")
            
            backup_file = self.utils.backup_database(
                backup_dir=output_dir,
                include_data=not schema_only
            )
            
            print(f"✅ Backup created: {backup_file}")
            return True
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            return False
    
    def restore(self, backup_file: str, drop_existing: bool = False) -> bool:
        """Restore database from backup."""
        try:
            if drop_existing:
                response = input("⚠️  This will DROP the existing database. Type 'yes' to confirm: ")
                if response.lower() != 'yes':
                    print("Operation cancelled")
                    return True
            
            print(f"📥 Restoring database from {backup_file}...")
            
            if not self.utils.restore_database(backup_file, drop_existing):
                print("❌ Restore failed")
                return False
            
            print("✅ Database restored successfully")
            return True
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False
    
    def maintenance(self) -> bool:
        """Run database maintenance tasks."""
        try:
            print("🔧 Running database maintenance...")
            
            # Optimize tables
            print("\n📈 Optimizing tables...")
            optimize_results = self.utils.optimize_tables()
            success_count = sum(1 for result in optimize_results.values() if result == "success")
            print(f"✅ Optimized {success_count}/{len(optimize_results)} tables")
            
            # Analyze tables
            print("\n📊 Analyzing tables...")
            analyze_results = self.utils.analyze_tables()
            success_count = sum(1 for result in analyze_results.values() if result == "success")
            print(f"✅ Analyzed {success_count}/{len(analyze_results)} tables")
            
            # Cleanup old logs
            print("\n🧹 Cleaning up old logs...")
            deleted_count = self.utils.cleanup_old_logs(days_to_keep=30)
            print(f"✅ Cleaned up {deleted_count} old log entries")
            
            print("\n🎉 Maintenance completed successfully!")
            return True
            
        except Exception as e:
            logger.error(f"Maintenance failed: {e}")
            return False


def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description="Resomix Database Management CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python database/manage.py status                    # Show database status
  python database/manage.py setup --with-data         # Setup with sample data
  python database/manage.py migrate                   # Run pending migrations
  python database/manage.py seed --all                # Seed all sample data
  python database/manage.py backup                    # Create full backup
  python database/manage.py backup --schema-only      # Create schema backup
  python database/manage.py restore backup.sql        # Restore from backup
  python database/manage.py maintenance               # Run maintenance tasks
  python database/manage.py reset                     # Reset database (destructive)
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Status command
    subparsers.add_parser('status', help='Show database status')
    
    # Setup command
    setup_parser = subparsers.add_parser('setup', help='Setup database from scratch')
    setup_parser.add_argument('--with-data', action='store_true', help='Include sample data')
    
    # Migration commands
    migrate_parser = subparsers.add_parser('migrate', help='Run database migrations')
    migrate_parser.add_argument('--to', help='Migrate to specific version')
    migrate_parser.add_argument('--dry-run', action='store_true', help='Show what would be executed')
    
    rollback_parser = subparsers.add_parser('rollback', help='Rollback migrations')
    rollback_parser.add_argument('version', help='Target version to rollback to')
    rollback_parser.add_argument('--dry-run', action='store_true', help='Show what would be executed')
    
    # Seeding commands
    seed_parser = subparsers.add_parser('seed', help='Seed database with sample data')
    seed_group = seed_parser.add_mutually_exclusive_group(required=True)
    seed_group.add_argument('--all', action='store_true', help='Seed all data')
    seed_group.add_argument('--rbac', action='store_true', help='Seed RBAC data only')
    seed_group.add_argument('--catalog', action='store_true', help='Seed catalog data only')
    seed_group.add_argument('--tracks', action='store_true', help='Seed sample tracks only')
    seed_group.add_argument('--feedback', action='store_true', help='Seed feedback data only')
    
    # Backup commands
    backup_parser = subparsers.add_parser('backup', help='Create database backup')
    backup_parser.add_argument('--output-dir', default='backups', help='Backup directory')
    backup_parser.add_argument('--schema-only', action='store_true', help='Backup schema only')
    
    # Restore command
    restore_parser = subparsers.add_parser('restore', help='Restore database from backup')
    restore_parser.add_argument('backup_file', help='Path to backup file')
    restore_parser.add_argument('--drop-existing', action='store_true', help='Drop existing database')
    
    # Maintenance command
    subparsers.add_parser('maintenance', help='Run database maintenance tasks')
    
    # Reset command
    reset_parser = subparsers.add_parser('reset', help='Reset database (destructive)')
    reset_parser.add_argument('--confirm', action='store_true', help='Skip confirmation prompt')
    
    # Health command
    subparsers.add_parser('health', help='Detailed health check')
    
    # Stats command
    subparsers.add_parser('stats', help='Show database statistics')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Initialize manager
    db_manager = DatabaseManager()
    
    try:
        if args.command == 'status':
            success = db_manager.status()
        
        elif args.command == 'setup':
            success = db_manager.setup(with_sample_data=args.with_data)
        
        elif args.command == 'migrate':
            success = db_manager.migration_manager.run_migrations(
                target_version=args.to,
                dry_run=args.dry_run
            )
        
        elif args.command == 'rollback':
            success = db_manager.migration_manager.rollback_migration(
                target_version=args.version,
                dry_run=args.dry_run
            )
        
        elif args.command == 'seed':
            if args.all:
                success = db_manager.seed_manager.seed_all()
            elif args.rbac:
                success = db_manager.seed_manager.seed_rbac_data()
            elif args.catalog:
                success = db_manager.seed_manager.seed_catalog_data()
            elif args.tracks:
                success = db_manager.seed_manager.seed_sample_tracks()
            elif args.feedback:
                success = db_manager.seed_manager.seed_sample_feedback()
        
        elif args.command == 'backup':
            success = db_manager.backup(
                output_dir=args.output_dir,
                schema_only=args.schema_only
            )
        
        elif args.command == 'restore':
            success = db_manager.restore(
                backup_file=args.backup_file,
                drop_existing=args.drop_existing
            )
        
        elif args.command == 'maintenance':
            success = db_manager.maintenance()
        
        elif args.command == 'reset':
            success = db_manager.reset(confirm=args.confirm)
        
        elif args.command == 'health':
            health = db_manager.utils.health_check()
            print(json.dumps(health, indent=2, default=str))
            success = health['status'] != 'unhealthy'
        
        elif args.command == 'stats':
            stats = db_manager.utils.get_database_stats()
            print(json.dumps(stats, indent=2, default=str))
            success = 'error' not in stats
        
        else:
            print(f"Unknown command: {args.command}")
            success = False
        
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\n⚠️  Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Command failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 