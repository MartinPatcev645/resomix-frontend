"""
Database Utilities
==================

This module provides comprehensive database utilities for the Resomix Audio Similarity API.
It includes functions for database health checks, backup and restore operations,
maintenance tasks, and performance monitoring.

Supports database backup/restore, health monitoring, connection testing,
and maintenance operations with proper error handling and logging.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import os
import subprocess
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
from sqlalchemy import text, inspect
from sqlalchemy.exc import SQLAlchemyError
from database.connection import engine, DB_URL
import urllib.parse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabaseUtils:
    """Comprehensive database utilities for maintenance and monitoring."""
    
    def __init__(self):
        self.engine = engine
        self.db_url = DB_URL
        self._parse_db_config()
    
    def _parse_db_config(self):
        """Parse database configuration from URL."""
        parsed = urllib.parse.urlparse(self.db_url)
        self.db_config = {
            'host': parsed.hostname or 'localhost',
            'port': parsed.port or 3306,
            'username': parsed.username,
            'password': parsed.password,
            'database': parsed.path.lstrip('/') if parsed.path else 'resomix'
        }
    
    def health_check(self) -> Dict[str, Any]:
        """Perform comprehensive database health check."""
        health_status = {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'checks': {},
            'metrics': {},
            'issues': []
        }
        
        try:
            # Connection test
            with self.engine.connect() as conn:
                start_time = datetime.now()
                conn.execute(text("SELECT 1"))
                connection_time = (datetime.now() - start_time).total_seconds()
                
                health_status['checks']['connection'] = {
                    'status': 'pass',
                    'response_time_ms': round(connection_time * 1000, 2)
                }
                
                # Database version
                result = conn.execute(text("SELECT VERSION()"))
                version = result.scalar()
                health_status['metrics']['database_version'] = version
                
                # Database size
                result = conn.execute(text("""
                    SELECT 
                        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
                    FROM information_schema.tables 
                    WHERE table_schema = :db_name
                """), {'db_name': self.db_config['database']})
                
                size_mb = result.scalar() or 0
                health_status['metrics']['database_size_mb'] = size_mb
                
                # Table counts
                table_counts = self._get_table_counts(conn)
                health_status['metrics']['table_counts'] = table_counts
                
                # Check for recent activity
                recent_activity = self._check_recent_activity(conn)
                health_status['metrics']['recent_activity'] = recent_activity
                
                # Check for long-running queries
                long_queries = self._check_long_running_queries(conn)
                if long_queries:
                    health_status['issues'].extend(long_queries)
                
                # Check disk space (if accessible)
                disk_usage = self._check_disk_usage()
                if disk_usage:
                    health_status['metrics']['disk_usage'] = disk_usage
                
        except SQLAlchemyError as e:
            health_status['status'] = 'unhealthy'
            health_status['checks']['connection'] = {
                'status': 'fail',
                'error': str(e)
            }
            health_status['issues'].append(f"Database connection failed: {e}")
        
        except Exception as e:
            health_status['status'] = 'unhealthy'
            health_status['issues'].append(f"Health check failed: {e}")
        
        # Determine overall status
        if health_status['issues']:
            health_status['status'] = 'degraded' if health_status['status'] == 'healthy' else 'unhealthy'
        
        return health_status
    
    def _get_table_counts(self, conn) -> Dict[str, int]:
        """Get row counts for all tables."""
        table_counts = {}
        
        try:
            # Get all table names
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = :db_name
                AND table_type = 'BASE TABLE'
            """), {'db_name': self.db_config['database']})
            
            tables = [row[0] for row in result]
            
            # Get count for each table
            for table in tables:
                try:
                    count_result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    table_counts[table] = count_result.scalar()
                except SQLAlchemyError:
                    table_counts[table] = -1  # Error getting count
                    
        except SQLAlchemyError as e:
            logger.warning(f"Failed to get table counts: {e}")
        
        return table_counts
    
    def _check_recent_activity(self, conn) -> Dict[str, Any]:
        """Check for recent database activity."""
        activity = {}
        
        try:
            # Check recent tracks
            result = conn.execute(text("""
                SELECT COUNT(*) 
                FROM tracks 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            """))
            activity['tracks_last_24h'] = result.scalar()
            
            # Check recent feedback
            result = conn.execute(text("""
                SELECT COUNT(*) 
                FROM feedback 
                WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            """))
            activity['feedback_last_24h'] = result.scalar()
            
            # Check recent logs
            result = conn.execute(text("""
                SELECT COUNT(*) 
                FROM logs 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            """))
            activity['logs_last_hour'] = result.scalar()
            
        except SQLAlchemyError as e:
            logger.warning(f"Failed to check recent activity: {e}")
        
        return activity
    
    def _check_long_running_queries(self, conn) -> List[str]:
        """Check for long-running queries."""
        issues = []
        
        try:
            result = conn.execute(text("""
                SELECT id, time, state, info
                FROM information_schema.processlist 
                WHERE command != 'Sleep' 
                AND time > 30
                AND user != 'system user'
            """))
            
            for row in result:
                issues.append(f"Long-running query (ID: {row.id}, Time: {row.time}s): {row.info[:100]}...")
                
        except SQLAlchemyError as e:
            logger.warning(f"Failed to check long-running queries: {e}")
        
        return issues
    
    def _check_disk_usage(self) -> Optional[Dict[str, Any]]:
        """Check disk usage (basic implementation)."""
        try:
            # This is a basic check - in production you'd want more sophisticated monitoring
            import shutil
            total, used, free = shutil.disk_usage('/')
            
            return {
                'total_gb': round(total / (1024**3), 2),
                'used_gb': round(used / (1024**3), 2),
                'free_gb': round(free / (1024**3), 2),
                'usage_percent': round((used / total) * 100, 2)
            }
        except Exception:
            return None
    
    def backup_database(self, backup_dir: str = "backups", include_data: bool = True) -> str:
        """
        Create database backup using mysqldump.
        
        Args:
            backup_dir: Directory to store backups
            include_data: Whether to include data or schema only
            
        Returns:
            Path to backup file
        """
        try:
            # Create backup directory
            backup_path = Path(backup_dir)
            backup_path.mkdir(parents=True, exist_ok=True)
            
            # Generate backup filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_type = "full" if include_data else "schema"
            filename = f"resomix_backup_{backup_type}_{timestamp}.sql"
            backup_file = backup_path / filename
            
            # Build mysqldump command
            cmd = [
                'mysqldump',
                f'--host={self.db_config["host"]}',
                f'--port={self.db_config["port"]}',
                f'--user={self.db_config["username"]}',
                f'--password={self.db_config["password"]}',
                '--single-transaction',
                '--routines',
                '--triggers',
                '--add-drop-table',
                '--create-options'
            ]
            
            if not include_data:
                cmd.append('--no-data')
            
            cmd.append(self.db_config['database'])
            
            # Execute backup
            logger.info(f"Creating database backup: {backup_file}")
            
            with open(backup_file, 'w') as f:
                result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=True)
            
            if result.returncode != 0:
                raise Exception(f"mysqldump failed: {result.stderr}")
            
            # Verify backup file
            if not backup_file.exists() or backup_file.stat().st_size == 0:
                raise Exception("Backup file is empty or was not created")
            
            logger.info(f"Database backup completed: {backup_file}")
            return str(backup_file)
            
        except Exception as e:
            logger.error(f"Database backup failed: {e}")
            raise
    
    def restore_database(self, backup_file: str, drop_existing: bool = False) -> bool:
        """
        Restore database from backup file.
        
        Args:
            backup_file: Path to backup file
            drop_existing: Whether to drop existing database first
            
        Returns:
            True if successful
        """
        try:
            backup_path = Path(backup_file)
            if not backup_path.exists():
                raise FileNotFoundError(f"Backup file not found: {backup_file}")
            
            logger.info(f"Restoring database from: {backup_file}")
            
            # Drop existing database if requested
            if drop_existing:
                logger.warning("Dropping existing database...")
                with self.engine.connect() as conn:
                    conn.execute(text(f"DROP DATABASE IF EXISTS {self.db_config['database']}"))
                    conn.execute(text(f"CREATE DATABASE {self.db_config['database']} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
            
            # Build mysql command
            cmd = [
                'mysql',
                f'--host={self.db_config["host"]}',
                f'--port={self.db_config["port"]}',
                f'--user={self.db_config["username"]}',
                f'--password={self.db_config["password"]}',
                self.db_config['database']
            ]
            
            # Execute restore
            with open(backup_file, 'r') as f:
                result = subprocess.run(cmd, stdin=f, stderr=subprocess.PIPE, text=True)
            
            if result.returncode != 0:
                raise Exception(f"mysql restore failed: {result.stderr}")
            
            logger.info("Database restore completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Database restore failed: {e}")
            return False
    
    def optimize_tables(self) -> Dict[str, str]:
        """Optimize all tables in the database."""
        results = {}
        
        try:
            with self.engine.connect() as conn:
                # Get all table names
                result = conn.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = :db_name
                    AND table_type = 'BASE TABLE'
                """), {'db_name': self.db_config['database']})
                
                tables = [row[0] for row in result]
                
                # Optimize each table
                for table in tables:
                    try:
                        logger.info(f"Optimizing table: {table}")
                        conn.execute(text(f"OPTIMIZE TABLE {table}"))
                        results[table] = "success"
                    except SQLAlchemyError as e:
                        logger.error(f"Failed to optimize table {table}: {e}")
                        results[table] = f"error: {e}"
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to optimize tables: {e}")
            results['error'] = str(e)
        
        return results
    
    def analyze_tables(self) -> Dict[str, str]:
        """Analyze all tables to update statistics."""
        results = {}
        
        try:
            with self.engine.connect() as conn:
                # Get all table names
                result = conn.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = :db_name
                    AND table_type = 'BASE TABLE'
                """), {'db_name': self.db_config['database']})
                
                tables = [row[0] for row in result]
                
                # Analyze each table
                for table in tables:
                    try:
                        logger.info(f"Analyzing table: {table}")
                        conn.execute(text(f"ANALYZE TABLE {table}"))
                        results[table] = "success"
                    except SQLAlchemyError as e:
                        logger.error(f"Failed to analyze table {table}: {e}")
                        results[table] = f"error: {e}"
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to analyze tables: {e}")
            results['error'] = str(e)
        
        return results
    
    def cleanup_old_logs(self, days_to_keep: int = 30) -> int:
        """Clean up old log entries."""
        try:
            with self.engine.begin() as conn:
                result = conn.execute(text("""
                    DELETE FROM logs 
                    WHERE created_at < DATE_SUB(NOW(), INTERVAL :days DAY)
                """), {'days': days_to_keep})
                
                deleted_count = result.rowcount
                logger.info(f"Cleaned up {deleted_count} old log entries")
                return deleted_count
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to cleanup old logs: {e}")
            return 0
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Get comprehensive database statistics."""
        stats = {}
        
        try:
            with self.engine.connect() as conn:
                # Database size
                result = conn.execute(text("""
                    SELECT 
                        table_schema as 'database',
                        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as 'size_mb',
                        ROUND(SUM(data_length) / 1024 / 1024, 2) as 'data_mb',
                        ROUND(SUM(index_length) / 1024 / 1024, 2) as 'index_mb'
                    FROM information_schema.tables 
                    WHERE table_schema = :db_name
                    GROUP BY table_schema
                """), {'db_name': self.db_config['database']})
                
                row = result.first()
                if row:
                    stats['database_size'] = {
                        'total_mb': row.size_mb,
                        'data_mb': row.data_mb,
                        'index_mb': row.index_mb
                    }
                
                # Table statistics
                result = conn.execute(text("""
                    SELECT 
                        table_name,
                        table_rows,
                        ROUND((data_length + index_length) / 1024 / 1024, 2) as size_mb,
                        ROUND(data_length / 1024 / 1024, 2) as data_mb,
                        ROUND(index_length / 1024 / 1024, 2) as index_mb
                    FROM information_schema.tables 
                    WHERE table_schema = :db_name
                    AND table_type = 'BASE TABLE'
                    ORDER BY (data_length + index_length) DESC
                """), {'db_name': self.db_config['database']})
                
                table_stats = []
                for row in result:
                    table_stats.append({
                        'table_name': row.table_name,
                        'row_count': row.table_rows,
                        'total_mb': row.size_mb,
                        'data_mb': row.data_mb,
                        'index_mb': row.index_mb
                    })
                
                stats['table_statistics'] = table_stats
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to get database stats: {e}")
            stats['error'] = str(e)
        
        return stats


def main():
    """CLI interface for database utilities."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python database/utils.py <command> [options]")
        print("Commands:")
        print("  health-check              - Perform database health check")
        print("  backup [--schema-only]    - Create database backup")
        print("  restore <backup_file>     - Restore from backup")
        print("  optimize                  - Optimize all tables")
        print("  analyze                   - Analyze all tables")
        print("  cleanup-logs [days]       - Clean up old logs (default: 30 days)")
        print("  stats                     - Show database statistics")
        return
    
    utils = DatabaseUtils()
    command = sys.argv[1]
    
    try:
        if command == "health-check":
            health = utils.health_check()
            print(json.dumps(health, indent=2, default=str))
        
        elif command == "backup":
            schema_only = "--schema-only" in sys.argv
            backup_file = utils.backup_database(include_data=not schema_only)
            print(f"Backup created: {backup_file}")
        
        elif command == "restore":
            if len(sys.argv) < 3:
                print("Error: restore requires backup file path")
                sys.exit(1)
            backup_file = sys.argv[2]
            success = utils.restore_database(backup_file)
            sys.exit(0 if success else 1)
        
        elif command == "optimize":
            results = utils.optimize_tables()
            print("Table optimization results:")
            for table, result in results.items():
                print(f"  {table}: {result}")
        
        elif command == "analyze":
            results = utils.analyze_tables()
            print("Table analysis results:")
            for table, result in results.items():
                print(f"  {table}: {result}")
        
        elif command == "cleanup-logs":
            days = int(sys.argv[2]) if len(sys.argv) > 2 else 30
            deleted = utils.cleanup_old_logs(days)
            print(f"Cleaned up {deleted} old log entries")
        
        elif command == "stats":
            stats = utils.get_database_stats()
            print(json.dumps(stats, indent=2, default=str))
        
        else:
            print(f"Unknown command: {command}")
            sys.exit(1)
    
    except Exception as e:
        logger.error(f"Command failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 