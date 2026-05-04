"""
Database Seeding Utilities (High Fidelity)
=========================================

This module contains utilities for seeding the MariaDB database with initial data
matching the updated normalized schema and the 03_seed_data_blueprint.md.

Version: 4.2.0
Author: Antigravity
"""

import uuid
import logging
import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

# Ensure current directory is in path for imports
sys.path.append(os.getcwd())

from database.connection import engine
from app.core.security import hash_password

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SeedDataManager:
    """Manages database seeding operations with high-fidelity sample data."""
    
    def __init__(self):
        self.engine = engine
    
    def _hash_password(self, password: str) -> str:
        """Hash password using application security context (bcrypt)."""
        return hash_password(password)

    def clear_all_data(self) -> bool:
        """Clear all data (destructive)."""
        logger.info("🗑️ Clearing existing data...")
        try:
            with self.engine.begin() as conn:
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
                # List of tables to clear (ordered for safety)
                tables = [
                    'consumption_events', 'manual_takedowns', 'ingestion_errors', 
                    'sftp_users', 'user_spotify_apps', 'spotify_apps', 
                    'user_operation_limits', 'operation_types', 'contact', 'feedback', 
                    'system_logs', 'cart_items', 'carts', 'user_subscriptions', 
                    'purchases', 'orders', 'track_formats', 'promo_codes', 
                    'waitlist', 'playlist_ratings', 'track_ratings', 
                    'user_track_engagements', 'user_playlist_engagements', 
                    'playlist_transfer_tracks', 'playlist_tracks', 'playlists', 
                    'publisher_shares', 'track_contributors', 'contributors', 
                    'release_deals', 'royalty_rates', 'deals', 'release_tracks', 
                    'release_contributors', 'releases', 'audio_files', 'image_files',
                    'labels', 'messages', 'ingest_log', 'parties', 'genres', 
                    'user_roles', 'role_permissions', 'permissions', 'roles', 
                    'user_auth_providers', 'user_sessions', 'user_tokens', 'users'
                ]
                for t in tables:
                    try:
                        conn.execute(text(f"TRUNCATE TABLE {t}"))
                    except Exception as te:
                        logger.warning(f"Could not truncate {t}: {te}")
                
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                logger.info("✓ All data cleared.")
                return True
        except Exception as e:
            logger.error(f"Failed to clear data: {e}")
            return False

    def seed_rbac(self) -> bool:
        """Seed roles and permissions."""
        logger.info("🔐 Seeding RBAC...")
        try:
            with self.engine.begin() as conn:
                # 1. Roles
                roles = [
                    ('admin', 'System administrator with full access'),
                    ('listener', 'Standard user with basic playback and playlist features'),
                    ('creator', 'User who can upload and manage content'),
                    ('distributor', 'B2B partner with access to reports and ingestion')
                ]
                for name, desc in roles:
                    conn.execute(text("INSERT IGNORE INTO roles (name, description) VALUES (:name, :desc)"), {'name': name, 'desc': desc})

                # 2. Permissions
                perms = [
                    ('track.view', 'View tracks'),
                    ('track.stream', 'Stream audio'),
                    ('track.download', 'Download tracks'),
                    ('admin.all', 'Root access')
                ]
                for name, desc in perms:
                    conn.execute(text("INSERT IGNORE INTO permissions (name, description) VALUES (:name, :desc)"), {'name': name, 'desc': desc})

                # 3. Role-Permission mappings
                conn.execute(text("""
                    INSERT IGNORE INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin'
                """))
                return True
        except Exception as e:
            logger.error(f"Failed to seed RBAC: {e}")
            return False

    def seed_parties_and_labels(self) -> bool:
        """Seed Parties and Labels."""
        logger.info("🏢 Seeding Parties and Labels...")
        try:
            with self.engine.begin() as conn:
                # 1. Party
                conn.execute(text("""
                    INSERT INTO parties (party_id, party_name, dpid, is_active)
                    VALUES ('ARGO_01', 'ArgoRhythm', 'DPID_ARGO_001', 1)
                """))
                
                # 2. Labels
                conn.execute(text("""
                    INSERT INTO labels (id, party_id, label_name, label_type)
                    VALUES (1, 'ARGO_01', 'Argo Deep', 'RecordLabel'),
                           (2, 'ARGO_01', 'Argo Techno', 'RecordLabel')
                """))
                return True
        except Exception as e:
            logger.error(f"Failed to seed parties/labels: {e}")
            return False

    def seed_genres(self) -> bool:
        """Seed Genres."""
        logger.info("🎸 Seeding Genres...")
        try:
            with self.engine.begin() as conn:
                genres = [
                    (1, 'Electronic', None),
                    (2, 'Progressive', 1),
                    (3, 'Techno', 1),
                    (4, 'Ambient', 1)
                ]
                for gid, name, pid in genres:
                    conn.execute(text("INSERT INTO genres (id, name, parent_id) VALUES (:id, :name, :pid)"), 
                                 {'id': gid, 'name': name, 'pid': pid})
                return True
        except Exception as e:
            logger.error(f"Failed to seed genres: {e}")
            return False

    def seed_ingestion_chain(self) -> bool:
        """Seed IngestLog, Messages, and Deals."""
        logger.info("📦 Seeding Ingestion Chain...")
        try:
            with self.engine.begin() as conn:
                # 1. Ingest Log
                conn.execute(text("""
                    INSERT INTO ingest_log (id, party_id, package_folder, status)
                    VALUES (1, 'ARGO_01', '/sftp/argo/batch_001', 'COMPLETED')
                """))
                
                # 2. Message
                conn.execute(text("""
                    INSERT INTO messages (id, ingest_log_id, party_id, message_id, message_type, ddex_version)
                    VALUES (1, 1, 'ARGO_01', 'MSG_2026_001', 'ERN', '4.3')
                """))
                
                # 3. Deal
                conn.execute(text("""
                    INSERT INTO deals (id, party_id, message_id, deal_ref, commercial_model, is_perpetual)
                    VALUES (1, 'ARGO_01', 'MSG_2026_001', 'DEAL_001', 'PayAsYouGoModel', 1)
                """))
                return True
        except Exception as e:
            logger.error(f"Failed to seed ingestion chain: {e}")
            return False

    def seed_catalog(self) -> bool:
        """Seed Contributors, Releases, and Tracks."""
        logger.info("🎵 Seeding Catalog (20 tracks)...")
        try:
            with self.engine.begin() as conn:
                # 1. Contributors
                contributors = [
                    (1, 'ARGO_01', 'Alpha Base', '0000000123456789'),
                    (2, 'ARGO_01', 'Neon Pulse', '0000000987654321'),
                    (3, 'ARGO_01', 'Dr. Synth', '0000000000000000'),
                    (4, 'ARGO_01', 'Stellar', '0000000111111111'),
                    (5, 'ARGO_01', 'Orbit', '0000000222222222')
                ]
                for cid, pid, name, isni in contributors:
                    conn.execute(text("INSERT INTO contributors (id, party_id, full_name, isni) VALUES (:id, :pid, :name, :isni)"),
                                 {'id': cid, 'pid': pid, 'name': name, 'isni': isni})
                
                # 2. Releases
                releases = [
                    (1, 1, 'ARGO_01', 'MSG_2026_001', '111111111111', 'Deep Space', 'Album'),
                    (2, 2, 'ARGO_01', 'MSG_2026_001', '222222222222', 'Techno Pulse', 'EP'),
                    (3, 1, 'ARGO_01', 'MSG_2026_001', '333333333333', 'Neon Night', 'Single')
                ]
                for rid, lid, pid, mid, upc, title, rtype in releases:
                    conn.execute(text("""
                        INSERT INTO releases (id, label_id, party_id, message_id, upc_ean, title, release_type)
                        VALUES (:id, :lid, :pid, :mid, :upc, :title, :rtype)
                    """), {'id': rid, 'lid': lid, 'pid': pid, 'mid': mid, 'upc': upc, 'title': title, 'rtype': rtype})
                
                # 3. Tracks
                tracks_data = [
                    (1, '550e8400-e29b-41d4-a716-446655440000', 'US-AR1-26-00001', 'Void Explorer', 300000, 124, 'Am', 'Original Mix', 'Techno'),
                    (2, '550e8400-e29b-41d4-a716-446655440001', 'US-AR1-26-00002', 'Gravity Well', 240000, 128, 'C#m', 'Original Mix', 'Techno'),
                    (3, '550e8400-e29b-41d4-a716-446655440002', 'US-AR1-26-00003', 'Event Horizon', 320000, 122, 'Dm', 'Extended Mix', 'Progressive'),
                    (4, '550e8400-e29b-41d4-a716-446655440003', 'US-AR1-26-00004', 'Nebula Drift', 180000, 110, 'Fmaj', 'Original Mix', 'Ambient'),
                    (5, '550e8400-e29b-41d4-a716-446655440004', 'US-AR1-26-00005', 'Pulsar Beats', 210000, 126, 'G', 'Club Mix', 'Electronic'),
                    (6, '550e8400-e29b-41d4-a716-446655440005', 'US-AR1-26-00006', 'Solar Wind', 275000, 125, 'Am', 'Original Mix', 'Electronic'),
                    (7, '550e8400-e29b-41d4-a716-446655440006', 'US-AR1-26-00007', 'Dark Matter', 310000, 130, 'Bm', 'Dub Mix', 'Techno'),
                    (8, '550e8400-e29b-41d4-a716-446655440007', 'US-AR1-26-00008', 'Light Speed', 220000, 132, 'E', 'Original Mix', 'Electronic'),
                    (9, '550e8400-e29b-41d4-a716-446655440008', 'US-AR1-26-00009', 'Asteroid Belt', 195000, 128, 'Cm', 'Original Mix', 'Electronic'),
                    (10, '550e8400-e29b-41d4-a716-446655440009', 'US-AR1-26-00010', 'Galactic Core', 340000, 124, 'F#', 'Original Mix', 'Electronic'),
                    (11, '550e8400-e29b-41d4-a716-446655440010', 'US-AR1-26-00011', 'Supernova', 290000, 128, 'Am', '2026 Remaster', 'Electronic'),
                    (12, '550e8400-e29b-41d4-a716-446655440011', 'US-AR1-26-00012', 'Black Hole', 400000, 120, 'Em', 'Original Mix', 'Ambient'),
                    (13, '550e8400-e29b-41d4-a716-446655440012', 'US-AR1-26-00013', 'Techno Heart', 360000, 132, 'C', 'Original Mix', 'Techno'),
                    (14, '550e8400-e29b-41d4-a716-446655440013', 'US-AR1-26-00014', 'Digital Soul', 245000, 126, 'G#', 'Original Mix', 'Electronic'),
                    (15, '550e8400-e29b-41d4-a716-446655440014', 'US-AR1-26-00015', 'Neon Pulse', 230000, 122, 'D', 'Radio Edit', 'Electronic'),
                    (16, '550e8400-e29b-41d4-a716-446655440015', 'US-AR1-26-00016', 'Cyber Night', 215000, 118, 'B', 'Original Mix', 'Electronic'),
                    (17, '550e8400-e29b-41d4-a716-446655440016', 'US-AR1-26-00017', 'Silicon Dreams', 190000, 115, 'F', 'Original Mix', 'Electronic'),
                    (18, '550e8400-e29b-41d4-a716-446655440017', 'US-AR1-26-00018', 'Data Stream', 260000, 128, 'Am', 'Original Mix', 'Electronic'),
                    (19, '550e8400-e29b-41d4-a716-446655440018', 'US-AR1-26-00019', 'Logic Gate', 255000, 130, 'Dm', 'Original Mix', 'Electronic'),
                    (20, '550e8400-e29b-41d4-a716-446655440019', 'US-AR1-26-00020', 'End of Line', 300000, 124, 'C', 'Outro Mix', 'Electronic')
                ]
                
                for tid, tuid, isrc, title, dur, bpm, mkey, mix, genre in tracks_data:
                    conn.execute(text("""
                        INSERT INTO tracks (id, uuid, party_id, isrc, title, duration_ms, bpm, musical_key, mix_name, genre, price_cents)
                        VALUES (:id, :uuid, 'ARGO_01', :isrc, :title, :dur, :bpm, :mkey, :mix, :genre, 99)
                    """), {'id': tid, 'uuid': tuid, 'isrc': isrc, 'title': title, 'dur': dur, 'bpm': bpm, 'mkey': mkey, 'mix': mix, 'genre': genre})

                # 4. Track-Contributor Mapping
                # Assign Alpha Base (1) as MainArtist to all tracks
                for tid in range(1, 21):
                    conn.execute(text("INSERT INTO track_contributors (track_id, person_id, role, sequence_num) VALUES (:tid, 1, 'MainArtist', 1)"), {'tid': tid})
                
                # 5. Release-Track Mapping
                for tid in range(1, 13):
                    conn.execute(text("INSERT INTO release_tracks (release_id, track_id, sequence_num) VALUES (1, :tid, :seq)"), {'tid': tid, 'seq': tid})
                for tid in range(13, 17):
                    conn.execute(text("INSERT INTO release_tracks (release_id, track_id, sequence_num) VALUES (2, :tid, :seq)"), {'tid': tid, 'seq': tid-12})
                conn.execute(text("INSERT INTO release_tracks (release_id, track_id, sequence_num) VALUES (3, 17, 1)"))
                
                # 6. Audio Files
                # For Track 1
                conn.execute(text("""
                    INSERT INTO audio_files (party_id, ingest_log_id, track_id, asset_class, original_filename, stored_path, audio_codec)
                    VALUES ('ARGO_01', 1, 1, 'Master', 'master.flac', '/argo/trk1/master.flac', 'FLAC'),
                           ('ARGO_01', 1, 1, 'StreamingProfile', 'index.m3u8', '/argo/trk1/hls/index.m3u8', 'AAC')
                """))
                
                return True
        except Exception as e:
            logger.error(f"Failed to seed catalog: {e}")
            return False

    def seed_users(self) -> bool:
        """Seed Users and Roles."""
        logger.info("👤 Seeding Users...")
        try:
            with self.engine.begin() as conn:
                # 1. Admin
                admin_uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
                conn.execute(text("""
                    INSERT INTO users (id, uuid, username, email, password_hash, name, is_email_verified)
                    VALUES (1, :uuid, 'admin', 'dj@argo.fm', :pw, 'DJ Argo (Admin)', 1)
                """), {'uuid': admin_uuid, 'pw': self._hash_password('Admin@123')})
                
                # 2. Listener
                user_uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d480'
                conn.execute(text("""
                    INSERT INTO users (id, uuid, username, email, password_hash, name, is_email_verified)
                    VALUES (2, :uuid, 'listener_01', 'listener@resomix.com', :pw, 'Music Lover', 1)
                """), {'uuid': user_uuid, 'pw': self._hash_password('User@123')})
                
                # Assign Roles
                conn.execute(text("INSERT INTO user_roles (user_id, role_id) SELECT 1, id FROM roles WHERE name='admin'"))
                conn.execute(text("INSERT INTO user_roles (user_id, role_id) SELECT 2, id FROM roles WHERE name='listener'"))
                return True
        except Exception as e:
            logger.error(f"Failed to seed users: {e}")
            return False

    def seed_engagement(self) -> bool:
        """Seed Playlists and Tracks."""
        logger.info("📱 Seeding Engagement...")
        try:
            with self.engine.begin() as conn:
                # 1. Playlist
                conn.execute(text("""
                    INSERT INTO playlists (id, uuid, user_id, name, is_public, type)
                    VALUES (1, 'a623405c-18df-4835-8666-4d22384a5142', 1, 'Ultimate Argo Collection', 1, 'custom')
                """))
                
                # 2. Playlist Tracks
                for tid in [1, 2, 3, 5, 7]:
                    conn.execute(text("INSERT INTO playlist_tracks (playlist_id, track_id, position, score) VALUES (1, :tid, :pos, :score)"),
                                 {'tid': tid, 'pos': float(tid), 'score': 1.0 - (tid * 0.05)})
                return True
        except Exception as e:
            logger.error(f"Failed to seed engagement: {e}")
            return False

    def seed_commerce(self) -> bool:
        """Seed Orders and Purchases."""
        logger.info("💰 Seeding Commerce...")
        try:
            with self.engine.begin() as conn:
                # 1. Order
                conn.execute(text("""
                    INSERT INTO orders (id, user_id, subtotal_cents, total_cents, status)
                    VALUES (1, 2, 297, 297, 'paid')
                """))
                
                # 2. Purchases
                for tid in [1, 2, 13]:
                    conn.execute(text("""
                        INSERT INTO purchases (order_id, user_id, track_id, source_playlist_id, price_cents)
                        VALUES (1, 2, :tid, 1, 99)
                    """), {'tid': tid})
                return True
        except Exception as e:
            logger.error(f"Failed to seed commerce: {e}")
            return False

    def seed_telemetry(self) -> bool:
        """Seed Consumption Events."""
        logger.info("📊 Seeding Telemetry...")
        try:
            with self.engine.begin() as conn:
                events = [
                    ('stream_complete', 1, 2, 300, 'playlist:1', '2026-05-04 10:00:00'),
                    ('stream_complete', 13, 2, 360, 'home_search', '2026-05-04 10:10:00'),
                    ('stream_skip', 2, 2, 15, 'playlist:1', '2026-05-04 10:20:00')
                ]
                for cat, tid, uid, dur, ctx, ts in events:
                    conn.execute(text("""
                        INSERT INTO consumption_events (event_category, track_id, user_id, duration_seconds, playback_context, event_timestamp)
                        VALUES (:cat, :tid, :uid, :dur, :ctx, :ts)
                    """), {'cat': cat, 'tid': tid, 'uid': uid, 'dur': dur, 'ctx': ctx, 'ts': ts})
                return True
        except Exception as e:
            logger.error(f"Failed to seed telemetry: {e}")
            return False

    def seed_all(self):
        """Run all seed operations in order."""
        logger.info("🚀 Starting high-fidelity seeding...")
        if not self.clear_all_data(): return
        if not self.seed_rbac(): return
        if not self.seed_parties_and_labels(): return
        if not self.seed_genres(): return
        if not self.seed_ingestion_chain(): return
        if not self.seed_catalog(): return
        if not self.seed_users(): return
        if not self.seed_engagement(): return
        if not self.seed_commerce(): return
        if not self.seed_telemetry(): return
        logger.info("🎉 Seeding Completed Successfully!")


def main():
    seeder = SeedDataManager()
    if len(sys.argv) < 2:
        print("Usage: python scripts/seed_data.py [seed-all | clear-all]")
        return

    command = sys.argv[1]
    if command == "seed-all":
        seeder.seed_all()
    elif command == "clear-all":
        seeder.clear_all_data()
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()
