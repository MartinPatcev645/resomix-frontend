"""
Metadata Extraction Module
==========================

This module provides functionality for extracting rich metadata from audio files
using the Mutagen library.

Functions:
- extract_metadata_from_file_object: Reads metadata from a file-like object.

Author: AI Assistant (based on user provided sample)
Date: May 2023
"""

from mutagen import File as MutagenFile
from mutagen.id3 import ID3, TIT2, TPE1, TALB, TCON, TDRC, TDRL, TRCK, TPOS, TBPM, TSRC, TPUB, TPE2, TCOM, COMM, APIC

def parse_tags(upload_file) -> dict:
    # Ensure file pointer at start
    upload_file.file.seek(0)
    audio = MutagenFile(upload_file.file)  # Auto-detects format and reads tags
    if audio is None or not hasattr(audio, "tags") or audio.tags is None:
        return {}  # No tags found or unsupported format
    
    tags = audio.tags
    metadata = {}
    
    # Define mapping for known ID3 frames to friendly names
    id3_map = {
        "TIT2": "Title",
        "TPE1": "Artist",
        "TPE2": "Album Artist",
        "TALB": "Album",
        "TCON": "Genre",
        "TDRC": "Year",         # Recording date/year
        "TYER": "Year",         # Year (ID3v2.3)
        "TDRL": "Release Date", # Release date
        "TRCK": "Track Number",
        "TPOS": "Disc Number",
        "TBPM": "BPM",
        "TSRC": "ISRC",
        "TPUB": "Publisher",
        "TCOM": "Composer",
        "COMM": "Comment"
    }
    # Define common Vorbis/FLAC keys mapping if needed (usually use as-is with proper casing)
    vorbis_map = {
        "TITLE": "Title",
        "ARTIST": "Artist",
        "ALBUM": "Album",
        "ALBUMARTIST": "Album Artist",
        "GENRE": "Genre",
        "TRACKNUMBER": "Track Number",
        "TRACKTOTAL": "Track Total",   # used for combining into Track Number
        "TOTALTRACKS": "Track Total",
        "DISCNUMBER": "Disc Number",
        "DISCTOTAL": "Disc Total",
        "TOTALDISCS": "Disc Total",
        "DATE": "Release Date",
        "YEAR": "Year",
        "BPM": "BPM",
        "ISRC": "ISRC",
        "CATALOGNUMBER": "Catalog Number",
        "LABEL": "Publisher",  # some use LABEL in FLAC
        "PUBLISHER": "Publisher",
        "COMPOSER": "Composer",
        "COMMENT": "Comment",
        "COMMENTS": "Comment"
    }
    
    # Helper to add a field if value is not empty
    def add_field(name: str, value):
        if value is None or value == "" or (isinstance(value, list) and len(value) == 0):
            return
        metadata[name] = value
    
    if isinstance(tags, ID3):  # ID3 tags (MP3, WAV, AIFF)
        for frame in tags.values():
            frame_id = frame.FrameID  # e.g. "TIT2", "TPE1", etc.
            # Skip cover art frames
            if frame_id == "APIC" or frame_id == "PIC":
                continue
            friendly_name = id3_map.get(frame_id)
            # Handle text frames (T***)
            if hasattr(frame, "text"):
                values = frame.text  # list of strings
                if not values:
                    continue
                # Flatten single-value lists
                val = values if len(values) > 1 else values[0]
                # Convert numeric strings to int where appropriate
                if frame_id in ["TRCK", "TPOS"]:
                    # Handle track/disc with total if format "num/total"
                    text = str(val)
                    if "/" in text:
                        num, total = text.split("/", 1)
                        num = num.strip() or None
                        total = total.strip() or None
                        # Combine as "num/total" for output
                        if num:
                            val = f"{num}/{total}" if total else num
                    # If no slash, just use the number
                if frame_id in ["TDRC", "TYER", "TDRL"]:
                    # Dates: use string as is. Could parse year vs full date if needed.
                    val = str(val)
                if frame_id == "TBPM":
                    # BPM: try converting to int
                    try:
                        val = int(str(val))
                    except:
                        pass
                # Use friendly name if recognized, else use raw frame ID or description
                if friendly_name:
                    # Special handling for track/disc number naming
                    if frame_id == "TRCK" and "/" in str(val):
                        friendly = "Track Number"
                    elif frame_id == "TPOS" and "/" in str(val):
                        friendly = "Disc Number"
                    else:
                        friendly = friendly_name
                else:
                    friendly = frame_id  # default to frame code if unknown
                # For TXXX and other custom frames, include description in key
                if frame_id == "TXXX":
                    desc = frame.desc or frame.FrameID
                    friendly = desc  # use the TXXX description as the field name
                    # Standardize known custom fields if possible
                    if desc.upper() in vorbis_map:
                        friendly = vorbis_map[desc.upper()]
                add_field(friendly, val)
            elif frame_id == "COMM":
                # Comment frame (might have .text and .desc)
                # Mutagen's COMM frames have .text (list) and .desc (description)
                desc = getattr(frame, "desc", "")
                text_list = getattr(frame, "text", [])
                if text_list:
                    comment_text = text_list[0]
                    if desc and desc.lower() != "comment":
                        field_name = f"Comment ({desc})"
                    else:
                        field_name = "Comment"
                    add_field(field_name, comment_text)
            else:
                # Non-text frames (URLs, ratings, etc.) - include minimally
                try:
                    val = str(frame)
                except:
                    continue
                add_field(friendly_name or frame_id, val)
    else:
        # For Vorbis comments (FLAC/Ogg) or other tag dicts
        # tags might be a mutagen Dict proxy (e.g. mutagen.flac.VCFLACDict)
        for key, value in tags.items():
            # value could be list (multiple values for same tag)
            friendly_name = vorbis_map.get(key.upper(), None)
            out_name = friendly_name or key  # use mapping if available, else original key
            # Combine track/disc number and totals if applicable
            if key.upper() in ("TRACKNUMBER", "TRACKTOTAL", "TOTALTRACKS"):
                # We'll handle track number after loop to combine with total
                continue
            if key.upper() in ("DISCNUMBER", "DISCTOTAL", "TOTALDISCS"):
                continue
            # Exclude pictures if present in tags (usually not; pictures are separate in FLAC)
            if key.upper() in ("METADATA_BLOCK_PICTURE", "COVERART", "COVERARTMIME"):
                continue
            # Prepare value: flatten lists, convert numeric strings
            val = value
            if isinstance(val, (list, tuple)):
                val = [v for v in val]  # make a plain list
                if len(val) == 1:
                    val = val[0]
            # Try converting numeric fields to int (Year, BPM, etc.)
            if key.upper() in ("YEAR", "DATE"):
                # Year/Date: leave as string (could be YYYY or YYYY-MM-DD)
                val = str(val)
            if key.upper() == "BPM":
                try:
                    val = int(val)
                except:
                    pass
            add_field(out_name, val)
        # After looping other tags, handle Track/Disc combining if they were present
        track_num = None
        track_total = None
        disc_num = None
        disc_total = None
        # Mutagen may store track/disc numbers as integers or strings in list
        if "TRACKNUMBER" in tags:
            track_num = str(tags.get("TRACKNUMBER")[0] if isinstance(tags["TRACKNUMBER"], list) else tags["TRACKNUMBER"])
        if "TRACKTOTAL" in tags:
            track_total = str(tags.get("TRACKTOTAL")[0] if isinstance(tags["TRACKTOTAL"], list) else tags["TRACKTOTAL"])
        elif "TOTALTRACKS" in tags:
            track_total = str(tags.get("TOTALTRACKS")[0] if isinstance(tags["TOTALTRACKS"], list) else tags["TOTALTRACKS"])
        if "DISCNUMBER" in tags:
            disc_num = str(tags.get("DISCNUMBER")[0] if isinstance(tags["DISCNUMBER"], list) else tags["DISCNUMBER"])
        if "DISCTOTAL" in tags:
            disc_total = str(tags.get("DISCTOTAL")[0] if isinstance(tags["DISCTOTAL"], list) else tags["DISCTOTAL"])
        elif "TOTALDISCS" in tags:
            disc_total = str(tags.get("TOTALDISCS")[0] if isinstance(tags["TOTALDISCS"], list) else tags["TOTALDISCS"])
        # Combine and add to metadata
        if track_num:
            track_field_value = track_num if not track_total else f"{track_num}/{track_total}"
            add_field("Track Number", track_field_value)
        if disc_num:
            disc_field_value = disc_num if not disc_total else f"{disc_num}/{disc_total}"
            add_field("Disc Number", disc_field_value)
    return metadata
