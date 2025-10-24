"""
Database Migration Manager
==========================

This module provides comprehensive database migration management for the Resomix Audio Similarity API.
It handles migration execution, rollback, status tracking, and validation with proper error handling
and transaction management for safe database schema evolution.

Supports forward migrations, rollbacks, migration validation, and status reporting
with comprehensive logging and safety checks.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import os
import re
import hashlib
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from pathlib import Path
from sqlalchemy import create_engine, text, MetaData, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from database.connection import DB_URL, engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MigrationError(Exception):
    """Custom exception for migration-related errors."""
    pass


class MigrationManager:
    """
    Manages database migrations with support for forward migrations,
    rollbacks, and migration status tracking.
    """
    
    def __init__(self, migrations_dir: str = "database/migrations"):
        self.migrations_dir = Path(migrations_dir)
        self.engine = engine
        self.SessionLocal = sessionmaker(bind=self.engine)
        
        # Ensure migrations directory exists
        self.migrations_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize migration tracking table
        self._ensure_migration_table()
    
    def _ensure_migration_table(self):
        """Ensure the schema_migrations table exists."""
        try:
            with self.engine.connect() as conn:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS schema_migrations (
                        version VARCHAR(255) PRIMARY KEY,
                        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        description TEXT,
                        checksum VARCHAR(64)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """))
                conn.commit()
                logger.info("Migration tracking table ensured")
        except SQLAlchemyError as e:
            logger.error(f"Failed to create migration tracking table: {e}")
            raise MigrationError(f"Failed to initialize migration system: {e}")
    
    def _calculate_checksum(self, content: str) -> str:
        """Calculate SHA-256 checksum of migration content."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]
    
    def _get_migration_files(self) -> List[Tuple[str, Path]]:
        """Get all migration files sorted by version."""
        migration_files = []
        
        for file_path in self.migrations_dir.glob("*.sql"):
            # Extract version from filename (e.g., "001_initial_schema.sql" -> "001_initial_schema")
            version = file_path.stem
            if re.match(r'^\d{3}_\w+', version):
                migration_files.append((version, file_path))
        
        # Sort by version number
        migration_files.sort(key=lambda x: x[0])
        return migration_files
    
    def _get_applied_migrations(self) -> Dict[str, Dict]:
        """Get list of applied migrations from database."""
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT version, applied_at, description, checksum 
                    FROM schema_migrations 
                    ORDER BY version
                """))
                
                applied = {}
                for row in result:
                    applied[row.version] = {
                        'applied_at': row.applied_at,
                        'description': row.description,
                        'checksum': row.checksum
                    }
                return applied
        except SQLAlchemyError as e:
            logger.error(f"Failed to get applied migrations: {e}")
            raise MigrationError(f"Failed to check migration status: {e}")
    
    def _extract_migration_info(self, content: str) -> Dict[str, str]:
        """Extract migration metadata from SQL content."""
        info = {
            'description': 'No description provided',
            'version': '',
            'author': '',
            'created': ''
        }
        
        # Extract description from comment
        desc_match = re.search(r'Migration:\s*(\w+)\s*\n.*?\n(.*?)\n', content, re.DOTALL)
        if desc_match:
            info['version'] = desc_match.group(1)
            info['description'] = desc_match.group(2).strip()
        
        return info
    
    def get_migration_status(self) -> Dict:
        """Get comprehensive migration status."""
        migration_files = self._get_migration_files()
        applied_migrations = self._get_applied_migrations()
        
        status = {
            'total_migrations': len(migration_files),
            'applied_count': len(applied_migrations),
            'pending_count': 0,
            'migrations': []
        }
        
        for version, file_path in migration_files:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            checksum = self._calculate_checksum(content)
            info = self._extract_migration_info(content)
            
            migration_info = {
                'version': version,
                'file': str(file_path),
                'description': info['description'],
                'checksum': checksum,
                'status': 'pending'
            }
            
            if version in applied_migrations:
                applied = applied_migrations[version]
                migration_info.update({
                    'status': 'applied',
                    'applied_at': applied['applied_at'],
                    'checksum_match': applied['checksum'] == checksum
                })
                
                if not migration_info['checksum_match']:
                    migration_info['status'] = 'modified'
                    logger.warning(f"Migration {version} has been modified after application")
            else:
                status['pending_count'] += 1
            
            status['migrations'].append(migration_info)
        
        return status
    
    def run_migrations(self, target_version: Optional[str] = None, dry_run: bool = False) -> bool:
        """
        Run pending migrations up to target version.
        
        Args:
            target_version: Stop at this version (None = run all)
            dry_run: Only show what would be executed
            
        Returns:
            True if successful, False otherwise
        """
        try:
            migration_files = self._get_migration_files()
            applied_migrations = self._get_applied_migrations()
            
            pending_migrations = []
            for version, file_path in migration_files:
                if version not in applied_migrations:
                    pending_migrations.append((version, file_path))
                    if target_version and version == target_version:
                        break
            
            if not pending_migrations:
                logger.info("No pending migrations to run")
                return True
            
            logger.info(f"Found {len(pending_migrations)} pending migrations")
            
            if dry_run:
                logger.info("DRY RUN - Would execute the following migrations:")
                for version, file_path in pending_migrations:
                    logger.info(f"  - {version}: {file_path}")
                return True
            
            # Execute migrations in transaction
            with self.engine.begin() as conn:
                for version, file_path in pending_migrations:
                    logger.info(f"Applying migration: {version}")
                    
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    checksum = self._calculate_checksum(content)
                    info = self._extract_migration_info(content)
                    
                    # Execute migration SQL
                    try:
                        # Split by semicolon and execute each statement
                        statements = [stmt.strip() for stmt in content.split(';') if stmt.strip()]
                        for statement in statements:
                            if statement and not statement.startswith('--'):
                                conn.execute(text(statement))
                        
                        # Record migration as applied (skip if already exists)
                        conn.execute(text("""
                            INSERT IGNORE INTO schema_migrations (version, description, checksum) 
                            VALUES (:version, :description, :checksum)
                        """), {
                            'version': version,
                            'description': info['description'],
                            'checksum': checksum
                        })
                        
                        logger.info(f"Successfully applied migration: {version}")
                        
                    except SQLAlchemyError as e:
                        logger.error(f"Failed to apply migration {version}: {e}")
                        raise MigrationError(f"Migration {version} failed: {e}")
            
            logger.info("All migrations applied successfully")
            return True
            
        except Exception as e:
            logger.error(f"Migration execution failed: {e}")
            return False
    
    def rollback_migration(self, target_version: str, dry_run: bool = False) -> bool:
        """
        Rollback to a specific migration version.
        
        Args:
            target_version: Version to rollback to
            dry_run: Only show what would be executed
            
        Returns:
            True if successful, False otherwise
        """
        try:
            applied_migrations = self._get_applied_migrations()
            
            # Find migrations to rollback (newer than target)
            to_rollback = []
            for version in sorted(applied_migrations.keys(), reverse=True):
                if version > target_version:
                    to_rollback.append(version)
            
            if not to_rollback:
                logger.info(f"Already at or before version {target_version}")
                return True
            
            if dry_run:
                logger.info("DRY RUN - Would rollback the following migrations:")
                for version in to_rollback:
                    logger.info(f"  - {version}")
                return True
            
            # Execute rollback
            with self.engine.begin() as conn:
                for version in to_rollback:
                    logger.info(f"Rolling back migration: {version}")
                    
                    # Remove from migration tracking
                    conn.execute(text("""
                        DELETE FROM schema_migrations WHERE version = :version
                    """), {'version': version})
                    
                    logger.warning(f"Rolled back migration: {version}")
                    logger.warning("Note: This only removes the migration record. Manual schema cleanup may be required.")
            
            logger.info(f"Rollback to {target_version} completed")
            return True
            
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return False
    
    def validate_migrations(self) -> bool:
        """Validate all applied migrations against their files."""
        try:
            status = self.get_migration_status()
            
            validation_errors = []
            for migration in status['migrations']:
                if migration['status'] == 'applied' and not migration.get('checksum_match', True):
                    validation_errors.append(f"Migration {migration['version']} has been modified")
                elif migration['status'] == 'modified':
                    validation_errors.append(f"Migration {migration['version']} checksum mismatch")
            
            if validation_errors:
                logger.error("Migration validation failed:")
                for error in validation_errors:
                    logger.error(f"  - {error}")
                return False
            
            logger.info("All migrations validated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Migration validation failed: {e}")
            return False
    
    def create_migration(self, name: str, description: str = "") -> str:
        """
        Create a new migration file template.
        
        Args:
            name: Migration name (will be prefixed with version number)
            description: Migration description
            
        Returns:
            Path to created migration file
        """
        try:
            # Get next version number
            existing_migrations = self._get_migration_files()
            if existing_migrations:
                last_version = existing_migrations[-1][0]
                version_num = int(last_version.split('_')[0]) + 1
            else:
                version_num = 1
            
            version = f"{version_num:03d}_{name}"
            filename = f"{version}.sql"
            file_path = self.migrations_dir / filename
            
            # Create migration template
            template = f"""/*
Migration: {version}
{'=' * (len(version) + 11)}

{description or f'Migration: {name}'}

Version: 3.0.1
Created: {datetime.now().strftime('%B %d, %Y')}
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
*/

-- Insert migration record
INSERT IGNORE INTO schema_migrations (version, description, checksum) 
VALUES ('{version}', '{description or name}', 'placeholder_checksum');

-- Add your migration SQL here
-- Example:
-- ALTER TABLE tracks ADD COLUMN new_field VARCHAR(255);

-- Remember to update the checksum after writing your migration
"""
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(template)
            
            logger.info(f"Created migration file: {file_path}")
            return str(file_path)
            
        except Exception as e:
            logger.error(f"Failed to create migration: {e}")
            raise MigrationError(f"Failed to create migration: {e}")


def main():
    """CLI interface for migration management."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python migration_manager.py <command> [options]")
        print("Commands:")
        print("  status                    - Show migration status")
        print("  migrate [version]         - Run migrations (optionally to specific version)")
        print("  rollback <version>        - Rollback to specific version")
        print("  validate                  - Validate applied migrations")
        print("  create <name> [desc]      - Create new migration")
        print("  dry-run [version]         - Show what migrations would run")
        return
    
    manager = MigrationManager()
    command = sys.argv[1]
    
    try:
        if command == "status":
            status = manager.get_migration_status()
            print(f"Migration Status:")
            print(f"  Total migrations: {status['total_migrations']}")
            print(f"  Applied: {status['applied_count']}")
            print(f"  Pending: {status['pending_count']}")
            print("\nMigrations:")
            for migration in status['migrations']:
                status_icon = "✓" if migration['status'] == 'applied' else "○"
                print(f"  {status_icon} {migration['version']}: {migration['description']}")
        
        elif command == "migrate":
            target = sys.argv[2] if len(sys.argv) > 2 else None
            success = manager.run_migrations(target_version=target)
            sys.exit(0 if success else 1)
        
        elif command == "rollback":
            if len(sys.argv) < 3:
                print("Error: rollback requires target version")
                sys.exit(1)
            target = sys.argv[2]
            success = manager.rollback_migration(target)
            sys.exit(0 if success else 1)
        
        elif command == "validate":
            success = manager.validate_migrations()
            sys.exit(0 if success else 1)
        
        elif command == "create":
            if len(sys.argv) < 3:
                print("Error: create requires migration name")
                sys.exit(1)
            name = sys.argv[2]
            description = sys.argv[3] if len(sys.argv) > 3 else ""
            file_path = manager.create_migration(name, description)
            print(f"Created: {file_path}")
        
        elif command == "dry-run":
            target = sys.argv[2] if len(sys.argv) > 2 else None
            manager.run_migrations(target_version=target, dry_run=True)
        
        else:
            print(f"Unknown command: {command}")
            sys.exit(1)
    
    except Exception as e:
        logger.error(f"Command failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 