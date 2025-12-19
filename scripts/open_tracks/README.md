# Extract Tracks Info - Standalone Script

This directory contains a **completely standalone** version of the track extraction script that can be run on any system without requiring the main Resomix application.

## Overview

The `extract_tracks_info.py` script scans a directory tree for audio files, assigns UUIDs to each track, and extracts metadata (title, artist, album, genre, year, label) along with file size and duration information.

## Features

- ✅ **Fully Standalone**: No dependencies on the main `app` module
- ✅ **Parallel Processing**: Process multiple tracks simultaneously (configurable workers)
- ✅ **Incremental Updates**: Add new tracks without re-processing existing ones
- ✅ **Resume Capability**: Can be interrupted and resumed without losing progress
- ✅ **Test Mode**: Run on limited tracks with time estimates before full processing
- ✅ **Two-Phase Processing**: 
  - Phase 1: Scan directory and assign UUIDs
  - Phase 2: Extract metadata and duration in parallel
- ✅ **Progress Tracking**: Real-time progress updates and periodic saves
- ✅ **Metadata Filtering**: Removes URLs, spam text, and unwanted content from metadata
- ✅ **Size Filtering**: Only processes files between 1MB and 100MB

## Requirements

### Python Dependencies

Install the required Python package:

```bash
pip install -r requirements.txt
```

Or manually:

```bash
pip install mutagen
```

### System Dependencies

**FFmpeg** must be installed on your system for duration extraction:

- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt-get install ffmpeg`
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html)

Verify installation:
```bash
ffmpeg -version
ffprobe -version
```

## Configuration

All configuration is done by editing variables at the top of the script. **No command-line arguments needed.**

### Basic Configuration

Open `extract_tracks_info.py` and edit these variables:

```python
# Input/Output Configuration
INPUT_DIR = "/path/to/audio/tracks"  # Root directory containing audio files
OUTPUT_JSON = "open_tracks_tracks.json"  # Output JSON file path

# Processing Configuration
PARALLEL_WORKERS = 30  # Number of tracks to process in parallel (1-50 recommended)
FLUSH_EVERY = 100  # Save progress every N tracks

# Test Mode Configuration
TEST_MODE = False  # Set to True to run in test mode with limited tracks
TEST_TRACK_LIMIT = 90  # Number of tracks to process in test mode
```

### Configuration Options Explained

#### `INPUT_DIR`
- **Required**: Path to the root directory containing your audio files
- Subdirectories will be scanned recursively
- Example: `/Volumes/Music/OpenTracks`

#### `OUTPUT_JSON`
- Output file path for the JSON results
- Can be absolute or relative path
- Example: `open_tracks_2024.json` or `/data/tracks.json`

#### `PARALLEL_WORKERS`
- Number of tracks to process simultaneously
- **Recommended**: 20-30 for most systems
- Higher values = faster processing but more CPU/memory usage
- Lower values = slower but more stable on limited hardware

#### `FLUSH_EVERY`
- How often to save progress (in number of tracks)
- **Recommended**: 100 for most cases
- Lower values = more frequent saves (safer but slower)
- Higher values = less frequent saves (faster but riskier)

#### `TEST_MODE`
- Set to `True` to enable test mode
- Set to `False` for normal operation
- See "Test Mode" section below for details

#### `TEST_TRACK_LIMIT`
- Number of tracks to process in test mode
- Only used when `TEST_MODE = True`
- Recommended: 50-100 for meaningful estimates

## Usage

### Step 1: Configure the Script

Edit the configuration variables at the top of `extract_tracks_info.py`:

```python
INPUT_DIR = "/Volumes/Music/MyTracks"
OUTPUT_JSON = "my_tracks.json"
PARALLEL_WORKERS = 30
TEST_MODE = False
```

### Step 2: Run the Script

```bash
python extract_tracks_info.py
```

That's it! No command-line arguments needed.

## Test Mode

Test mode allows you to verify the script works correctly and estimate processing time before running on your full dataset.

### How to Use Test Mode

1. **Enable test mode** in the script:
   ```python
   TEST_MODE = True
   TEST_TRACK_LIMIT = 90
   ```

2. **Run the script**:
   ```bash
   python extract_tracks_info.py
   ```

3. **Review the output**:
   - Check the generated JSON file
   - Review the time estimates
   - Verify metadata quality

4. **Disable test mode** for full processing:
   ```python
   TEST_MODE = False
   ```

### Test Mode Output

When test mode is enabled, you'll see output like this:

```
============================================================
[TEST MODE] ENABLED - Processing only 90 tracks
============================================================

[SCAN] Walking directory tree: /path/to/tracks
[SCAN] Total discovered: 5,432 tracks
[SCAN] New tracks to add: 90
[META] Processing 90 tracks with 30 workers...
[META] Progress: 30/90 tracks (33%)
[META] Progress: 60/90 tracks (66%)
[META] Progress: 90/90 tracks (100%)

============================================================
[TEST MODE] Test run completed!
============================================================
[TEST MODE] Tracks processed: 90 / 5,432 total discovered
[TEST MODE]
[TEST MODE] Phase 1 (Scanning): 2.3 seconds
[TEST MODE] Phase 2 (Metadata): 45.7 seconds
[TEST MODE] Total time: 48.0 seconds
[TEST MODE]
[TEST MODE] Average per track: 0.53 seconds
[TEST MODE]
[TEST MODE] ESTIMATED TIME FOR FULL DATASET:
[TEST MODE] - Total tracks: 5,432
[TEST MODE] - Estimated time: ~48 minutes
[TEST MODE]
[TEST MODE] Output saved to: open_tracks_tracks.json
[TEST MODE] Review the JSON to verify output quality.
[TEST MODE] Set TEST_MODE = False to process all tracks.
============================================================
```

## How It Works

### Phase 1: Scanning

- Walks the entire directory tree
- Identifies audio files by extension (`.mp3`, `.wav`, `.flac`, `.aif`, `.aiff`, `.ogg`, `.m4a`, `.aac`, `.opus`)
- Filters files by size (1MB - 100MB)
- **Skips files already in the JSON** (incremental updates)
- Assigns a unique UUID to each NEW track
- Creates/updates JSON file

### Phase 2: Metadata Extraction (Parallel)

For each unprocessed track (in parallel):
1. **Duration**: Extracted using FFprobe
2. **Metadata**: Extracted using Mutagen library
   - Title
   - Artist(s) - parsed and sanitized
   - Album
   - Genre (first genre only)
   - Year (4-digit year between 1900-2030)
   - Label/Publisher
3. **Filtering**: Removes URLs, spam text, and unwanted content
4. **Sanitization**: Ensures database compatibility

Progress is saved every N tracks (configurable with `FLUSH_EVERY`).

## Incremental Updates

The script supports incremental updates - you can add new tracks without re-processing existing ones:

1. **First run**: Processes all tracks in `INPUT_DIR`
2. **Add new tracks** to `INPUT_DIR`
3. **Run again**: Only new tracks are processed
4. **Existing tracks** are automatically skipped

**How it works:**
- Tracks are identified by their full path (`original_path`)
- If a path already exists in the JSON, it's skipped in Phase 1
- If `meta_extracted: true`, it's skipped in Phase 2

**Note**: If you move or rename a file, it will be treated as a new track.

## Output Format

The script generates a JSON file with the following structure:

```json
[
  {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "original_path": "/path/to/track.mp3",
    "filename": "track.mp3",
    "file_size": 8456789,
    "duration_sec": 245.67,
    "title": "Track Title",
    "artist": "Artist Name",
    "artist_names": ["Artist Name"],
    "album": "Album Title",
    "genre": "Electronic",
    "year": 2024,
    "label": "Label Name",
    "type": "open",
    "meta_extracted": true,
    "error": null
  }
]
```

## Performance Tuning

### Adjusting Parallel Workers

The `PARALLEL_WORKERS` setting controls how many tracks are processed simultaneously:

- **Low-end systems** (2-4 cores): Set to 10-15
- **Mid-range systems** (4-8 cores): Set to 20-30
- **High-end systems** (8+ cores): Set to 30-50

**Note**: More workers = faster processing but higher CPU/memory usage.

### Adjusting Flush Frequency

The `FLUSH_EVERY` setting controls how often progress is saved:

- **Frequent saves** (safer): Set to 50
- **Balanced** (recommended): Set to 100
- **Less frequent** (faster): Set to 200-500

**Note**: Lower values are safer but slightly slower due to more disk writes.

## Resume Capability

The script is designed to be resume-capable:

1. Progress is saved every N tracks (configurable)
2. If interrupted, simply run the script again
3. Tracks where `meta_extracted: true` are automatically skipped
4. Only unprocessed tracks will be handled

## Error Handling

Tracks with errors are marked but not skipped:

- `meta_extracted: true` - Track was processed
- `error: "error message"` - Description of what went wrong
- Metadata fields remain empty or null for failed extractions

Common errors:
- File not found (moved/deleted after scan)
- Unsupported audio format
- Corrupted file
- FFmpeg not available (duration will be null)

## Metadata Filtering

The script automatically filters metadata to remove spam and unwanted content:

### Title Filtering
- Removes: `(Original Mix)`
- Truncates at: `https:`, `www.`, `_www.`, `VINYL ONLY`
- Removes entire title if it's just a URL

### Other Fields (Artist, Album, Genre, Label)
- Truncates at: `https:`, `www.`, `_www.`
- Removes entire field if it's just a URL

### Sanitization
- Removes control characters and null bytes
- Replaces problematic characters (backslashes, quotes)
- Enforces database column length limits:
  - Artist: 100 chars
  - Label: 120 chars
  - Genre: 80 chars
  - Album: 200 chars

## Transferring to Another System

To use this script on another system:

1. Copy the entire `scripts/open_tracks/` directory:
   ```bash
   scp -r scripts/open_tracks/ user@remote:/path/to/destination/
   ```

2. On the remote system, install dependencies:
   ```bash
   cd /path/to/destination/open_tracks/
   pip install -r requirements.txt
   ```

3. Ensure FFmpeg is installed:
   ```bash
   ffmpeg -version
   ```

4. Edit configuration in the script:
   ```python
   INPUT_DIR = "/path/to/tracks/on/remote"
   OUTPUT_JSON = "tracks.json"
   ```

5. Run the script:
   ```bash
   python extract_tracks_info.py
   ```

## Troubleshooting

### "No module named 'mutagen'"
```bash
pip install mutagen
```

### "ffprobe command not found"
Install FFmpeg on your system. Duration extraction will be skipped if FFmpeg is not available, but metadata extraction will still work.

### Script is slow
- Increase `PARALLEL_WORKERS` (e.g., 40-50)
- Increase `FLUSH_EVERY` to reduce disk writes (e.g., 200)
- Ensure the audio files are on a fast drive (not network/USB 2.0)
- FFprobe can be slow on some formats; this is normal

### High CPU/Memory usage
- Decrease `PARALLEL_WORKERS` (e.g., 10-15)
- Close other applications
- Process in smaller batches using test mode

### JSON file is corrupted
The script uses atomic writes (`.tmp` file + rename), so corruption should be rare. If it happens:
1. Check if a `.tmp` file exists and is valid
2. Delete the corrupted JSON and restart (Phase 1 will re-scan)

### "Input directory does not exist"
Edit the `INPUT_DIR` variable at the top of the script to point to your actual tracks directory.

## Example Workflow

### First Time Setup

1. **Edit configuration**:
   ```python
   INPUT_DIR = "/Volumes/Music/Tracks"
   OUTPUT_JSON = "tracks.json"
   PARALLEL_WORKERS = 30
   TEST_MODE = True
   TEST_TRACK_LIMIT = 100
   ```

2. **Run test mode**:
   ```bash
   python extract_tracks_info.py
   ```

3. **Review output** and time estimates

4. **Disable test mode**:
   ```python
   TEST_MODE = False
   ```

5. **Run full processing**:
   ```bash
   python extract_tracks_info.py
   ```

### Adding New Tracks Later

1. Add new audio files to `INPUT_DIR`
2. Run the script again:
   ```bash
   python extract_tracks_info.py
   ```
3. Only new tracks will be processed!

## License

Part of the Resomix project.
