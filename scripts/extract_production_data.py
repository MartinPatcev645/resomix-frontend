#!/usr/bin/env python3
"""
Production Data Extraction Script
==================================

This script extracts real data from the production database to create
a realistic development dataset. It extracts 1000 random tracks with all
related data (artists, albums, labels, genres) and creates sample playlists.

Usage:
    python scripts/extract_production_data.py --output tracks_seed.json

Version: 1.0.0
Created: October 26, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import json
import uuid
import random
import argparse
import logging
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Any, Optional
from collections import defaultdict
import pymysql
from pymysql.cursors import DictCursor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ProductionDataExtractor:
    """Extracts data from production database for development seeding."""
    
    def __init__(self, db_config: Dict[str, str]):
        """
        Initialize extractor with database configuration.
        
        Args:
            db_config: Database connection parameters
        """
        self.db_config = db_config
        self.connection = None
        
        # Mapping from old IDs to new IDs
        self.artist_id_map = {}
        self.label_id_map = {}
        self.genre_id_map = {}
        self.album_id_map = {}
        self.track_id_map = {}
        self.playlist_id_map = {}
        
        # Counter for new IDs
        self.next_artist_id = 1
        self.next_label_id = 1
        self.next_genre_id = 1
        self.next_album_id = 1
        self.next_track_id = 1
        self.next_playlist_id = 1
        
        # Data storage
        self.data = {
            'artists': [],
            'labels': [],
            'genres': [],
            'albums': [],
            'tracks': [],
            'track_artists': [],
            'playlists': [],
            'playlist_tracks': []
        }
    
    def connect(self):
        """Establish database connection."""
        try:
            self.connection = pymysql.connect(
                host=self.db_config['host'],
                user=self.db_config['user'],
                password=self.db_config['password'],
                database=self.db_config['database'],
                port=self.db_config.get('port', 3306),
                cursorclass=DictCursor
            )
            logger.info("✓ Connected to production database")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    def disconnect(self):
        """Close database connection."""
        if self.connection:
            self.connection.close()
            logger.info("✓ Disconnected from database")
    
    def _get_or_create_artist_id(self, old_id: Optional[int]) -> Optional[int]:
        """Map old artist ID to new ID."""
        if old_id is None:
            return None
        if old_id not in self.artist_id_map:
            self.artist_id_map[old_id] = self.next_artist_id
            self.next_artist_id += 1
        return self.artist_id_map[old_id]
    
    def _get_or_create_label_id(self, old_id: Optional[int]) -> Optional[int]:
        """Map old label ID to new ID."""
        if old_id is None:
            return None
        if old_id not in self.label_id_map:
            self.label_id_map[old_id] = self.next_label_id
            self.next_label_id += 1
        return self.label_id_map[old_id]
    
    def _get_or_create_genre_id(self, old_id: Optional[int]) -> Optional[int]:
        """Map old genre ID to new ID."""
        if old_id is None:
            return None
        if old_id not in self.genre_id_map:
            self.genre_id_map[old_id] = self.next_genre_id
            self.next_genre_id += 1
        return self.genre_id_map[old_id]
    
    def _get_or_create_album_id(self, old_id: Optional[int]) -> Optional[int]:
        """Map old album ID to new ID."""
        if old_id is None:
            return None
        if old_id not in self.album_id_map:
            self.album_id_map[old_id] = self.next_album_id
            self.next_album_id += 1
        return self.album_id_map[old_id]
    
    def _get_track_new_id(self, old_id: int) -> int:
        """Get new track ID from mapping."""
        return self.track_id_map.get(old_id)
    
    def extract_tracks(self, num_tracks: int = 1000):
        """
        Extract random tracks from production database.
        
        Args:
            num_tracks: Number of tracks to extract
        """
        logger.info(f"Extracting {num_tracks} random tracks...")
        
        cursor = self.connection.cursor()
        
        # Get random track IDs
        cursor.execute(f"""
            SELECT id FROM tracks 
            ORDER BY RAND() 
            LIMIT {num_tracks}
        """)
        track_ids = [row['id'] for row in cursor.fetchall()]
        
        if not track_ids:
            logger.error("No tracks found in database!")
            return
        
        logger.info(f"✓ Found {len(track_ids)} tracks")
        
        # Fetch track details
        placeholders = ','.join(['%s'] * len(track_ids))
        cursor.execute(f"""
            SELECT * FROM tracks 
            WHERE id IN ({placeholders})
        """, track_ids)
        
        tracks = cursor.fetchall()
        
        # Process each track
        for idx, track in enumerate(tracks, 1):
            old_track_id = track['id']
            new_track_id = self.next_track_id
            self.track_id_map[old_track_id] = new_track_id
            self.next_track_id += 1
            
            # Map foreign keys
            new_album_id = self._get_or_create_album_id(track['album_id'])
            new_label_id = self._get_or_create_label_id(track['label_id'])
            new_genre_id = self._get_or_create_genre_id(track['genre_id'])
            
            # Create new UUID for track
            new_uuid = str(uuid.uuid4())
            
            self.data['tracks'].append({
                'id': new_track_id,
                'uuid': new_uuid,
                'album_id': new_album_id,
                'label_id': new_label_id,
                'genre_id': new_genre_id,
                'title': track['title'],
                'year': int(track['year']) if track['year'] else None,
                'duration_sec': float(track['duration_sec']) if track['duration_sec'] else None,
                'bpm': track['bpm'],
                'musical_key': track['musical_key'],
                'file_path': track['file_path'],
                'preview_path': track['preview_path'],
                'file_size': track['file_size'],
                'type': track['type']
            })
            
            if idx % 100 == 0:
                logger.info(f"  Processed {idx}/{len(tracks)} tracks")
        
        logger.info(f"✓ Extracted {len(self.data['tracks'])} tracks")
        cursor.close()
    
    def extract_track_artists(self):
        """Extract track-artist relationships for extracted tracks."""
        logger.info("Extracting track-artist relationships...")
        
        cursor = self.connection.cursor()
        
        old_track_ids = list(self.track_id_map.keys())
        if not old_track_ids:
            return
        
        placeholders = ','.join(['%s'] * len(old_track_ids))
        cursor.execute(f"""
            SELECT * FROM track_artists 
            WHERE track_id IN ({placeholders})
        """, old_track_ids)
        
        track_artists = cursor.fetchall()
        
        for ta in track_artists:
            new_track_id = self._get_track_new_id(ta['track_id'])
            new_artist_id = self._get_or_create_artist_id(ta['artist_id'])
            
            if new_track_id and new_artist_id:
                self.data['track_artists'].append({
                    'track_id': new_track_id,
                    'artist_id': new_artist_id
                })
        
        logger.info(f"✓ Extracted {len(self.data['track_artists'])} track-artist relationships")
        cursor.close()
    
    def extract_artists(self):
        """Extract artists for the extracted tracks."""
        logger.info("Extracting artists...")
        
        cursor = self.connection.cursor()
        
        old_artist_ids = list(self.artist_id_map.keys())
        if not old_artist_ids:
            logger.info("  No artists to extract")
            return
        
        placeholders = ','.join(['%s'] * len(old_artist_ids))
        cursor.execute(f"""
            SELECT * FROM artists 
            WHERE id IN ({placeholders})
        """, old_artist_ids)
        
        artists = cursor.fetchall()
        
        for artist in artists:
            new_id = self.artist_id_map[artist['id']]
            self.data['artists'].append({
                'id': new_id,
                'name': artist['name']
            })
        
        logger.info(f"✓ Extracted {len(self.data['artists'])} artists")
        cursor.close()
    
    def extract_albums(self):
        """Extract albums for the extracted tracks."""
        logger.info("Extracting albums...")
        
        cursor = self.connection.cursor()
        
        old_album_ids = list(self.album_id_map.keys())
        if not old_album_ids:
            logger.info("  No albums to extract")
            return
        
        placeholders = ','.join(['%s'] * len(old_album_ids))
        cursor.execute(f"""
            SELECT * FROM albums 
            WHERE id IN ({placeholders})
        """, old_album_ids)
        
        albums = cursor.fetchall()
        
        for album in albums:
            new_id = self.album_id_map[album['id']]
            new_artist_id = self._get_or_create_artist_id(album['artist_id'])
            
            self.data['albums'].append({
                'id': new_id,
                'artist_id': new_artist_id,
                'title': album['title'],
                'release_date': album['release_date'].isoformat() if album['release_date'] else None,
                'cover_image': album['cover_image']
            })
        
        logger.info(f"✓ Extracted {len(self.data['albums'])} albums")
        cursor.close()
    
    def extract_labels(self):
        """Extract labels for the extracted tracks."""
        logger.info("Extracting labels...")
        
        cursor = self.connection.cursor()
        
        old_label_ids = list(self.label_id_map.keys())
        if not old_label_ids:
            logger.info("  No labels to extract")
            return
        
        placeholders = ','.join(['%s'] * len(old_label_ids))
        cursor.execute(f"""
            SELECT * FROM labels 
            WHERE id IN ({placeholders})
        """, old_label_ids)
        
        labels = cursor.fetchall()
        
        for label in labels:
            new_id = self.label_id_map[label['id']]
            self.data['labels'].append({
                'id': new_id,
                'name': label['name'],
                'website': label['website']
            })
        
        logger.info(f"✓ Extracted {len(self.data['labels'])} labels")
        cursor.close()
    
    def extract_genres(self):
        """Extract genres for the extracted tracks."""
        logger.info("Extracting genres...")
        
        cursor = self.connection.cursor()
        
        old_genre_ids = list(self.genre_id_map.keys())
        if not old_genre_ids:
            logger.info("  No genres to extract")
            return
        
        placeholders = ','.join(['%s'] * len(old_genre_ids))
        cursor.execute(f"""
            SELECT * FROM genres 
            WHERE id IN ({placeholders})
        """, old_genre_ids)
        
        genres = cursor.fetchall()
        
        for genre in genres:
            new_id = self.genre_id_map[genre['id']]
            self.data['genres'].append({
                'id': new_id,
                'name': genre['name']
            })
        
        logger.info(f"✓ Extracted {len(self.data['genres'])} genres")
        cursor.close()
    
    def create_playlists(self):
        """Create sample playlists with extracted tracks."""
        logger.info("Creating sample playlists...")
        
        if len(self.data['tracks']) < 100:
            logger.warning("Not enough tracks to create playlists")
            return
        
        available_track_ids = [t['id'] for t in self.data['tracks']]
        random.shuffle(available_track_ids)
        
        playlist_configs = [
            # 5 playlists with 20 tracks
            *[('custom', 20) for _ in range(5)],
            # 5 playlists with 100 tracks
            *[('custom', 100) for _ in range(5)]
        ]
        
        playlist_names = [
            "Morning Vibes", "Workout Energy", "Chill Evening", "Focus Flow", "Party Mix",
            "Deep House Collection", "Techno Essentials", "Electronic Favorites", 
            "Progressive Journey", "Underground Hits"
        ]
        
        track_index = 0
        
        for idx, (playlist_type, num_tracks) in enumerate(playlist_configs, 1):
            if track_index + num_tracks > len(available_track_ids):
                logger.warning(f"Not enough tracks for playlist {idx}, skipping...")
                continue
            
            playlist_id = self.next_playlist_id
            self.next_playlist_id += 1
            playlist_uuid = str(uuid.uuid4())
            
            self.data['playlists'].append({
                'id': playlist_id,
                'uuid': playlist_uuid,
                'user_id': None,  # Will be assigned during seeding
                'name': playlist_names[idx - 1] if idx <= len(playlist_names) else f"Playlist {idx}",
                'is_public': 1,
                'type': playlist_type,
                'seed_track_id': None,
                'fork_id': None,
                'forked_at': None,
                'fork_count': 0
            })
            
            # Add tracks to playlist
            for position in range(num_tracks):
                if track_index >= len(available_track_ids):
                    break
                
                track_id = available_track_ids[track_index]
                track_index += 1
                
                # Generate random position (for ordering flexibility)
                position_value = (position + 1) * 1000.0 + random.uniform(-100, 100)
                
                # Generate random score (0.0 to 1.0)
                score = round(random.uniform(0.5, 1.0), 8) if random.random() > 0.3 else None
                
                self.data['playlist_tracks'].append({
                    'playlist_id': playlist_id,
                    'track_id': track_id,
                    'position': round(position_value, 6),
                    'score': score
                })
        
        logger.info(f"✓ Created {len(self.data['playlists'])} playlists")
        logger.info(f"✓ Created {len(self.data['playlist_tracks'])} playlist-track relationships")
    
    def extract_all(self, num_tracks: int = 1000):
        """
        Extract all data in correct order.
        
        Args:
            num_tracks: Number of tracks to extract
        """
        logger.info("=" * 60)
        logger.info("Starting Production Data Extraction")
        logger.info("=" * 60)
        
        try:
            self.connect()
            
            # Extract tracks first (this populates ID mappings)
            self.extract_tracks(num_tracks)
            
            # Extract related data based on track relationships
            self.extract_track_artists()
            self.extract_artists()
            self.extract_albums()
            self.extract_labels()
            self.extract_genres()
            
            # Create sample playlists
            self.create_playlists()
            
            logger.info("=" * 60)
            logger.info("Extraction Summary:")
            logger.info(f"  Artists: {len(self.data['artists'])}")
            logger.info(f"  Labels: {len(self.data['labels'])}")
            logger.info(f"  Genres: {len(self.data['genres'])}")
            logger.info(f"  Albums: {len(self.data['albums'])}")
            logger.info(f"  Tracks: {len(self.data['tracks'])}")
            logger.info(f"  Track-Artist Relations: {len(self.data['track_artists'])}")
            logger.info(f"  Playlists: {len(self.data['playlists'])}")
            logger.info(f"  Playlist Tracks: {len(self.data['playlist_tracks'])}")
            logger.info("=" * 60)
            
        finally:
            self.disconnect()
    
    def save_to_json(self, output_file: str):
        """
        Save extracted data to JSON file.
        
        Args:
            output_file: Output JSON file path
        """
        logger.info(f"Saving data to {output_file}...")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, indent=2, ensure_ascii=False, default=str)
        
        logger.info(f"✓ Data saved to {output_file}")


def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description="Extract production data for development seeding",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/extract_production_data.py --output tracks_seed.json
  python scripts/extract_production_data.py --tracks 500 --output tracks_seed.json
  python scripts/extract_production_data.py --host 127.0.0.1 --port 3307
        """
    )
    
    parser.add_argument('--host', default='127.0.0.1', help='Database host')
    parser.add_argument('--port', type=int, default=3306, help='Database port')
    parser.add_argument('--user', default='resomix', help='Database user')
    parser.add_argument('--password', default='secret', help='Database password')
    parser.add_argument('--database', default='resomix_db', help='Database name')
    parser.add_argument('--tracks', type=int, default=1000, help='Number of tracks to extract')
    parser.add_argument('--output', default='tracks_seed.json', help='Output JSON file')
    
    args = parser.parse_args()
    
    db_config = {
        'host': args.host,
        'port': args.port,
        'user': args.user,
        'password': args.password,
        'database': args.database
    }
    
    try:
        extractor = ProductionDataExtractor(db_config)
        extractor.extract_all(num_tracks=args.tracks)
        extractor.save_to_json(args.output)
        
        logger.info("=" * 60)
        logger.info("✓ Extraction completed successfully!")
        logger.info(f"✓ Data exported to: {args.output}")
        logger.info("=" * 60)
        
    except KeyboardInterrupt:
        logger.info("\n⚠️  Extraction cancelled by user")
        return 1
    except Exception as e:
        logger.error(f"❌ Extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())

