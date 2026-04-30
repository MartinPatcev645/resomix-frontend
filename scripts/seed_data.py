"""
Database Seeding Utilities
===========================

This module contains utilities for seeding the MariaDB database with initial data
for the Resomix project. It provides functions for populating
test data, reference data, and sample content for the fresh normalized schema.

Version: 4.0.0
"""

import uuid
import logging
import json
import os
import random
from pathlib import Path
from datetime import datetime, timedelta, date
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from database.connection import engine
from app.core.security import hash_password

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SeedDataManager:
    """Manages database seeding operations with sample data."""
    
    def __init__(self):
        self.engine = engine
    
    def _hash_password(self, password: str) -> str:
        """Hash password using application security context (bcrypt)."""
        return hash_password(password)

    def seed_rbac_data(self) -> bool:
        """Seed RBAC (roles, permissions, and relationships)."""
        try:
            with self.engine.begin() as conn:
                # 1. Insert roles
                roles = [
                    ('admin', 'System administrator with full access'),
                    ('listener', 'Standard user with basic playback and playlist features'),
                    ('creator', 'User who can upload and manage content'),
                    ('distributor', 'B2B partner with access to reports and ingestion')
                ]
                for name, desc in roles:
                    conn.execute(text("INSERT IGNORE INTO roles (name, description) VALUES (:name, :desc)"), {'name': name, 'desc': desc})

                # 2. Insert core permissions
                perms = [
                    ('track.view', 'View tracks'),
                    ('track.stream', 'Stream audio'),
                    ('track.download', 'Download tracks'),
                    ('admin.all', 'Root access')
                ]
                for name, desc in perms:
                    conn.execute(text("INSERT IGNORE INTO permissions (name, description) VALUES (:name, :desc)"), {'name': name, 'desc': desc})

                # 3. Assign all perms to admin
                conn.execute(text("""
                    INSERT IGNORE INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin'
                """))
                
                logger.info("✓ RBAC data seeded")
                return True
        except Exception as e:
            logger.error(f"Failed to seed RBAC: {e}")
            return False

    def seed_users(self) -> bool:
        """Seed Admin and John Doe flow."""
        try:
            with self.engine.begin() as conn:
                # 1. Admin User
                admin_uuid = str(uuid.uuid4())
                conn.execute(text("""
                    INSERT INTO users (uuid, username, email, password_hash, name, is_email_verified)
                    VALUES (:uuid, 'admin', 'admin@resomix.com', :pw, 'System Admin', 1)
                """), {'uuid': admin_uuid, 'pw': self._hash_password('Admin@123')})

                # 2. John Doe (Standard User)
                john_uuid = 'user-001-uuid-abcd'
                conn.execute(text("""
                    INSERT INTO users (uuid, username, email, password_hash, name, is_email_verified, stripe_customer_id)
                    VALUES (:uuid, 'john_doe', 'john@example.com', :pw, 'John Doe', 1, 'cus_Qwert123')
                """), {'uuid': john_uuid, 'pw': self._hash_password('User@123')})

                # Assign roles
                conn.execute(text("""
                    INSERT IGNORE INTO user_roles (user_id, role_id)
                    SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'admin' AND r.name = 'admin'
                """))
                conn.execute(text("""
                    INSERT IGNORE INTO user_roles (user_id, role_id)
                    SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'john_doe' AND r.name = 'listener'
                """))

                # Seed John's verification token history
                john_id = conn.execute(text("SELECT id FROM users WHERE username = 'john_doe'")).scalar()
                conn.execute(text("""
                    INSERT IGNORE INTO user_tokens (user_id, token, token_type, expires_at)
                    VALUES (:uid, 'verify_token_xyz123', 'email_verification', :exp)
                """), {'uid': john_id, 'exp': datetime.now() + timedelta(days=1)})

                # Seed John's active session
                conn.execute(text("""
                    INSERT IGNORE INTO user_sessions (user_id, session_id, user_agent, ip_address, expires_at)
                    VALUES (:uid, 'sess-unique-001', 'Mozilla/5.0...', '192.168.1.1', :exp)
                """), {'uid': john_id, 'exp': datetime.now() + timedelta(days=30)})

                user_count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
                logger.info(f"✓ Users and Auth flow seeded ({user_count} users)")
                return True
        except Exception as e:
            logger.error(f"Failed to seed users: {e}")
            return False

    def seed_catalog_data(self) -> bool:
        """Seed the 10 tracks, releases, artists, and labels."""
        try:
            with self.engine.begin() as conn:
                # 1. Parties
                conn.execute(text("INSERT INTO parties (party_id, party_name, dpid) VALUES ('DIST_001', 'Global Beats Distribution', 'DPID12345')"))

                # 2. Ingest Log
                conn.execute(text("""
                    INSERT INTO ingest_log (party_id, package_folder, batch_filename, status) 
                    VALUES ('DIST_001', 'ERN_2026_COLLECTION_001', 'ERN_2026_COLLECTION_001.xml', 'COMPLETED')
                """))
                ingest_id = conn.execute(text("SELECT id FROM ingest_log WHERE batch_filename = 'ERN_2026_COLLECTION_001.xml'")).scalar()

                # 3. Messages (Required for Releases)
                for i in range(1, 4):
                    conn.execute(text("""
                        INSERT INTO messages (message_id, party_id, ingest_log_id, message_type, created_at) 
                        VALUES (:mid, 'DIST_001', :log_id, 'NewReleaseMessage', CURRENT_TIMESTAMP)
                    """), {'mid': f'MSG_REF_00{i}', 'log_id': ingest_id})
                
                # 4. Labels
                conn.execute(text("INSERT INTO labels (party_id, label_name, label_type) VALUES ('DIST_001', 'Echo Chamber Records', 'RecordLabel')"))
                conn.execute(text("INSERT INTO labels (party_id, label_name, label_type) VALUES ('DIST_001', 'Neon Horizon Music', 'RecordLabel')"))
                
                # 3. Artists
                artists = [
                    ('Solaris Collective', 'MainArtist'),
                    ('Luna Drift', 'MainArtist'),
                    ('Ghost Producer X', 'Producer'),
                    ('Nova Vox', 'FeaturedArtist')
                ]
                for name, atype in artists:
                    conn.execute(text("INSERT IGNORE INTO artists (party_id, full_name, artist_type) VALUES ('DIST_001', :name, :atype)"), {'name': name, 'atype': atype})

                # 4. Releases
                # We need IDs for these, so we'll fetch or set them
                conn.execute(text("""
                    INSERT INTO releases (id, party_id, title, release_type, label_id, artist_id, message_id)
                    VALUES (1, 'DIST_001', 'Atmospheres Vol. 1', 'Album', 1, 1, 'MSG_REF_001'),
                           (2, 'DIST_001', 'Midnight City', 'Single', 2, 2, 'MSG_REF_002'),
                           (3, 'DIST_001', 'The Remixes EP', 'EP', 1, 1, 'MSG_REF_003')
                """))

                # 5. Genres
                for g in ['Melodic Techno', 'Progressive House', 'Deep House', 'Trance', 'Synthwave', 'Techno', 'Ambient']:
                    conn.execute(text("INSERT IGNORE INTO genres (name) VALUES (:name)"), {'name': g})

                # 6. Tracks (The 10 Tracks)
                tracks = [
                    (1, 'Celestial Drift', 'QM-XXX-24-00001', 1, 124, 'Am', 345, 'Melodic Techno'),
                    (2, 'Solar Wind', 'QM-XXX-24-00002', 1, 126, 'C#m', 412, 'Progressive House'),
                    (3, 'Event Horizon', 'QM-XXX-24-00003', 1, 122, 'F', 388, 'Deep House'),
                    (4, 'Nebula Pulse', 'QM-XXX-24-00004', 1, 128, 'G', 320, 'Trance'),
                    (5, 'Midnight City (Original Mix)', 'QM-XXX-24-00005', 2, 124, 'Bm', 360, 'Synthwave'),
                    (6, 'Midnight City (Radio Edit)', 'QM-XXX-24-00006', 2, 124, 'Bm', 210, 'Synthwave'),
                    (7, 'Celestial Drift (Ghost Producer X Remix)', 'QM-XXX-24-00007', 3, 130, 'Am', 430, 'Techno'),
                    (8, 'Solar Wind (Dub Version)', 'QM-XXX-24-00008', 3, 126, 'C#m', 400, 'Progressive House'),
                    (9, 'Ether', 'QM-XXX-24-00009', 3, 120, 'D', 300, 'Ambient'),
                    (10, 'Final Frontier', 'QM-XXX-24-00010', 3, 124, 'Em', 380, 'Melodic Techno')
                ]
                for tid, title, isrc, rid, bpm, mkey, dur, genre in tracks:
                    conn.execute(text("""
                        INSERT INTO tracks (id, uuid, release_id, party_id, isrc, title, bpm, musical_key, duration_seconds, track_type, file_path)
                        VALUES (:id, :uuid, :rid, 'DIST_001', :isrc, :title, :bpm, :mkey, :dur, 'electrobuzz', :path)
                    """), {'id': tid, 'uuid': str(uuid.uuid4()), 'rid': rid, 'isrc': isrc, 'title': title, 'bpm': bpm, 'mkey': mkey, 'dur': dur, 'path': f'/storage/tracks/{tid:05d}.wav'})

                # 7. Recording Artists (Mappings)
                mappings = [
                    (1, 1), (2, 1), (2, 4), (3, 1), (4, 1), (5, 2), (6, 2), (7, 1), (7, 3), (8, 1), (9, 2), (10, 1), (10, 2)
                ]
                for tid, aid in mappings:
                    conn.execute(text("INSERT IGNORE INTO recording_artists (track_id, artist_id) VALUES (:tid, :aid)"), {'tid': tid, 'aid': aid})

                # 8. Track Formats
                for tid in range(1, 11):
                    conn.execute(text("INSERT IGNORE INTO track_formats (track_id, audio_format, price_cents, file_path) VALUES (:tid, 'mp3', 199, :path)"), {'tid': tid, 'path': f'/storage/tracks/{tid:05d}.mp3'})
                    if tid != 6: # Track 6 is MP3 only in reference
                        conn.execute(text("INSERT IGNORE INTO track_formats (track_id, audio_format, price_cents, file_path) VALUES (:tid, 'wav', 299, :path)"), {'tid': tid, 'path': f'/storage/tracks/{tid:05d}.wav'})

                track_count = conn.execute(text("SELECT COUNT(*) FROM tracks")).scalar()
                logger.info(f"✓ Catalog data seeded ({track_count} tracks)")
                return True
        except Exception as e:
            logger.error(f"Failed to seed catalog: {e}")
            return False

    def seed_engagement_data(self) -> bool:
        """Seed Playlists and User Interactions."""
        try:
            with self.engine.begin() as conn:
                # 1. Playlist
                conn.execute(text("""
                    INSERT IGNORE INTO playlists (id, uuid, user_id, name, is_public, playlist_type)
                    VALUES (1, 'plist-001', (SELECT id FROM users WHERE username='john_doe'), 'Techno Summer 2026', 1, 'custom')
                """))
                
                # 2. Playlist Tracks
                for tid in range(1, 11):
                    conn.execute(text("INSERT IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (1, :tid, :pos)"), {'tid': tid, 'pos': float(tid)})

                # 3. Engagements
                john_id = conn.execute(text("SELECT id FROM users WHERE username='john_doe'")).scalar()
                conn.execute(text("INSERT IGNORE INTO user_playlist_engagements (user_id, playlist_id, is_following) VALUES (:uid, 1, 1)"), {'uid': john_id})
                conn.execute(text("INSERT IGNORE INTO track_ratings (user_id, track_id, rating) VALUES (:uid, 1, 5)"), {'uid': john_id})

                logger.info("✓ Engagement data seeded")
                return True
        except Exception as e:
            logger.error(f"Failed to seed engagement: {e}")
            return False

    def seed_telemetry_data(self) -> bool:
        """Seed Consumption Events (Telemetry)."""
        try:
            with self.engine.begin() as conn:
                john_id = conn.execute(text("SELECT id FROM users WHERE username='john_doe'")).scalar()
                track_id = conn.execute(text("SELECT id FROM tracks LIMIT 1")).scalar()
                
                if not track_id:
                    logger.warning("⚠️ No tracks found to seed telemetry. Skipping.")
                    return True

                # Stream event
                conn.execute(text("""
                    INSERT INTO consumption_events (event_category, track_id, user_id, client_ip, source_device, duration_seconds)
                    VALUES ('stream_complete', :tid, :uid, '192.168.1.1', 'web', 345)
                """), {'uid': john_id, 'tid': track_id})
                # Download event
                conn.execute(text("""
                    INSERT INTO consumption_events (event_category, track_id, user_id, country_code, duration_seconds)
                    VALUES ('download_success', :tid, :uid, 'US', 0)
                """), {'uid': john_id, 'tid': track_id})

                logger.info("✓ Telemetry data seeded")
                return True
        except Exception as e:
            logger.error(f"Failed to seed telemetry: {e}")
            return False

    def seed_admin_data(self) -> bool:
        """Seed Feedback, Contact, and Logs."""
        try:
            with self.engine.begin() as conn:
                john_id = conn.execute(text("SELECT id FROM users WHERE username='john_doe'")).scalar()
                
                # Feedback
                conn.execute(text("""
                    INSERT INTO feedback (user_id, category, message, satisfaction, status)
                    VALUES (:uid, 'feature_request', 'Would love a Dark Mode for the player!', 9, 'open')
                """), {'uid': john_id})
                
                # Contact
                conn.execute(text("""
                    INSERT INTO contact (name, email, subject, message, status)
                    VALUES ('Jane Smith', 'jane.smith@example.com', 'Support', 'I can''t reset my password.', 'open')
                """))

                # Ingestion Log (System Log)
                conn.execute(text("""
                    INSERT INTO system_logs (level, category, action, message, log_metadata)
                    VALUES ('INFO', 'ingestion', 'package_processed', 'ERN_20240430_GLOBAL_001.zip processed successfully', :meta)
                """), {'meta': json.dumps({"track_count": 10, "message_id": "MSG_82374982374"})})

                logger.info("✓ Admin and Support data seeded")
                return True
        except Exception as e:
            logger.error(f"Failed to seed admin data: {e}")
            return False

    def seed_all(self) -> bool:
        """Seed everything in order."""
        logger.info("🚀 Starting Database Seeding...")
        
        # 0. Clear existing data to ensure fresh start
        logger.info("🔄 Clearing existing data...")
        if not self.clear_all_data(): return False

        # 1. RBAC
        if not self.seed_rbac_data(): return False
        
        # 2. Users
        if not self.seed_users(): return False
        
        # 3. Catalog
        if not self.seed_catalog_data(): return False
        
        # 4. Engagements
        if not self.seed_engagement_data(): return False
        
        # 5. Telemetry
        if not self.seed_telemetry_data(): return False
        
        # 6. Admin
        if not self.seed_admin_data(): return False

        logger.info("🎉 Database Seeding Completed Successfully!")
        return True

    def clear_all_data(self) -> bool:
        """Clear all data (destructive)."""
        try:
            with self.engine.begin() as conn:
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
                # List of tables to clear
                tables = [
                    'acr_infringement_logs', 'label_payouts', 'generated_reports', 
                    'consumption_events', 'manual_takedowns', 'ingestion_errors', 
                    'sftp_users', 'user_spotify_apps', 'spotify_apps', 
                    'user_operation_limits', 'operation_types', 'contact', 'feedback', 
                    'system_logs', 'cart_items', 'carts', 'user_subscriptions', 
                    'purchases', 'orders', 'track_formats', 'promo_codes', 
                    'waitlist', 'playlist_ratings', 'track_ratings', 
                    'user_track_engagements', 'user_playlist_engagements', 
                    'playlist_transfer_tracks', 'playlist_tracks', 'playlists', 
                    'publisher_shares', 'recording_contributors', 'contributors', 
                    'resources', 'release_deals', 'royalty_rates', 'deal_use_types', 
                    'deal_territories', 'deals', 'recording_artists', 'tracks', 
                    'release_artists', 'releases', 'labels', 'artists', 
                    'messages', 'ingest_log', 'parties', 'genres', 
                    'user_roles', 'role_permissions', 'permissions', 'roles', 
                    'user_auth_providers', 'user_sessions', 'user_tokens', 'users',
                    'rights_controllers'
                ]
                for t in tables:
                    conn.execute(text(f"TRUNCATE TABLE {t}"))
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                logger.info("🗑️ All data cleared.")
                return True
        except Exception as e:
            logger.error(f"Failed to clear data: {e}")
            return False


def main():
    import sys
    seeder = SeedDataManager()
    
    if len(sys.argv) < 2:
        print("Usage: python scripts/seed_data.py [seed-all | clear-all]")
        return

    command = sys.argv[1]
    if command == "seed-all":
        seeder.seed_all()
    elif command == "clear-all":
        confirm = input("⚠️ This will DELETE everything. Type 'yes' to confirm: ")
        if confirm.lower() == 'yes':
            seeder.clear_all_data()
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()
