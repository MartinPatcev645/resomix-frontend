"""
Seed Sandbox Catalog & API Key
==============================

This script seeds 700 CC BY 4.0 open tracks into partner_id = 1 (Sandbox partner).
It also seeds the rate-limited public API Key `rmx_sandbox_demo_1234567890`.

Author: Antigravity
"""

import os
import sys
import json
import uuid
import hashlib
import logging
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

# Ensure current directory is in path for imports
sys.path.append(os.getcwd())

from database.connection import engine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def seed_sandbox():
    logger.info("🚀 Starting Sandbox catalog seeding...")
    
    # 1. Verify or insert public API key rmx_sandbox_demo_1234567890
    plaintext_key = "rmx_sandbox_demo_1234567890"
    key_prefix = "rmx_sandbox_demo"
    key_hash = hashlib.sha256(plaintext_key.encode()).hexdigest()
    
    try:
        with engine.begin() as conn:
            # Check if partner_id = 1 exists, create if not
            partner = conn.execute(text("SELECT id FROM partners WHERE id = 1")).fetchone()
            if not partner:
                logger.info("🏢 Creating partner 1 (Sandbox tenant)...")
                conn.execute(text("""
                    INSERT INTO partners (id, partner_uuid, legal_name, display_name, contact_email, tier)
                    VALUES (1, '00000000-0000-0000-0000-000000000000', 'Resomix Global B.V.', 'Resomix System', 'system@resomix.com', 'enterprise')
                """))
            
            # Insert the public Sandbox Key
            conn.execute(text("""
                INSERT INTO partner_api_keys (partner_id, key_prefix, key_hash, label, scopes, rate_limit_rps, rate_limit_monthly)
                VALUES (1, :prefix, :hash, 'Public Sandbox Key', '["similarity:read", "metadata:read"]', 5, 3000)
                ON DUPLICATE KEY UPDATE label=label
            """), {'prefix': key_prefix, 'hash': key_hash})
            
            logger.info("✓ Sandbox API key rmx_sandbox_demo_1234567890 initialized.")
            
            # Check if party 'ARGO_01' exists under partner 1
            party = conn.execute(text("SELECT party_id FROM parties WHERE party_id = 'ARGO_01'")).fetchone()
            if not party:
                logger.info("🏢 Seeding default party ARGO_01...")
                conn.execute(text("""
                    INSERT INTO parties (party_id, party_name, dpid, is_active, partner_id)
                    VALUES ('ARGO_01', 'ArgoRhythm', 'DPID_ARGO_001', 1, 1)
                """))
            
            # Check if label 1 exists, otherwise insert
            label = conn.execute(text("SELECT id FROM labels WHERE id = 1")).fetchone()
            if not label:
                logger.info("🏢 Seeding default label 1...")
                conn.execute(text("""
                    INSERT INTO labels (id, party_id, label_name, label_type, partner_id)
                    VALUES (1, 'ARGO_01', 'Argo Deep', 'RecordLabel', 1)
                """))

            # Check if genre Electronic exists
            genre = conn.execute(text("SELECT id FROM genres WHERE name = 'Electronic'")).fetchone()
            if not genre:
                logger.info("🎸 Seeding default genre Electronic...")
                conn.execute(text("INSERT INTO genres (id, name, parent_id) VALUES (1, 'Electronic', None)"))

    except SQLAlchemyError as e:
        logger.error(f"Failed during initial setup: {e}")
        return False

    # 2. Load open tracks from JSON
    json_path = os.path.join("scripts", "open_tracks", "open_tracks_39k.json")
    if not os.path.exists(json_path):
        logger.error(f"❌ Tracks file {json_path} not found.")
        return False

    logger.info("📖 Loading open tracks from JSON...")
    with open(json_path, "r", encoding="utf-8") as f:
        tracks_data = json.load(f)

    # We only want to seed 700 tracks
    target_count = 700
    sliced_tracks = tracks_data[:target_count]
    logger.info(f"Loaded {len(tracks_data)} total tracks; seeding first {len(sliced_tracks)} tracks into Sandbox.")

    try:
        with engine.begin() as conn:
            seen_contributors = {}  # name -> id
            seen_releases = {}      # title -> id
            
            # Fetch existing contributors, releases and genres to seed in-memory cache
            existing_contribs = conn.execute(text("SELECT id, full_name FROM contributors WHERE partner_id = 1")).fetchall()
            for cid, name in existing_contribs:
                seen_contributors[name] = cid

            existing_releases = conn.execute(text("SELECT id, title FROM releases WHERE partner_id = 1")).fetchall()
            for rid, title in existing_releases:
                seen_releases[title] = rid

            # Get genre ID map
            genre_map = {}
            existing_genres = conn.execute(text("SELECT id, name FROM genres")).fetchall()
            for gid, name in existing_genres:
                genre_map[name.lower()] = gid

            inserted_tracks = 0
            skipped_tracks = 0

            for track_info in sliced_tracks:
                tuid = track_info.get("uuid")
                if not tuid:
                    continue

                # Idempotency check: skip if track already exists
                existing = conn.execute(text("SELECT id FROM tracks WHERE uuid = :uuid"), {"uuid": tuid}).fetchone()
                if existing:
                    skipped_tracks += 1
                    continue

                # 1. Resolve/Insert Contributors
                artist_names = track_info.get("artist_names") or []
                if not artist_names and track_info.get("artist"):
                    artist_names = [n.strip() for n in track_info["artist"].split(",") if n.strip()]
                if not artist_names:
                    artist_names = ["Unknown Artist"]

                artist_ids = []
                for artist_name in artist_names:
                    if artist_name not in seen_contributors:
                        conn.execute(text("""
                            INSERT INTO contributors (party_id, full_name, partner_id, isni, ipi, ipn) 
                            VALUES ('ARGO_01', :name, 1, '', '', '')
                        """), {'name': artist_name})
                        cid = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
                        seen_contributors[artist_name] = cid
                    artist_ids.append(seen_contributors[artist_name])

                # 2. Resolve/Insert Release
                album_title = track_info.get("album") or "Unknown Album"
                if album_title not in seen_releases:
                    conn.execute(text("""
                        INSERT INTO releases (label_id, party_id, message_id, title, release_type, partner_id)
                        VALUES (1, 'ARGO_01', 'MSG_2026_001', :title, 'Album', 1)
                    """), {'title': album_title})
                    rid = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
                    seen_releases[album_title] = rid
                rid = seen_releases[album_title]

                # 3. Resolve Genre ID
                genre_name = track_info.get("genre") or "Electronic"
                genre_key = genre_name.strip().lower()
                if genre_key not in genre_map:
                    # Create the genre
                    conn.execute(text("INSERT INTO genres (name) VALUES (:name)"), {'name': genre_name.strip()})
                    gid = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
                    genre_map[genre_key] = gid
                genre_id_val = genre_map[genre_key]

                # 4. Insert Track
                duration_ms = int(float(track_info.get("duration_sec") or 0) * 1000)
                bpm = track_info.get("bpm")
                bpm_val = int(bpm) if bpm and str(bpm).isdigit() else None
                musical_key = track_info.get("musical_key") or "C"

                conn.execute(text("""
                    INSERT INTO tracks (uuid, party_id, isrc, title, duration_ms, bpm, musical_key, genre_id, p_line_year, ingestion_source, partner_id, is_active)
                    VALUES (:uuid, 'ARGO_01', :isrc, :title, :dur, :bpm, :mkey, :genre_id, :year, 'cc_by', 1, 1)
                """), {
                    'uuid': tuid,
                    'isrc': f"SND-{tuid[:10]}",
                    'title': track_info.get("title") or "Untitled",
                    'dur': duration_ms,
                    'bpm': bpm_val,
                    'mkey': musical_key,
                    'genre_id': genre_id_val,
                    'year': track_info.get("year") or 2026
                })
                tid = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()

                # 5. Link Track to Contributors
                for seq, cid in enumerate(artist_ids, 1):
                    conn.execute(text("""
                        INSERT IGNORE INTO track_contributors (track_id, person_id, role, royalty_type, sequence_num)
                        VALUES (:tid, :cid, 'MainArtist', 'MasterRights', :seq)
                    """), {'tid': tid, 'cid': cid, 'seq': seq})

                # 6. Link Track to Release
                conn.execute(text("""
                    INSERT IGNORE INTO release_tracks (release_id, track_id, sequence_num)
                    VALUES (:rid, :tid, 1)
                """), {'rid': rid, 'tid': tid})

                # 7. Insert Audio File record
                local_path = track_info.get("original_path") or f"/mnt/data/OPEN_TRACKS/RAW/{tuid}.mp3"
                conn.execute(text("""
                    INSERT INTO audio_files (party_id, ingest_log_id, track_id, asset_class, original_filename, stored_path, audio_codec, file_size_bytes, duration_seconds, partner_id)
                    VALUES ('ARGO_01', 1, :tid, 'Master', :orig, :path, :codec, :size, :dur_sec, 1)
                """), {
                    'tid': tid,
                    'orig': track_info.get("filename") or f"{tuid}.mp3",
                    'path': local_path,
                    'codec': 'MP3',
                    'size': track_info.get("file_size") or 0,
                    'dur_sec': int(track_info.get("duration_sec") or 0)
                })

                inserted_tracks += 1
                if inserted_tracks % 100 == 0:
                    logger.info(f"Progress: Seeded {inserted_tracks} tracks...")

            logger.info(f"✓ Completed seeding. Inserted: {inserted_tracks}, Skipped (Already existed): {skipped_tracks}")
            return True

    except Exception as e:
        logger.error(f"Failed to seed catalog: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    success = seed_sandbox()
    sys.exit(0 if success else 1)
