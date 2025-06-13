"""
Database Seeding Utilities
===========================

This module contains utilities for seeding the MariaDB database with initial data
for the ResomiX Audio Similarity API. It provides functions for populating
test data, reference data, and sample content for development and testing.

Manages initial data creation, sample track insertion, user setup,
and database initialization for development environments.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import uuid
import logging
from datetime import datetime, date
from typing import List, Dict, Any
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from database.connection import engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SeedDataManager:
    """Manages database seeding operations with sample data."""
    
    def __init__(self):
        self.engine = engine
    
    def seed_rbac_data(self) -> bool:
        """Seed RBAC (roles, permissions, and relationships) data."""
        try:
            with self.engine.begin() as conn:
                # Insert roles
                roles_data = [
                    {'name': 'admin', 'description': 'System administrator with full access'},
                    {'name': 'user', 'description': 'Regular user with basic access'},
                    {'name': 'premium', 'description': 'Premium user with enhanced features'},
                    {'name': 'moderator', 'description': 'Content moderator with review permissions'}
                ]
                
                for role in roles_data:
                    conn.execute(text("""
                        INSERT IGNORE INTO roles (name, description) 
                        VALUES (:name, :description)
                    """), role)
                
                # Insert permissions
                permissions_data = [
                    {'name': 'track.view', 'description': 'View track information'},
                    {'name': 'track.download', 'description': 'Download tracks'},
                    {'name': 'track.upload', 'description': 'Upload tracks'},
                    {'name': 'track.delete', 'description': 'Delete tracks'},
                    {'name': 'playlist.create', 'description': 'Create playlists'},
                    {'name': 'playlist.edit', 'description': 'Edit playlists'},
                    {'name': 'playlist.delete', 'description': 'Delete playlists'},
                    {'name': 'similarity.calculate', 'description': 'Calculate track similarity'},
                    {'name': 'admin.users', 'description': 'Manage users'},
                    {'name': 'admin.system', 'description': 'System administration'},
                    {'name': 'feedback.view', 'description': 'View feedback'},
                    {'name': 'feedback.manage', 'description': 'Manage feedback responses'}
                ]
                
                for permission in permissions_data:
                    conn.execute(text("""
                        INSERT IGNORE INTO permissions (name, description) 
                        VALUES (:name, :description)
                    """), permission)
                
                # Assign permissions to roles
                role_permissions = [
                    # Admin gets all permissions
                    ('admin', ['track.view', 'track.download', 'track.upload', 'track.delete',
                              'playlist.create', 'playlist.edit', 'playlist.delete',
                              'similarity.calculate', 'admin.users', 'admin.system',
                              'feedback.view', 'feedback.manage']),
                    
                    # Premium user gets enhanced features
                    ('premium', ['track.view', 'track.download', 'track.upload',
                                'playlist.create', 'playlist.edit', 'playlist.delete',
                                'similarity.calculate']),
                    
                    # Regular user gets basic features
                    ('user', ['track.view', 'playlist.create', 'playlist.edit',
                             'similarity.calculate']),
                    
                    # Moderator gets content management
                    ('moderator', ['track.view', 'track.delete', 'playlist.view',
                                  'feedback.view', 'feedback.manage'])
                ]
                
                for role_name, permission_names in role_permissions:
                    for permission_name in permission_names:
                        conn.execute(text("""
                            INSERT IGNORE INTO role_permissions (role_id, permission_id)
                            SELECT r.id, p.id 
                            FROM roles r, permissions p 
                            WHERE r.name = :role_name AND p.name = :permission_name
                        """), {'role_name': role_name, 'permission_name': permission_name})
                
                logger.info("RBAC data seeded successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed RBAC data: {e}")
            return False
    
    def seed_catalog_data(self) -> bool:
        """Seed catalog data (artists, labels, genres)."""
        try:
            with self.engine.begin() as conn:
                # Insert sample artists
                artists_data = [
                    {'name': 'Daft Punk'},
                    {'name': 'Deadmau5'},
                    {'name': 'Calvin Harris'},
                    {'name': 'Skrillex'},
                    {'name': 'Avicii'},
                    {'name': 'David Guetta'},
                    {'name': 'Tiësto'},
                    {'name': 'Armin van Buuren'},
                    {'name': 'Martin Garrix'},
                    {'name': 'Swedish House Mafia'},
                    {'name': 'The Chainsmokers'},
                    {'name': 'Marshmello'},
                    {'name': 'Diplo'},
                    {'name': 'Zedd'},
                    {'name': 'Porter Robinson'}
                ]
                
                for artist in artists_data:
                    conn.execute(text("""
                        INSERT IGNORE INTO artists (name) VALUES (:name)
                    """), artist)
                
                # Insert sample labels
                labels_data = [
                    {'name': 'Spinnin\' Records', 'website': 'https://spinninrecords.com'},
                    {'name': 'Armada Music', 'website': 'https://armadamusic.com'},
                    {'name': 'Monstercat', 'website': 'https://monstercat.com'},
                    {'name': 'OWSLA', 'website': 'https://owsla.com'},
                    {'name': 'Anjunabeats', 'website': 'https://anjunabeats.com'},
                    {'name': 'Revealed Recordings', 'website': 'https://revealedrecordings.com'},
                    {'name': 'Protocol Recordings', 'website': 'https://protocolrecordings.com'},
                    {'name': 'Axtone', 'website': 'https://axtone.com'},
                    {'name': 'Size Records', 'website': 'https://sizerecords.com'},
                    {'name': 'Mau5trap', 'website': 'https://mau5trap.com'}
                ]
                
                for label in labels_data:
                    conn.execute(text("""
                        INSERT IGNORE INTO labels (name, website) VALUES (:name, :website)
                    """), label)
                
                # Insert sample genres
                genres_data = [
                    {'name': 'House'},
                    {'name': 'Progressive House'},
                    {'name': 'Deep House'},
                    {'name': 'Tech House'},
                    {'name': 'Electro House'},
                    {'name': 'Trance'},
                    {'name': 'Progressive Trance'},
                    {'name': 'Uplifting Trance'},
                    {'name': 'Dubstep'},
                    {'name': 'Future Bass'},
                    {'name': 'Trap'},
                    {'name': 'Drum & Bass'},
                    {'name': 'Techno'},
                    {'name': 'Ambient'},
                    {'name': 'Chillout'}
                ]
                
                for genre in genres_data:
                    conn.execute(text("""
                        INSERT IGNORE INTO genres (name) VALUES (:name)
                    """), genre)
                
                logger.info("Catalog data seeded successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed catalog data: {e}")
            return False
    
    def seed_sample_tracks(self) -> bool:
        """Seed sample tracks and albums."""
        try:
            with self.engine.begin() as conn:
                # Create sample albums first
                albums_data = [
                    {'artist_name': 'Daft Punk', 'title': 'Random Access Memories', 'release_date': '2013-05-17'},
                    {'artist_name': 'Deadmau5', 'title': 'Random Album Title', 'release_date': '2014-09-02'},
                    {'artist_name': 'Calvin Harris', 'title': '18 Months', 'release_date': '2012-10-26'},
                    {'artist_name': 'Skrillex', 'title': 'Recess', 'release_date': '2014-03-18'},
                    {'artist_name': 'Avicii', 'title': 'True', 'release_date': '2013-09-13'}
                ]
                
                for album in albums_data:
                    conn.execute(text("""
                        INSERT IGNORE INTO albums (artist_id, title, release_date)
                        SELECT a.id, :title, :release_date
                        FROM artists a WHERE a.name = :artist_name
                    """), album)
                
                # Create sample tracks
                tracks_data = [
                    {
                        'title': 'Get Lucky',
                        'artist_name': 'Daft Punk',
                        'album_title': 'Random Access Memories',
                        'genre_name': 'House',
                        'label_name': 'Columbia Records',
                        'year': 2013,
                        'duration_sec': 367,
                        'bpm': 116,
                        'musical_key': 'Bm',
                        'file_path': '/audio/daft_punk_get_lucky.mp3'
                    },
                    {
                        'title': 'Strobe',
                        'artist_name': 'Deadmau5',
                        'album_title': 'Random Album Title',
                        'genre_name': 'Progressive House',
                        'label_name': 'Mau5trap',
                        'year': 2014,
                        'duration_sec': 634,
                        'bpm': 128,
                        'musical_key': 'C#m',
                        'file_path': '/audio/deadmau5_strobe.mp3'
                    },
                    {
                        'title': 'Feel So Close',
                        'artist_name': 'Calvin Harris',
                        'album_title': '18 Months',
                        'genre_name': 'Electro House',
                        'label_name': 'Columbia Records',
                        'year': 2012,
                        'duration_sec': 334,
                        'bpm': 132,
                        'musical_key': 'Am',
                        'file_path': '/audio/calvin_harris_feel_so_close.mp3'
                    },
                    {
                        'title': 'Bangarang',
                        'artist_name': 'Skrillex',
                        'album_title': 'Recess',
                        'genre_name': 'Dubstep',
                        'label_name': 'OWSLA',
                        'year': 2014,
                        'duration_sec': 215,
                        'bpm': 110,
                        'musical_key': 'Gm',
                        'file_path': '/audio/skrillex_bangarang.mp3'
                    },
                    {
                        'title': 'Levels',
                        'artist_name': 'Avicii',
                        'album_title': 'True',
                        'genre_name': 'Progressive House',
                        'label_name': 'LE7ELS',
                        'year': 2013,
                        'duration_sec': 202,
                        'bpm': 126,
                        'musical_key': 'C#m',
                        'file_path': '/audio/avicii_levels.mp3'
                    }
                ]
                
                for track in tracks_data:
                    track_uuid = str(uuid.uuid4())
                    
                    # Insert track
                    conn.execute(text("""
                        INSERT IGNORE INTO tracks (
                            uuid, album_id, label_id, genre_id, title, year, 
                            duration_sec, bpm, musical_key, file_path, file_size
                        )
                        SELECT 
                            :uuid,
                            alb.id,
                            l.id,
                            g.id,
                            :title,
                            :year,
                            :duration_sec,
                            :bpm,
                            :musical_key,
                            :file_path,
                            :file_size
                        FROM albums alb
                        LEFT JOIN labels l ON l.name = :label_name
                        LEFT JOIN genres g ON g.name = :genre_name
                        WHERE alb.title = :album_title
                    """), {
                        **track,
                        'uuid': track_uuid,
                        'file_size': 5242880  # 5MB placeholder
                    })
                    
                    # Link track to artist
                    conn.execute(text("""
                        INSERT IGNORE INTO track_artists (track_id, artist_id)
                        SELECT t.id, a.id
                        FROM tracks t, artists a
                        WHERE t.uuid = :uuid AND a.name = :artist_name
                    """), {'uuid': track_uuid, 'artist_name': track['artist_name']})
                
                logger.info("Sample tracks seeded successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed sample tracks: {e}")
            return False
    
    def seed_sample_feedback(self) -> bool:
        """Seed sample feedback and contact data."""
        try:
            with self.engine.begin() as conn:
                # Sample feedback entries
                feedback_data = [
                    {
                        'user_id': str(uuid.uuid4()),
                        'category': 'performance',
                        'message': 'The similarity search is very accurate and fast!',
                        'satisfaction': 9,
                        'recommendation': 8,
                        'status': 'resolved'
                    },
                    {
                        'user_id': str(uuid.uuid4()),
                        'category': 'feature_request',
                        'message': 'Would love to see more genre filters in search.',
                        'satisfaction': 7,
                        'recommendation': 8,
                        'status': 'open'
                    },
                    {
                        'user_id': None,  # Anonymous feedback
                        'category': 'bug_report',
                        'message': 'Sometimes the metadata extraction fails for certain file types.',
                        'satisfaction': 6,
                        'recommendation': 7,
                        'status': 'open'
                    }
                ]
                
                for feedback in feedback_data:
                    conn.execute(text("""
                        INSERT INTO feedback (user_id, category, message, satisfaction, recommendation, status)
                        VALUES (:user_id, :category, :message, :satisfaction, :recommendation, :status)
                    """), feedback)
                
                # Sample contact entries
                contact_data = [
                    {
                        'user_id': str(uuid.uuid4()),
                        'name': 'John Doe',
                        'email': 'john.doe@example.com',
                        'subject': 'API Integration Question',
                        'phone': '+1-555-0123',
                        'message': 'Hi, I\'m interested in integrating your API into my music app. Can you provide more details about rate limits?',
                        'status': 'open'
                    },
                    {
                        'user_id': None,  # Anonymous contact
                        'name': 'Jane Smith',
                        'email': 'jane.smith@musicstudio.com',
                        'subject': 'Business Partnership',
                        'phone': '+1-555-0456',
                        'message': 'We run a music production studio and would like to discuss potential partnership opportunities.',
                        'status': 'resolved'
                    }
                ]
                
                for contact in contact_data:
                    conn.execute(text("""
                        INSERT INTO contact (user_id, name, email, subject, phone, message, status)
                        VALUES (:user_id, :name, :email, :subject, :phone, :message, :status)
                    """), contact)
                
                logger.info("Sample feedback and contact data seeded successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed feedback data: {e}")
            return False
    
    def seed_all(self) -> bool:
        """Seed all sample data."""
        logger.info("Starting database seeding...")
        
        success = True
        success &= self.seed_rbac_data()
        success &= self.seed_catalog_data()
        success &= self.seed_sample_tracks()
        success &= self.seed_sample_feedback()
        
        if success:
            logger.info("All sample data seeded successfully!")
        else:
            logger.error("Some seeding operations failed")
        
        return success
    
    def clear_all_data(self) -> bool:
        """Clear all data from tables (for testing)."""
        try:
            with self.engine.begin() as conn:
                # Disable foreign key checks temporarily
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
                
                # Clear all tables in reverse dependency order
                tables = [
                    'track_artists', 'playlist_tracks', 'track_ratings', 'playlist_ratings',
                    'purchases', 'user_subscriptions', 'logs', 'feedback', 'contact',
                    'tracks', 'albums', 'playlists', 'artists', 'labels', 'genres',
                    'role_permissions', 'user_roles', 'roles', 'permissions'
                ]
                
                for table in tables:
                    conn.execute(text(f"DELETE FROM {table}"))
                    logger.info(f"Cleared table: {table}")
                
                # Re-enable foreign key checks
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                
                logger.info("All data cleared successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to clear data: {e}")
            return False


def main():
    """CLI interface for seeding operations."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python seed_data.py <command>")
        print("Commands:")
        print("  seed-all      - Seed all sample data")
        print("  seed-rbac     - Seed RBAC data only")
        print("  seed-catalog  - Seed catalog data only")
        print("  seed-tracks   - Seed sample tracks only")
        print("  seed-feedback - Seed feedback data only")
        print("  clear-all     - Clear all data (WARNING: destructive)")
        return
    
    seeder = SeedDataManager()
    command = sys.argv[1]
    
    try:
        if command == "seed-all":
            success = seeder.seed_all()
        elif command == "seed-rbac":
            success = seeder.seed_rbac_data()
        elif command == "seed-catalog":
            success = seeder.seed_catalog_data()
        elif command == "seed-tracks":
            success = seeder.seed_sample_tracks()
        elif command == "seed-feedback":
            success = seeder.seed_sample_feedback()
        elif command == "clear-all":
            confirm = input("This will delete ALL data. Type 'yes' to confirm: ")
            if confirm.lower() == 'yes':
                success = seeder.clear_all_data()
            else:
                print("Operation cancelled")
                return
        else:
            print(f"Unknown command: {command}")
            sys.exit(1)
        
        sys.exit(0 if success else 1)
        
    except Exception as e:
        logger.error(f"Command failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 