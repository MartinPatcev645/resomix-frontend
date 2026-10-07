# Production Data Extraction Guide

This guide explains how to extract real data from your production database and seed it into your development environment for the Resomix Audio Similarity API.

## Overview

The data extraction and seeding process consists of two main components:

1. **Extract Script** (`scripts/extract_production_data.py`) - Runs on production server to extract data
2. **Seed Script** (`scripts/seed_data.py`) - Reads the exported JSON and seeds your dev database

## What Gets Extracted?

### Real Production Data
- **1000 Random Tracks** (configurable)
- **Related Artists** (all artists for those tracks)
- **Related Albums** (all albums for those tracks)
- **Related Labels** (all labels for those tracks)
- **Related Genres** (all genres for those tracks)
- **Track-Artist Relationships** (many-to-many associations)

### Generated Sample Data
- **10 Playlists**:
  - 5 playlists with 20 tracks each
  - 5 playlists with 100 tracks each
  - All playlists are public with no forks
- **Playlist Tracks** with random positions and scores

### Other Seed Data (Not from Production)
- **8 Sample Users** (with random values, no 2FA enabled)
- **RBAC System** (roles, permissions, assignments)
- **Sample Feedback** (random feedback entries)
- **Sample Contact Messages** (random contact entries)
- **Waitlist Entries** (random waitlist entries)
- **User Sessions, OAuth providers, Subscriptions** (sample data)

## Step-by-Step Usage

### Step 1: Extract Data from Production Server

On your **production server**, run:

```bash
# Basic usage (extracts 1000 tracks)
python scripts/extract_production_data.py --output tracks_seed.json

# Custom number of tracks
python scripts/extract_production_data.py --tracks 500 --output tracks_seed.json

# With custom database credentials
python scripts/extract_production_data.py \
  --host 127.0.0.1 \
  --port 3306 \
  --user resomix \
  --password secret \
  --database resomix_db \
  --tracks 1000 \
  --output tracks_seed.json
```

**Output**: `tracks_seed.json` file containing all extracted data

### Step 2: Transfer JSON File to Dev Environment

Copy the `tracks_seed.json` file to your development machine:

```bash
# Using scp (from your local machine)
scp user@production-server:/path/to/tracks_seed.json ./

# Or use any file transfer method you prefer
```

Place the file in your project root directory (same level as `Makefile`, `requirements.txt`).

### Step 3: Seed Development Database

On your **development machine**, run:

```bash
# Seed everything (users, RBAC, tracks, playlists, feedback, etc.)
make seed

# Or manually:
python -m database.manage setup --with-data
```

**What Happens**:
- Creates tables via migrations
- Seeds 8 sample users with roles
- **Automatically** looks for `tracks_seed.json` in project root
- If found: Seeds real tracks and playlists
- If not found: Shows a warning and continues (tracks/playlists are optional)
- Seeds sample feedback and contact messages

### Alternative: Seed Tracks Only

If you already have users and RBAC set up:

```bash
# Seed only tracks from JSON
python -m database.manage seed --tracks

# Or with custom file path
python -m database.manage seed --tracks --tracks-file /path/to/tracks_seed.json
```

## JSON File Structure

The `tracks_seed.json` file has the following structure:

```json
{
  "artists": [
    {"id": 1, "name": "Artist Name"}
  ],
  "labels": [
    {"id": 1, "name": "Label Name", "website": "https://..."}
  ],
  "genres": [
    {"id": 1, "name": "Genre Name"}
  ],
  "albums": [
    {
      "id": 1,
      "artist_id": 1,
      "title": "Album Title",
      "release_date": "2024-01-01",
      "cover_image": "/path/to/image.jpg"
    }
  ],
  "tracks": [
    {
      "id": 1,
      "uuid": "unique-uuid-here",
      "album_id": 1,
      "label_id": 1,
      "genre_id": 1,
      "title": "Track Title",
      "year": 2024,
      "duration_sec": 180.5,
      "bpm": 128,
      "musical_key": "Am",
      "file_path": "/path/to/track.mp3",
      "preview_path": "/path/to/preview.mp3",
      "file_size": 5242880,
      "type": "electrobuzz"
    }
  ],
  "track_artists": [
    {"track_id": 1, "artist_id": 1}
  ],
  "playlists": [
    {
      "id": 1,
      "uuid": "playlist-uuid",
      "user_id": null,
      "name": "Morning Vibes",
      "is_public": 1,
      "type": "custom",
      "seed_track_id": null,
      "fork_id": null,
      "forked_at": null,
      "fork_count": 0
    }
  ],
  "playlist_tracks": [
    {
      "playlist_id": 1,
      "track_id": 1,
      "position": 1000.5,
      "score": 0.95
    }
  ]
}
```

## Important Notes

### ID Mapping
The extraction script intelligently maps old production IDs to new development IDs:
- Old track ID 5821 might become new ID 1 in dev
- All foreign key relationships are preserved
- New UUIDs are generated for tracks and playlists

### File Paths
- Track `file_path` and `preview_path` are preserved as-is
- You may need to adjust these paths or set up symbolic links if your dev environment has different paths

### Schema Compatibility
The seed data has been updated to match the current schema:
- ✅ Token fields use VARCHAR(64) (migration 002)
- ✅ Playlist fork fields included (migration 003)
- ✅ Playlist tracks use DECIMAL(12,6) for position
- ✅ All users have 2FA disabled for dev testing
- ✅ All users are email verified for easier testing

### Cross-Platform Support
- Path handling works on both **Windows** and **Mac/Linux**
- Uses `pathlib.Path` for cross-platform compatibility
- JSON file is searched in project root automatically

## Sample Credentials

After seeding, use these credentials to log in:

- **Admin**: `admin@resomix.com` / `Admin@123`
- **User**: `john.doe@example.com` / `User@123`
- **Premium**: `jane.smith@example.com` / `User@123`

All users have:
- Email verified: ✅
- 2FA enabled: ❌ (disabled for dev convenience)

## Troubleshooting

### "Production data file not found"
**Solution**: This is just a warning. The system continues without tracks. If you want tracks:
1. Run the extraction script on production
2. Copy `tracks_seed.json` to your project root
3. Run `make seed` again (or just `python -m database.manage seed --tracks`)

### "Failed to connect to database"
**Solution**: Check your database credentials in the extraction script arguments

### "Foreign key constraint fails"
**Solution**: Make sure you run migrations first: `python -m database.manage migrate`

### "Duplicate entry for key"
**Solution**: Clear existing data first: `python -m database.manage reset`

## Advanced Usage

### Extract Fewer Tracks for Faster Testing
```bash
python scripts/extract_production_data.py --tracks 100 --output tracks_seed.json
```

### Seed Only Specific Components
```bash
# Only users and RBAC
python -m database.manage seed --rbac

# Only feedback
python -m database.manage seed --feedback

# Only tracks (requires tracks_seed.json)
python -m database.manage seed --tracks
```

### Clear All Data and Start Fresh
```bash
python -m database.manage reset
python -m database.manage setup --with-data
```

## Architecture

```
Production Server                Development Machine
┌─────────────────┐             ┌──────────────────┐
│                 │             │                  │
│  Production DB  │             │  Development DB  │
│  (MariaDB)      │             │  (MariaDB)       │
│                 │             │                  │
│  1000+ tracks   │             │  Empty DB        │
│  Artists        │             │                  │
│  Albums         │             │                  │
│  Labels         │             │                  │
│  Genres         │             │                  │
└────────┬────────┘             └────────▲─────────┘
         │                               │
         │ Extract                       │ Seed
         │                               │
         ▼                               │
┌────────────────────┐                  │
│                    │                  │
│  extract_script.py │                  │
│                    │                  │
│  - Connect to DB   │                  │
│  - Extract tracks  │                  │
│  - Map IDs         │                  │
│  - Create JSON     │                  │
└────────┬───────────┘                  │
         │                               │
         │ Generate                      │
         ▼                               │
  ┌──────────────┐                      │
  │              │                      │
  │ tracks_seed  │  ───────Transfer─────┤
  │   .json      │                      │
  │              │                      │
  └──────────────┘                      │
                                        │
                                        │
                               ┌────────┴────────┐
                               │                 │
                               │  seed_data.py   │
                               │                 │
                               │  - Read JSON    │
                               │  - Map IDs      │
                               │  - Insert data  │
                               │  - Preserve FK  │
                               └─────────────────┘
```

## Performance

- **Extraction**: ~30 seconds for 1000 tracks (depends on DB size and network)
- **Seeding**: ~20 seconds for 1000 tracks + related data
- **Total**: ~1 minute for complete setup

## Security Considerations

- ⚠️ Never commit `tracks_seed.json` to version control (add to `.gitignore`)
- ⚠️ The JSON file contains real file paths and metadata
- ⚠️ Sample users use weak passwords - only for development
- ⚠️ 2FA is disabled - only for development convenience

## Questions?

For issues or questions, contact:
- **Author**: Muhammad Usman Naeem
- **Email**: usman.naeem2212@gmail.com

