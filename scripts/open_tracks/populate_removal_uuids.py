#!/usr/bin/env python3
"""
Populate UUIDs in removal_tracks.json by matching filenames with open_tracks.json

This script reads both JSON files, creates a filename->UUID mapping from open_tracks.json,
and populates the empty UUID fields in removal_tracks.json.

Usage:
    python populate_removal_uuids.py
"""

import json
from pathlib import Path

# Script directory
SCRIPT_DIR = Path(__file__).parent

# File paths
OPEN_TRACKS_FILE = SCRIPT_DIR / "open_tracks.json"
REMOVAL_TRACKS_FILE = SCRIPT_DIR / "removal_tracks.json"
OUTPUT_FILE = SCRIPT_DIR / "removal_tracks.json"  # Overwrite the original

def load_json(file_path):
    """Load and parse a JSON file."""
    print(f"Loading {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data, file_path):
    """Save data to a JSON file with pretty formatting."""
    print(f"Saving to {file_path}...")
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def create_filename_to_uuid_map(open_tracks):
    """Create a mapping of filename -> UUID from open_tracks.json."""
    filename_map = {}
    duplicates = []
    
    for track in open_tracks:
        filename = track.get('filename', '')
        uuid = track.get('uuid', '')
        
        if filename:
            if filename in filename_map:
                duplicates.append(filename)
            else:
                filename_map[filename] = uuid
    
    if duplicates:
        print(f"⚠️  Warning: Found {len(duplicates)} duplicate filenames in open_tracks.json")
        print(f"   First 5: {duplicates[:5]}")
    
    return filename_map

def populate_uuids(removal_tracks, filename_map):
    """Populate UUIDs in removal_tracks using the filename map."""
    matched = 0
    not_matched = 0
    not_matched_files = []
    
    for track in removal_tracks:
        filename = track.get('filename', '')
        
        if filename in filename_map:
            track['uuid'] = filename_map[filename]
            matched += 1
        else:
            not_matched += 1
            not_matched_files.append(filename)
    
    return matched, not_matched, not_matched_files

def main():
    """Main execution function."""
    print("=" * 70)
    print("Populate Removal Tracks UUIDs")
    print("=" * 70)
    
    # Check if files exist
    if not OPEN_TRACKS_FILE.exists():
        print(f"❌ Error: {OPEN_TRACKS_FILE} not found!")
        return 1
    
    if not REMOVAL_TRACKS_FILE.exists():
        print(f"❌ Error: {REMOVAL_TRACKS_FILE} not found!")
        return 1
    
    # Load JSON files
    open_tracks = load_json(OPEN_TRACKS_FILE)
    removal_tracks = load_json(REMOVAL_TRACKS_FILE)
    
    print(f"✓ Loaded {len(open_tracks):,} tracks from open_tracks.json")
    print(f"✓ Loaded {len(removal_tracks):,} tracks from removal_tracks.json")
    print()
    
    # Create filename -> UUID mapping
    print("Creating filename to UUID mapping...")
    filename_map = create_filename_to_uuid_map(open_tracks)
    print(f"✓ Created mapping with {len(filename_map):,} unique filenames")
    print()
    
    # Populate UUIDs
    print("Populating UUIDs in removal_tracks.json...")
    matched, not_matched, not_matched_files = populate_uuids(removal_tracks, filename_map)
    
    print(f"✓ Matched: {matched:,} tracks")
    print(f"✗ Not matched: {not_matched:,} tracks")
    
    if not_matched > 0:
        print()
        print("First 10 unmatched filenames:")
        for filename in not_matched_files[:10]:
            print(f"  - {filename}")
    
    print()
    
    # Save updated removal_tracks.json
    save_json(removal_tracks, OUTPUT_FILE)
    
    print()
    print("=" * 70)
    print("✓ UUID population complete!")
    print(f"  Updated file: {OUTPUT_FILE}")
    print(f"  Success rate: {matched}/{len(removal_tracks)} ({100 * matched / len(removal_tracks):.1f}%)")
    print("=" * 70)
    
    return 0

if __name__ == "__main__":
    exit(main())
