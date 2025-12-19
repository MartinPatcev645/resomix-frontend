"""
Open Tracks - Extract Tracks Info Script (Standalone)
======================================================

This standalone script scans a folder tree for audio files, assigns UUIDs,
and writes them to a JSON file. On a second pass, it enriches each track
entry with metadata (title, artist, album, genre, year, label), file size,
duration, and track type using mutagen + FFmpeg.

This script is completely standalone and does not require any imports from
the main application. All necessary functions and constants are included.

Features:
- Parallel processing with configurable workers
- Incremental updates (skip existing tracks on re-runs)
- Test mode with time tracking and ETA predictions
- Resume capability

Dependencies:
    - mutagen (pip install mutagen)
    - ffmpeg and ffprobe (must be installed on system)
"""

from __future__ import annotations

import html
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, BinaryIO, Optional, Union

from mutagen import File as MutagenFile, MutagenError
from mutagen.id3 import ID3


# ============================================================================
# CONFIGURATION - Modify these variables as needed
# ============================================================================

# Input/Output Configuration
INPUT_DIR = "/mnt/data/OPEN_TRACKS/RAW"  # Root directory containing audio files
OUTPUT_JSON = "open_tracks.json"  # Output JSON file path

# Processing Configuration
PARALLEL_WORKERS = 30  # Number of tracks to process in parallel (1-50 recommended)
FLUSH_EVERY = 100  # Save progress every N tracks

# Test Mode Configuration
TEST_MODE = False  # Set to True to run in test mode with limited tracks
TEST_TRACK_LIMIT = 90  # Number of tracks to process in test mode

# File Size Limits
MIN_SIZE_BYTES = 1 * 1024 * 1024        # 1 MB
MAX_SIZE_BYTES = 100 * 1024 * 1024      # 100 MB

# Audio file extensions to scan
AUDIO_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".flac",
    ".aiff"
}

# Metadata filtering configuration
TITLE_REMOVAL_STRINGS = ["(Original Mix)"]
TITLE_STOPPER_STRINGS = ["https:", "www.", "_www.", "VINYL ONLY"]
META_STOPPER_STRINGS = ["https:", "www.", "_www."]
META_STOPPER_REGEX = r"^(https?://[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:/[^\s]*)?)$"


# ============================================================================
# CONSTANTS
# ============================================================================

# Track type constant
TRACK_TYPE_OPEN = "open"


# ============================================================================
# SANITIZATION UTILITIES
# ============================================================================

def sanitize_name(name: str, field_type: str = "name") -> str:
    """
    Sanitize name for database insertion.
    
    Removes or replaces problematic characters that could cause
    database constraint violations or SQL issues.
    
    Args:
        name: Raw name from metadata
        field_type: Type of field for logging (e.g., "artist", "label", "genre")
        
    Returns:
        Sanitized name safe for database insertion
    """
    if not name or not isinstance(name, str):
        return "Unknown"
    
    # Remove null bytes and control characters
    name = ''.join(char for char in name if ord(char) >= 32)
    
    # Replace problematic characters
    replacements = {
        '\\': '/',  # Replace backslashes with forward slashes
        '"': "'",   # Replace double quotes with single quotes
        '`': "'",   # Replace backticks with single quotes
        '\x00': '', # Remove null bytes
        '\x01': '', '\x02': '', '\x03': '', '\x04': '', '\x05': '',
        '\x06': '', '\x07': '', '\x08': '', '\x0b': '', '\x0c': '',
        '\x0e': '', '\x0f': '', '\x10': '', '\x11': '', '\x12': '',
        '\x13': '', '\x14': '', '\x15': '', '\x16': '', '\x17': '',
        '\x18': '', '\x19': '', '\x1a': '', '\x1b': '', '\x1c': '',
        '\x1d': '', '\x1e': '', '\x1f': '',
    }
    
    for old_char, new_char in replacements.items():
        name = name.replace(old_char, new_char)
    
    # Normalize whitespace
    name = ' '.join(name.split())
    
    # Trim to appropriate database column limits
    if field_type == "artist":
        max_length = 100  # VARCHAR(100) for artists
    elif field_type == "label":
        max_length = 120  # VARCHAR(120) for labels
    elif field_type == "genre":
        max_length = 80   # VARCHAR(80) for genres
    elif field_type == "album":
        max_length = 200  # VARCHAR(200) for albums
    else:
        max_length = 100  # Default
    
    if len(name) > max_length:
        name = name[:max_length-3] + "..."
    
    # Ensure we have a valid name
    if not name or name.isspace():
        return "Unknown"
    
    return name.strip()


def sanitize_artist_name(name: str) -> str:
    """Sanitize artist name for database insertion."""
    return sanitize_name(name, "artist")


def sanitize_label_name(name: str) -> str:
    """Sanitize label name for database insertion."""
    return sanitize_name(name, "label")


def sanitize_genre_name(name: str) -> str:
    """Sanitize genre name for database insertion."""
    return sanitize_name(name, "genre")


def sanitize_album_title(title: str) -> str:
    """Sanitize album title for database insertion."""
    return sanitize_name(title, "album")


# ============================================================================
# AUDIO SERVICE (FFmpeg utilities)
# ============================================================================

class AudioService:
    """Service for audio file validation and processing using FFmpeg."""
    
    @staticmethod
    def is_ffmpeg_installed() -> bool:
        """
        Check if FFmpeg is installed and available in the system path.
        
        Returns:
            bool: True if FFmpeg is installed, False otherwise
        """
        try:
            # Try to run ffmpeg -version to check if it's installed
            result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
            return result.returncode == 0
        except (FileNotFoundError, subprocess.SubprocessError):
            print("[FFmpeg Validation] ERROR: FFmpeg (ffprobe) not found on system path!")
            return False
    
    @staticmethod
    def is_ffmpeg_available() -> bool:
        """
        Check if FFmpeg is available (alias for is_ffmpeg_installed for compatibility).
        
        Returns:
            bool: True if FFmpeg is available, False otherwise
        """
        return AudioService.is_ffmpeg_installed()
    
    @staticmethod
    def get_audio_duration(audio_bytes: bytes, filename: str) -> Optional[float]:
        """
        Extract audio duration in seconds using FFprobe.
        
        Args:
            audio_bytes: The raw bytes of the audio file.
            filename: Original filename (used for logging and temp file extension).
            
        Returns:
            float: Duration in seconds if successful, None otherwise.
        """
        temp_path = None
        
        try:
            # Create a temporary file to pass to ffprobe
            # Use secure random filename - NEVER trust uploaded filename for security
            with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as temp_file:
                temp_path = temp_file.name
                temp_file.write(audio_bytes)

            # Use FFprobe to get duration
            cmd = [
                'ffprobe',
                '-v', 'error',             # Suppress verbose output, only errors
                '-show_entries', 'format=duration',  # Only get duration from format
                '-print_format', 'json',   # Output as JSON
                temp_path
            ]
            
            # Execute FFprobe command
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0 and result.stdout:
                try:
                    ffprobe_output = json.loads(result.stdout)
                    if "format" in ffprobe_output and isinstance(ffprobe_output["format"], dict):
                        duration_str = ffprobe_output["format"].get("duration")
                        if duration_str:
                            duration = float(duration_str)
                            return duration
                        else:
                            return None
                    else:
                        return None
                except (json.JSONDecodeError, ValueError):
                    return None
            else:
                return None
        
        except FileNotFoundError:
            print("[FFmpeg Duration] ERROR: ffprobe command not found. Please ensure FFmpeg is installed.")
            return None
        except subprocess.SubprocessError:
            return None
        except Exception:
            return None
        
        finally:
            # Clean up temporary file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass


# ============================================================================
# METADATA SERVICE
# ============================================================================

class MetadataService:
    """Service for audio metadata extraction with multiple extraction modes."""
    
    # Limited extraction mapping (for focused extraction)
    _LIMITED_ID3_MAP: Dict[str, str] = {
        "TIT2": "Title",
        "TALB": "Album",
        "TPE1": "Artist",
        "TCON": "Genre",
        "TDRC": "Year",  # v2.4 Recording time
        "TYER": "Year",  # v2.3 Year
        "TPUB": "Label",  # Publisher → Label
    }

    _LIMITED_VORBIS_MAP: Dict[str, str] = {
        "TITLE": "Title",
        "ALBUM": "Album",
        "ARTIST": "Artist",
        "GENRE": "Genre",
        "YEAR": "Year",
        "DATE": "Year",      # Some FLACs use DATE for year
        "LABEL": "Label",
        "PUBLISHER": "Label",
    }

    # Common constants
    _IMAGE_FRAME_IDS = {"APIC", "PIC"}
    _IMAGE_VORBIS_KEYS = {"METADATA_BLOCK_PICTURE", "COVERART", "COVERARTMIME"}
    _COMMENT_IDS = {"COMM"}
    _YEAR_FROM_DATE = re.compile(r"^(\d{4})")

    @staticmethod
    def extract_metadata(file_obj: BinaryIO, filename: str = "", mode: str = "comprehensive") -> Dict[str, Any]:
        """
        Extract metadata from audio file with different extraction modes.
        
        Args:
            file_obj: Binary file object to extract metadata from
            filename: Original filename (for logging)
            mode: Extraction mode - "limited" for basic tags only, "comprehensive" for all metadata
            
        Returns:
            Dict containing extracted metadata or error information
        """
        if mode == "limited":
            return MetadataService._extract_limited_metadata(file_obj, filename)
        else:
            # For this standalone script, we only need limited mode
            return MetadataService._extract_limited_metadata(file_obj, filename)

    @staticmethod
    def _extract_limited_metadata(file_obj: BinaryIO, filename: str = "") -> Dict[str, str]:
        """Extract only basic metadata fields (Title, Album, Artist, Genre, Year, Label)."""
        wanted: Dict[str, str] = {}
        file_obj.seek(0)
        
        try:
            audio = MutagenFile(file_obj, easy=False)
        except MutagenError as e:
            return {"error": str(e)}

        if audio is None or audio.tags is None:
            return wanted  # empty dict – nothing found / unsupported format

        if isinstance(audio.tags, ID3):
            MetadataService._gather_limited_id3(audio.tags, wanted)
        else:
            MetadataService._gather_limited_vorbis(dict(audio.tags), wanted)

        return wanted

    @staticmethod
    def _to_str(val: Any) -> str:
        """Convert value to string for limited extraction."""
        if val is None:
            return ""
        if isinstance(val, (bytes, bytearray)):
            try:
                return val.decode("utf-8", errors="replace").strip()
            except Exception:
                return ""
        return str(val).strip()

    @staticmethod
    def _first(lst: List[str]) -> str:
        """Get first element from list or empty string."""
        return lst[0] if lst else ""

    @staticmethod
    def _gather_limited_id3(tags: ID3, out: Dict[str, str]):
        """Gather limited ID3 tags."""
        for frame in tags.values():
            fid = frame.FrameID
            if fid in MetadataService._IMAGE_FRAME_IDS or fid in MetadataService._COMMENT_IDS:
                continue
            key = MetadataService._LIMITED_ID3_MAP.get(fid)
            if not key:
                continue  # skip unneeded tags
            if hasattr(frame, "text"):
                txt = MetadataService._to_str(MetadataService._first(frame.text or []))
                if not txt:
                    continue
                if key == "Year":
                    m = MetadataService._YEAR_FROM_DATE.match(txt)
                    txt = m.group(1) if m else txt
                
                # Apply filtering to the extracted value
                if key == "Title":
                    txt = MetadataService._filter_title_field(txt)
                elif key in ["Artist", "Album", "Genre", "Label"]:
                    txt = MetadataService._filter_metadata_field(txt, key)
                
                # Only add non-empty filtered values
                if txt:
                    out.setdefault(key, txt)

    @staticmethod
    def _gather_limited_vorbis(vc: Dict[str, List[str]], out: Dict[str, str]):
        """Gather limited Vorbis tags."""
        for k, vals in vc.items():
            up = k.upper()
            if up in MetadataService._IMAGE_VORBIS_KEYS:
                continue
            key = MetadataService._LIMITED_VORBIS_MAP.get(up)
            if not key:
                continue
            value_str = MetadataService._to_str(MetadataService._first(vals if isinstance(vals, list) else [vals]))
            if not value_str:
                continue
            if key == "Year":
                m = MetadataService._YEAR_FROM_DATE.match(value_str)
                value_str = m.group(1) if m else value_str
            
            # Apply filtering to the extracted value
            if key == "Title":
                value_str = MetadataService._filter_title_field(value_str)
            elif key in ["Artist", "Album", "Genre", "Label"]:
                value_str = MetadataService._filter_metadata_field(value_str, key)
            
            # Only add non-empty filtered values
            if value_str:
                out.setdefault(key, value_str)

    @staticmethod
    def _filter_metadata_field(field_value: str, field_name: str = "") -> str:
        """
        Filter metadata field by removing URLs/domains and applying stopper strings.
        
        Processing order:
        1. Apply regex check (if entire field matches domain/URL pattern, return empty string)
        2. Apply stopper strings (truncate at first occurrence)
        
        Args:
            field_value: Original field value
            field_name: Field name for logging (optional)
            
        Returns:
            Filtered field value
        """
        if not field_value:
            return field_value
        
        # Trim whitespace first
        filtered_value = field_value.strip()
        if not filtered_value:
            return ""
        
        # Step 1: Apply regex check - if entire field matches domain/URL pattern, remove it
        try:
            if re.match(META_STOPPER_REGEX, filtered_value, re.IGNORECASE):
                return ""  # Return empty string if entire field is a URL/domain
        except re.error:
            # If regex is invalid, skip regex filtering but continue with stopper strings
            pass
        
        # Step 2: Apply stopper strings (case-insensitive)
        # Find the earliest occurrence of any stopper string
        earliest_stop_position = len(filtered_value)
        
        for stopper in META_STOPPER_STRINGS:
            # Case-insensitive search
            stop_position = filtered_value.lower().find(stopper.lower())
            if stop_position != -1 and stop_position < earliest_stop_position:
                earliest_stop_position = stop_position
        
        # Truncate at the earliest stopper position if found
        if earliest_stop_position < len(filtered_value):
            filtered_value = filtered_value[:earliest_stop_position]
        
        # Clean up extra whitespace
        filtered_value = re.sub(r'\s+', ' ', filtered_value).strip()
        
        return filtered_value

    @staticmethod
    def _filter_title_field(title: str) -> str:
        """
        Filter title field with both title-specific and meta filtering.
        
        Processing order:
        1. Apply meta regex check (if entire title matches domain/URL pattern, return empty string)
        2. Apply title stopper strings (truncate at first occurrence)
        3. Apply title removal strings (remove completely)
        
        Args:
            title: Original title
            
        Returns:
            Filtered title
        """
        if not title:
            return title
        
        # Trim whitespace first
        filtered_title = title.strip()
        if not filtered_title:
            return ""
        
        # Step 1: Apply meta regex check - if entire title matches domain/URL pattern, remove it
        try:
            if re.match(META_STOPPER_REGEX, filtered_title, re.IGNORECASE):
                return ""  # Return empty string if entire title is a URL/domain
        except re.error:
            # If regex is invalid, skip regex filtering but continue with other filters
            pass
        
        # Step 2: Apply title stopper strings (case-insensitive)
        # Find the earliest occurrence of any stopper string
        earliest_stop_position = len(filtered_title)
        
        for stopper in TITLE_STOPPER_STRINGS:
            # Case-insensitive search
            stop_position = filtered_title.lower().find(stopper.lower())
            if stop_position != -1 and stop_position < earliest_stop_position:
                earliest_stop_position = stop_position
        
        # Truncate at the earliest stopper position if found
        if earliest_stop_position < len(filtered_title):
            filtered_title = filtered_title[:earliest_stop_position]
        
        # Step 3: Apply title removal strings (case-insensitive)
        for removal_string in TITLE_REMOVAL_STRINGS:
            # Case-insensitive replacement
            filtered_title = re.sub(re.escape(removal_string), '', filtered_title, flags=re.IGNORECASE)
        
        # Clean up extra whitespace
        filtered_title = re.sub(r'\s+', ' ', filtered_title).strip()
        
        return filtered_title

    @staticmethod
    def get_basic_metadata(file_obj: BinaryIO, filename: str = "") -> Dict[str, str]:
        """Get only the most essential metadata fields."""
        return MetadataService.extract_metadata(file_obj, filename, mode="limited")


# ============================================================================
# PARSING HELPERS
# ============================================================================

DELIM_PATTERN = re.compile(
    r"""\s*(?:,|;|\s+&\s+|\s+&amp;\s+)\s*""",
    re.IGNORECASE,
)


def parse_artist_names(raw: str) -> List[str]:
    """
    Parse artist names from a comma/separator‑delimited string.
    Mirrors the logic in TrackUploadService.parse_artist_names,
    but kept local so this script can run standalone.
    """
    if not raw:
        return []

    raw = html.unescape(raw)
    parts = DELIM_PATTERN.split(raw)
    return [p.strip() for p in parts if p.strip()]


def extract_first_genre(genre_string: str) -> str:
    """
    Extract the first genre from a comma‑separated string, matching
    TrackUploadService.extract_first_genre semantics.
    """
    if not genre_string or not genre_string.strip():
        return ""

    genres = re.split(r"[;,]", genre_string.strip())
    first_genre = genres[0].strip()
    if not first_genre:
        return ""

    # Ensure it fits DB VARCHAR(80) limit
    if len(first_genre) > 80:
        first_genre = first_genre[:77] + "..."
    return first_genre


def parse_year(year_str: str | int | None) -> int | None:
    """
    Parse year in the same way TrackUploadService._parse_year does:
    extract a 4‑digit year in a reasonable range (1900‑2030).
    """
    if not year_str:
        return None

    try:
        text = str(year_str)
        m = re.search(r"\b(\d{4})\b", text)
        if not m:
            return None
        year = int(m.group(1))
        if 1900 <= year <= 2030:
            return year
        return None
    except (ValueError, TypeError):
        return None


def generate_hyphenated_uuid() -> str:
    """
    Generate a standard 36‑character UUID string like:
    550e8400-e29b-41d4-a716-446655440000
    """
    return str(uuid.uuid4())


# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass
class TrackRecord:
    # Phase 1 fields
    uuid: str
    original_path: str
    filename: str

    # Phase 2 fields (may be filled later)
    file_size: int | None = None
    duration_sec: float | None = None
    title: str = ""
    artist: str = ""              # sanitized, comma‑separated artists
    artist_names: List[str] | None = None  # optional list of sanitized names
    album: str = ""
    genre: str = ""
    year: int | None = None
    label: str = ""
    type: str = TRACK_TYPE_OPEN

    # Internal bookkeeping
    meta_extracted: bool = False
    error: str | None = None      # for any extraction errors


# ============================================================================
# CORE LOGIC
# ============================================================================

def scan_tracks(root_dir: str, existing_paths: set, limit: Optional[int] = None) -> tuple[List[TrackRecord], int]:
    """
    Phase 1: walk the directory tree and collect all tracks within
    the size bounds, assigning a UUID to each.
    
    Args:
        root_dir: Root directory to scan
        existing_paths: Set of paths already in the JSON (to skip)
        limit: Optional limit on number of NEW tracks to add
        
    Returns:
        Tuple of (new_records, total_discovered)
    """
    new_records: List[TrackRecord] = []
    total_discovered = 0
    root_dir = os.path.abspath(root_dir)

    print(f"[SCAN] Walking directory tree: {root_dir}")

    for dirpath, _dirnames, filenames in os.walk(root_dir):
        for name in filenames:
            full_path = os.path.join(dirpath, name)
            _, ext = os.path.splitext(name)
            ext = ext.lower()

            # Optional extension filter
            if AUDIO_EXTENSIONS and ext not in AUDIO_EXTENSIONS:
                continue

            try:
                size = os.path.getsize(full_path)
            except OSError as e:
                print(f"[SCAN] Skipping {full_path}: could not stat file ({e})")
                continue

            if size < MIN_SIZE_BYTES or size > MAX_SIZE_BYTES:
                # Skip too small/too large tracks as requested
                continue

            total_discovered += 1
            
            # Skip if already exists
            if full_path in existing_paths:
                continue
            
            # Check limit
            if limit is not None and len(new_records) >= limit:
                continue

            rec = TrackRecord(
                uuid=generate_hyphenated_uuid(),
                original_path=full_path,
                filename=os.path.basename(full_path),
                file_size=size,
            )
            new_records.append(rec)

    print(f"[SCAN] Total discovered: {total_discovered} tracks")
    print(f"[SCAN] New tracks to add: {len(new_records)}")
    return new_records, total_discovered


def write_json(records: List[TrackRecord], output_path: str) -> None:
    """
    Serialize the list of TrackRecord objects to JSON.
    """
    payload: List[Dict[str, Any]] = [asdict(r) for r in records]
    tmp_path = output_path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, output_path)


def load_json(output_path: str) -> List[TrackRecord]:
    """
    Load existing JSON into a list of TrackRecord objects.
    """
    with open(output_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    records: List[TrackRecord] = []
    for item in data:
        # Backwards/forward‑compatible loading
        records.append(
            TrackRecord(
                uuid=item.get("uuid"),
                original_path=item.get("original_path"),
                filename=item.get("filename"),
                file_size=item.get("file_size"),
                duration_sec=item.get("duration_sec"),
                title=item.get("title", ""),
                artist=item.get("artist", ""),
                artist_names=item.get("artist_names"),
                album=item.get("album", ""),
                genre=item.get("genre", ""),
                year=item.get("year"),
                label=item.get("label", ""),
                type=item.get("type", TRACK_TYPE_OPEN),
                meta_extracted=item.get("meta_extracted", False),
                error=item.get("error"),
            )
        )
    return records


def extract_single_track_metadata(rec: TrackRecord, audio_service: AudioService) -> None:
    """
    Extract metadata for a single track (used in parallel processing).
    Updates the TrackRecord in-place.
    """
    if not os.path.exists(rec.original_path):
        rec.error = "File not found on disk"
        rec.meta_extracted = True
        return

    try:
        # Read bytes once for duration + mutagen
        with open(rec.original_path, "rb") as f:
            audio_bytes = f.read()

        rec.file_size = len(audio_bytes)

        # Duration via FFmpeg
        if audio_service.is_ffmpeg_available():
            duration = audio_service.get_audio_duration(audio_bytes, rec.filename)
        else:
            duration = None

        rec.duration_sec = float(duration) if duration is not None else None

        # Metadata via MetadataService in "limited" mode (mutagen)
        with open(rec.original_path, "rb") as f_meta:
            metadata = MetadataService.get_basic_metadata(f_meta, rec.filename)

        # If MetadataService returns an error dict, keep fields blank
        if isinstance(metadata, dict) and "error" in metadata:
            rec.error = f"Metadata extraction error: {metadata['error']}"
        else:
            # Title
            raw_title = metadata.get("Title") if isinstance(metadata, dict) else None
            rec.title = (raw_title or "").strip()

            # Year
            raw_year = metadata.get("Year") if isinstance(metadata, dict) else None
            rec.year = parse_year(raw_year)

            # Artist(s)
            raw_artist = metadata.get("Artist") if isinstance(metadata, dict) else ""
            artist_parts = parse_artist_names(raw_artist)
            sanitized_artists = [
                sanitize_artist_name(a) for a in artist_parts if a
            ]
            rec.artist_names = sanitized_artists or []
            rec.artist = ", ".join(sanitized_artists)

            # Label
            raw_label = metadata.get("Label") if isinstance(metadata, dict) else ""
            if raw_label:
                rec.label = sanitize_label_name(raw_label)
            else:
                rec.label = ""

            # Genre (first only)
            raw_genre = metadata.get("Genre") if isinstance(metadata, dict) else ""
            first_genre = extract_first_genre(raw_genre)
            if first_genre:
                rec.genre = sanitize_genre_name(first_genre)
            else:
                rec.genre = ""

            # Album
            raw_album = metadata.get("Album") if isinstance(metadata, dict) else ""
            if raw_album:
                rec.album = sanitize_album_title(raw_album)
            else:
                rec.album = ""

        rec.type = TRACK_TYPE_OPEN
        rec.meta_extracted = True

    except Exception as e:
        rec.error = f"Unexpected error during metadata extraction: {e}"
        rec.meta_extracted = True


def enrich_metadata_parallel(records: List[TrackRecord], flush_every: int, output_path: str, max_workers: int) -> None:
    """
    Phase 2: Extract metadata for all tracks using parallel processing.
    """
    audio_service = AudioService()
    
    # Filter unprocessed tracks
    unprocessed = [r for r in records if not r.meta_extracted]
    
    if not unprocessed:
        print("[META] All tracks already processed.")
        return
    
    total = len(unprocessed)
    print(f"[META] Processing {total} tracks with {max_workers} workers...")
    
    processed_count = 0
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_record = {
            executor.submit(extract_single_track_metadata, rec, audio_service): rec 
            for rec in unprocessed
        }
        
        for future in as_completed(future_to_record):
            rec = future_to_record[future]
            try:
                future.result()  # This updates rec in-place
                processed_count += 1
                
                # Progress update
                if processed_count % 10 == 0 or processed_count == total:
                    print(f"[META] Progress: {processed_count}/{total} tracks ({100*processed_count//total}%)")
                
                # Periodic flush
                if processed_count % flush_every == 0:
                    write_json(records, output_path)
                    print(f"[META] Saved progress to {output_path}")
                    
            except Exception as e:
                print(f"[META] Error processing {rec.filename}: {e}")
                rec.error = str(e)
                rec.meta_extracted = True
    
    # Final flush
    write_json(records, output_path)
    print(f"[META] Completed! Saved {len(records)} records to {output_path}")


def format_time(seconds: float) -> str:
    """Format seconds into human-readable time string."""
    if seconds < 60:
        return f"{seconds:.1f} seconds"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f} minutes"
    else:
        hours = seconds / 3600
        return f"{hours:.1f} hours"


def print_test_mode_summary(processed: int, total_discovered: int, phase1_time: float, phase2_time: float) -> None:
    """Print test mode summary with time estimates."""
    total_time = phase1_time + phase2_time
    avg_per_track = total_time / processed if processed > 0 else 0
    
    # Estimate for full dataset
    estimated_total = avg_per_track * total_discovered if total_discovered > 0 else 0
    
    print("\n" + "="*60)
    print("[TEST MODE] Test run completed!")
    print("="*60)
    print(f"[TEST MODE] Tracks processed: {processed:,} / {total_discovered:,} total discovered")
    print(f"[TEST MODE]")
    print(f"[TEST MODE] Phase 1 (Scanning): {format_time(phase1_time)}")
    print(f"[TEST MODE] Phase 2 (Metadata): {format_time(phase2_time)}")
    print(f"[TEST MODE] Total time: {format_time(total_time)}")
    print(f"[TEST MODE]")
    print(f"[TEST MODE] Average per track: {avg_per_track:.2f} seconds")
    print(f"[TEST MODE]")
    print(f"[TEST MODE] ESTIMATED TIME FOR FULL DATASET:")
    print(f"[TEST MODE] - Total tracks: {total_discovered:,}")
    print(f"[TEST MODE] - Estimated time: ~{format_time(estimated_total)}")
    print(f"[TEST MODE]")
    print(f"[TEST MODE] Output saved to: {OUTPUT_JSON}")
    print(f"[TEST MODE] Review the JSON to verify output quality.")
    print(f"[TEST MODE] Set TEST_MODE = False to process all tracks.")
    print("="*60 + "\n")


# ============================================================================
# MAIN
# ============================================================================

def main() -> None:
    """Main entry point."""
    
    # Validate input directory
    if not os.path.isdir(INPUT_DIR):
        print(f"ERROR: Input directory does not exist or is not a directory: {INPUT_DIR}")
        print(f"Please edit the INPUT_DIR variable at the top of this script.")
        sys.exit(1)
    
    # Test mode notification
    if TEST_MODE:
        print(f"\n{'='*60}")
        print(f"[TEST MODE] ENABLED - Processing only {TEST_TRACK_LIMIT} tracks")
        print(f"{'='*60}\n")
    
    total_discovered = 0
    
    # Phase 1: Scan for tracks
    phase1_start = time.time()
    
    # Load existing records if JSON exists
    if os.path.exists(OUTPUT_JSON):
        print(f"[INFO] Loading existing JSON: {OUTPUT_JSON}")
        existing_records = load_json(OUTPUT_JSON)
        existing_paths = {r.original_path for r in existing_records}
        print(f"[INFO] Found {len(existing_records)} existing records")
    else:
        existing_records = []
        existing_paths = set()
        print(f"[INFO] No existing JSON found, starting fresh")
    
    # Scan for new tracks
    limit = TEST_TRACK_LIMIT if TEST_MODE else None
    new_records, total_discovered = scan_tracks(INPUT_DIR, existing_paths, limit)
    
    # Combine existing and new records
    all_records = existing_records + new_records
    
    phase1_time = time.time() - phase1_start
    
    if not new_records:
        print("[INFO] No new tracks to process.")
        if TEST_MODE:
            print_test_mode_summary(0, total_discovered, phase1_time, 0)
        return
    
    # Write after Phase 1 (with new UUIDs assigned)
    write_json(all_records, OUTPUT_JSON)
    print(f"[WRITE] Saved {len(all_records)} total records (including {len(new_records)} new)")
    
    # Phase 2: Metadata enrichment
    phase2_start = time.time()
    enrich_metadata_parallel(all_records, FLUSH_EVERY, OUTPUT_JSON, PARALLEL_WORKERS)
    phase2_time = time.time() - phase2_start
    
    # Test mode summary
    if TEST_MODE:
        print_test_mode_summary(len(new_records), total_discovered, phase1_time, phase2_time)


if __name__ == "__main__":
    main()
