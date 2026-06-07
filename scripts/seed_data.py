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
import json
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
                    'partner_usage_logs', 'webhook_delivery_logs', 'partner_webhooks',
                    'partner_api_keys', 'partners',
                    'consumption_events', 'manual_takedowns', 'ingestion_errors', 
                    'sftp_users', 'user_spotify_apps', 'spotify_apps', 
                    'user_operation_limits', 'operation_types', 'contacts', 'feedbacks', 
                    'system_logs', 'cart_items', 'carts', 'user_subscriptions', 
                    'purchases', 'orders', 'promo_codes', 
                    'waitlists', 'playlist_ratings', 'track_ratings', 
                    'user_track_engagements', 'user_playlist_engagements', 
                    'playlist_transfer_tracks', 'playlist_tracks', 'playlists', 
                    'track_contributors', 'contributors', 
                    'release_deals', 'royalty_rates', 'deals', 'release_tracks', 
                    'release_contributors', 'releases', 'tracks', 'audio_files', 'image_files',
                    'labels', 'messages', 'ingest_logs', 'parties', 'genres', 
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
        """Seed roles and permissions from the authoritative app.core.rbac definitions."""
        logger.info("🔐 Seeding RBAC (modern permissions)...")
        try:
            from app.core.rbac import ROLES, PERMISSIONS, ROLE_PERMISSIONS

            with self.engine.begin() as conn:
                # 1. Insert all permissions
                for perm_name, perm_desc in PERMISSIONS.items():
                    conn.execute(
                        text("INSERT IGNORE INTO permissions (name, description) VALUES (:name, :desc)"),
                        {'name': perm_name, 'desc': perm_desc}
                    )

                # 2. Insert all roles
                for role_name, role_desc in ROLES.items():
                    conn.execute(
                        text("INSERT IGNORE INTO roles (name, description) VALUES (:name, :desc)"),
                        {'name': role_name, 'desc': role_desc}
                    )

                # 3. Also insert legacy role names used by seed_users() (listener, creator, distributor)
                legacy_roles = [
                    ('listener', 'Standard user with basic playback and playlist features'),
                    ('creator', 'User who can upload and manage content'),
                    ('distributor', 'B2B partner with access to reports and ingestion'),
                ]
                for role_name, role_desc in legacy_roles:
                    conn.execute(
                        text("INSERT IGNORE INTO roles (name, description) VALUES (:name, :desc)"),
                        {'name': role_name, 'desc': role_desc}
                    )

                # 4. Assign permissions to roles
                for role_name, perm_names in ROLE_PERMISSIONS.items():
                    for perm_name in perm_names:
                        conn.execute(text("""
                            INSERT IGNORE INTO role_permissions (role_id, permission_id)
                            SELECT r.id, p.id
                            FROM roles r
                            JOIN permissions p ON p.name = :perm
                            WHERE r.name = :role
                        """), {'role': role_name, 'perm': perm_name})

                return True
        except Exception as e:
            logger.error(f"Failed to seed RBAC: {e}")
            return False

    def seed_partners(self) -> bool:
        """Seed default partners and API keys."""
        logger.info("🏢 Seeding Partners...")
        try:
            with self.engine.begin() as conn:
                # 1. Resomix System Partner (id=1) - Global System Tenant
                conn.execute(text("""
                    INSERT IGNORE INTO partners (id, partner_uuid, legal_name, display_name, contact_email, tier)
                    VALUES (1, '00000000-0000-0000-0000-000000000000', 'Resomix Global B.V.', 'Resomix System', 'system@resomix.com', 'enterprise')
                """))
                
                # 2. Test Partner (id=2)
                conn.execute(text("""
                    INSERT IGNORE INTO partners (id, partner_uuid, legal_name, display_name, contact_email, tier)
                    VALUES (2, '550e8400-e29b-41d4-a716-446655440000', 'Test Partner Ltd', 'Test Partner', 'test@partner.com', 'starter')
                """))
                
                # 3. Seed an API key for Test Partner
                # Key: rmx_test_V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ
                # Hash for rmx_test_V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ
                key_hash = "c4a8dbb7e2ad9901f334e949931a51cffba0f51cc5f37bdb085e86d2766285af" 
                conn.execute(text("""
                    INSERT IGNORE INTO partner_api_keys (partner_id, key_prefix, key_hash, label, scopes)
                    VALUES (2, 'rmx_test', :hash, 'Test Key', '["search:read", "similarity:read"]')
                """), {'hash': key_hash})
                
                return True
        except Exception as e:
            logger.error(f"Failed to seed partners: {e}")
            return False

    def seed_parties_and_labels(self) -> bool:
        """Seed Parties and Labels."""
        logger.info("🏢 Seeding Parties and Labels...")
        try:
            with self.engine.begin() as conn:
                # 1. Party
                conn.execute(text("""
                    INSERT INTO parties (party_id, party_name, dpid, is_active, partner_id)
                    VALUES ('ARGO_01', 'ArgoRhythm', 'DPID_ARGO_001', 1, 1)
                """))
                
                # 2. Labels
                conn.execute(text("""
                    INSERT INTO labels (id, party_id, label_name, label_type, partner_id)
                    VALUES (1, 'ARGO_01', 'Argo Deep', 'RecordLabel', 1),
                           (2, 'ARGO_01', 'Argo Techno', 'RecordLabel', 1)
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

    def seed_operation_types(self) -> bool:
        """Seed default operation types for rate limiting."""
        logger.info("⚙️ Seeding Operation Types...")
        try:
            with self.engine.begin() as conn:
                ops = [
                    ('track_stream', 'Streaming a track'),
                    ('track_download', 'Downloading a track'),
                    ('api_call', 'General API request')
                ]
                for code, desc in ops:
                    conn.execute(text("INSERT IGNORE INTO operation_types (code, description) VALUES (:code, :desc)"),
                                 {'code': code, 'desc': desc})
                return True
        except Exception as e:
            logger.error(f"Failed to seed operation types: {e}")
            return False

    def seed_ingestion_chain(self) -> bool:
        """Seed IngestLog, Messages, and Deals."""
        logger.info("📦 Seeding Ingestion Chain...")
        try:
            with self.engine.begin() as conn:
                # 1. Ingest Log
                conn.execute(text("""
                    INSERT INTO ingest_logs (id, party_id, package_folder, status, partner_id)
                    VALUES (1, 'ARGO_01', '/sftp/argo/batch_001', 'COMPLETED', 1)
                """))
                
                # 2. Message
                conn.execute(text("""
                    INSERT INTO messages (id, ingest_log_id, party_id, message_id, message_type, ddex_version, partner_id)
                    VALUES (1, 1, 'ARGO_01', 'MSG_2026_001', 'ERN', '4.3', 1)
                """))
                
                # 3. Deal
                conn.execute(text("""
                    INSERT INTO deals (id, party_id, message_id, deal_ref, commercial_model, is_perpetual, partner_id)
                    VALUES (1, 'ARGO_01', 'MSG_2026_001', 'DEAL_001', 'PayAsYouGoModel', 1, 1)
                """))
                return True
        except Exception as e:
            logger.error(f"Failed to seed ingestion chain: {e}")
            return False

    def seed_catalog(self) -> bool:
        """Seed Contributors, Releases, and Tracks from extracted_track_info.json."""
        logger.info("🎵 Seeding Catalog from JSON...")
        try:
            # Load the JSON data
            json_path = os.path.join('scripts', 'extracted_track_info.json')
            if not os.path.exists(json_path):
                logger.error(f"❌ Metadata file {json_path} not found.")
                return False
                
            with open(json_path, 'r', encoding='utf-8') as f:
                tracks_data = json.load(f)

            with self.engine.begin() as conn:
                # Helper to track seen entities
                seen_contributors = {} # name -> id
                seen_releases = {}     # title -> id
                
                for track_info in tracks_data:
                    # 1. Ensure Contributors exist
                    artist_ids = []
                    for artist_name in track_info.get('artists', []):
                        if artist_name not in seen_contributors:
                            conn.execute(text("""
                                INSERT INTO contributors (party_id, full_name, partner_id) 
                                VALUES ('ARGO_01', :name, 1)
                                ON DUPLICATE KEY UPDATE full_name=full_name
                            """), {'name': artist_name})
                            cid = conn.execute(text("SELECT id FROM contributors WHERE full_name = :name"), {'name': artist_name}).scalar()
                            seen_contributors[artist_name] = cid
                        artist_ids.append(seen_contributors[artist_name])

                    # 2. Ensure Release exists
                    album_title = track_info.get('album_title') or 'Unknown Album'
                    if album_title not in seen_releases:
                        conn.execute(text("""
                            INSERT INTO releases (label_id, party_id, message_id, title, release_type, partner_id)
                            VALUES (1, 'ARGO_01', 'MSG_2026_001', :title, 'Album', 1)
                            ON DUPLICATE KEY UPDATE title=title
                        """), {'title': album_title})
                        rid = conn.execute(text("SELECT id FROM releases WHERE title = :title"), {'title': album_title}).scalar()
                        seen_releases[album_title] = rid
                    rid = seen_releases[album_title]

                    # 3. Insert Track — resolve genre name → genre_id FK
                    duration_ms = int(float(track_info.get('duration_sec') or 0) * 1000)
                    tuid = track_info.get('uuid')
                    genre_name = track_info.get('genre_name')

                    # Resolve genre string to genres.id (genres are already seeded at this point)
                    genre_id_val = None
                    if genre_name:
                        row = conn.execute(
                            text("SELECT id FROM genres WHERE name = :name LIMIT 1"),
                            {'name': genre_name}
                        ).fetchone()
                        genre_id_val = row[0] if row else None

                    conn.execute(text("""
                        INSERT INTO tracks (uuid, party_id, isrc, title, duration_ms, bpm, musical_key, genre_id, p_line_year, ingestion_source, partner_id)
                        VALUES (:uuid, 'ARGO_01', :isrc, :title, :dur, :bpm, :mkey, :genre_id, :year, 'csv', 1)
                        ON DUPLICATE KEY UPDATE title=:title
                    """), {
                        'uuid': tuid,
                        'isrc': f"SEED-{tuid[:10]}",  # Placeholder ISRC (max 15 chars)
                        'title': track_info.get('title'),
                        'dur': duration_ms,
                        'bpm': track_info.get('bpm'),
                        'mkey': track_info.get('musical_key'),
                        'genre_id': genre_id_val,
                        'year': track_info.get('year')
                    })
                    tid = conn.execute(text("SELECT id FROM tracks WHERE uuid = :uuid"), {'uuid': tuid}).scalar()

                    # 4. Link Track to Contributors
                    for seq, cid in enumerate(artist_ids, 1):
                        conn.execute(text("""
                            INSERT IGNORE INTO track_contributors (track_id, person_id, role, royalty_type, sequence_num)
                            VALUES (:tid, :cid, 'MainArtist', 'MasterRights', :seq)
                        """), {'tid': tid, 'cid': cid, 'seq': seq})

                    # 5. Link Track to Release
                    conn.execute(text("""
                        INSERT IGNORE INTO release_tracks (release_id, track_id, sequence_num)
                        VALUES (:rid, :tid, 1)
                    """), {'rid': rid, 'tid': tid})

                    # 6. Audio Files (Using local_file_path)
                    local_path = track_info.get('local_file_path')
                    if local_path:
                        conn.execute(text("""
                            INSERT INTO audio_files (party_id, ingest_log_id, track_id, asset_class, asset_subtype, original_filename, stored_path, audio_codec, partner_id)
                            VALUES ('ARGO_01', 1, :tid, 'Master', 'master', :orig, :path, :codec, 1)
                            ON DUPLICATE KEY UPDATE stored_path=:path
                        """), {
                            'tid': tid,
                            'orig': os.path.basename(local_path),
                            'path': local_path,
                            'codec': local_path.split('.')[-1].upper() if '.' in local_path else 'FLAC'
                        })

                    # 7. Processing status — seeded sandbox catalog is already live & indexed,
                    #    so mark every stage completed so the admin panel reflects reality.
                    conn.execute(text("""
                        INSERT INTO track_processing_status
                            (track_id, partner_id, ingest_log_id, audio_filename, sftp_env,
                             embedding_status, peaks_status, segments_status, faiss_indexed,
                             embedding_completed_at, peaks_completed_at, segments_completed_at, faiss_indexed_at)
                        VALUES
                            (:tid, 1, 1, :orig, 'live',
                             'completed', 'completed', 'completed', 1,
                             NOW(), NOW(), NOW(), NOW())
                        ON DUPLICATE KEY UPDATE faiss_indexed=1
                    """), {
                        'tid': tid,
                        'orig': os.path.basename(local_path) if local_path else None,
                    })

                return True
        except Exception as e:
            logger.error(f"Failed to seed catalog: {e}", exc_info=True)
            return False

    def seed_users(self) -> bool:
        """Seed Users and Roles."""
        logger.info("👤 Seeding Users...")
        try:
            with self.engine.begin() as conn:
                # 1. Admin
                admin_uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
                conn.execute(text("""
                    INSERT INTO users (id, uuid, username, email, password_hash, name, is_email_verified, partner_id)
                    VALUES (1, :uuid, 'admin', 'dj@argo.fm', :pw, 'DJ Argo (Admin)', 1, 1)
                """), {'uuid': admin_uuid, 'pw': self._hash_password('dj@argo.fm')})
                
                # 2. Listener
                user_uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d480'
                conn.execute(text("""
                    INSERT INTO users (id, uuid, username, email, password_hash, name, is_email_verified, partner_id)
                    VALUES (2, :uuid, 'listener_01', 'listener@resomix.com', :pw, 'Music Lover', 1, 1)
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
                    INSERT INTO playlists (id, uuid, user_id, name, is_public, type, seed_track_id, partner_id)
                    VALUES (1, 'a623405c-18df-4835-8666-4d22384a5142', 1, 'Ultimate Argo Collection', 1, 'custom', 1, 1)
                """))
                
                # 2. Playlist Tracks
                for i, tid in enumerate(range(1, 11)):
                    conn.execute(text("INSERT INTO playlist_tracks (playlist_id, track_id, position, score) VALUES (1, :tid, :pos, :score)"),
                                 {'tid': tid, 'pos': float(i + 1), 'score': round(1.0 - (i * 0.05), 2)})
                return True
        except Exception as e:
            logger.error(f"Failed to seed engagement: {e}")
            return False

    def seed_commerce(self) -> bool:
        """Seed Orders and Purchases using dynamic track IDs."""
        logger.info("💰 Seeding Commerce...")
        try:
            with self.engine.begin() as conn:
                # Get a valid track and its release
                track = conn.execute(text("SELECT id FROM tracks LIMIT 1")).fetchone()
                if not track:
                    logger.warning("No tracks found for commerce seeding.")
                    return True
                
                release_id = conn.execute(text("SELECT release_id FROM release_tracks WHERE track_id = :tid"), {'tid': track.id}).scalar()

                # 1. Order
                conn.execute(text("""
                    INSERT INTO orders (user_id, subtotal_cents, total_cents, status)
                    VALUES (2, 99, 99, 'paid')
                """))
                order_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
                
                # 2. Purchases
                conn.execute(text("""
                    INSERT INTO purchases (order_id, user_id, track_id, release_id, price_cents)
                    VALUES (:oid, 2, :tid, :rid, 99)
                """), {'oid': order_id, 'tid': track.id, 'rid': release_id})
                return True
        except Exception as e:
            logger.error(f"Failed to seed commerce: {e}")
            return False

    def seed_telemetry(self) -> bool:
        """Seed Consumption Events using dynamic track and label data."""
        logger.info("📊 Seeding Telemetry...")
        try:
            with self.engine.begin() as conn:
                track = conn.execute(text("SELECT id, isrc FROM tracks LIMIT 1")).fetchone()
                if not track:
                    logger.warning("No tracks found for telemetry seeding.")
                    return True

                label_id = conn.execute(text("""
                    SELECT label_id FROM releases r 
                    JOIN release_tracks rt ON r.id = rt.release_id 
                    WHERE rt.track_id = :tid
                """), {'tid': track.id}).scalar()

                events = [
                    ('stream_complete', track.id, track.isrc, label_id, 2, 300, 'home_search'),
                    ('stream_skip', track.id, track.isrc, label_id, 2, 15, 'home_search')
                ]
                for cat, tid, isrc, lid, uid, dur, ctx in events:
                    conn.execute(text("""
                        INSERT INTO consumption_events (event_category, track_id, isrc, label_id, user_id, duration_seconds, playback_context, partner_id)
                        VALUES (:cat, :tid, :isrc, :lid, :uid, :dur, :ctx, 1)
                    """), {'cat': cat, 'tid': tid, 'isrc': isrc, 'lid': lid, 'uid': uid, 'dur': dur, 'ctx': ctx})
                return True
        except Exception as e:
            logger.error(f"Failed to seed telemetry: {e}")
            return False

    def seed_all(self):
        """Run all seed operations in order."""
        logger.info("🚀 Starting high-fidelity seeding...")
        if not self.clear_all_data(): return
        if not self.seed_partners(): return
        if not self.seed_rbac(): return
        if not self.seed_parties_and_labels(): return
        if not self.seed_genres(): return
        if not self.seed_operation_types(): return
        if not self.seed_ingestion_chain(): return
        if not self.seed_catalog(): return
        if not self.seed_users(): return
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
