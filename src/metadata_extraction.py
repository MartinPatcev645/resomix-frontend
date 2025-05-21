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

from mutagen import File as MutagenFile, MutagenError
from mutagen.id3 import ID3,Frames, PictureType
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4, MP4Cover
from mutagen.flac import FLAC, Picture
from mutagen.oggvorbis import OggVorbis
from mutagen.oggopus import OggOpus
from mutagen.wave import WAVE
from mutagen.aiff import AIFF

from typing import Dict, Any, IO, List, Union
import base64

def _to_serializable(value):
    """Converts Mutagen values to JSON serializable types."""
    if isinstance(value, list):
        # If it's a list of Mutagen-specific objects, try to get text or just convert to string
        return [_to_serializable(item) for item in value]
    if hasattr(value, 'text'):
        return value.text
    if isinstance(value, bytes):
        # For binary data like embedded images, we might want to represent it differently
        # For now, let's return a placeholder or base64 encode if it's small
        # Or simply indicate its presence and type.
        # For simplicity here, just a string representation of bytes if not directly text.
        try:
            return value.decode('utf-8', errors='replace')
        except UnicodeDecodeError:
            return f"<binary data: {len(value)} bytes>"
    if isinstance(value, (int, float, str, bool)) or value is None:
        return value
    return str(value) # Fallback for other types

def extract_metadata_from_file_object(file_obj: IO[bytes]) -> Dict[str, Any]:
    """
    Reads metadata from a file-like object using Mutagen and returns it as a dictionary.
    Handles various audio formats and their specific tag structures.

    Args:
        file_obj: A file-like object (e.g., from UploadFile.file).

    Returns:
        A dictionary containing extracted metadata.
    """
    metadata: Dict[str, Any] = {}
    file_obj.seek(0) # Ensure we are at the beginning of the file stream

    try:
        audio = MutagenFile(file_obj, easy=False) # easy=False gives more control
    except MutagenError as e:
        print(f"MutagenError during initial load: {e}")
        metadata["error"] = f"Could not process file with Mutagen: {e}"
        return metadata
    except Exception as e:
        # Catch other potential errors during file loading if file_obj is weird
        print(f"Generic error during MutagenFile load: {e}")
        metadata["error"] = f"Unexpected error loading file into Mutagen: {e}"
        return metadata

    if audio is None:
        metadata["error"] = "Unsupported audio format or Mutagen failed to parse the file."
        return metadata

    # 1. Extract general audio information (format-agnostic where possible)
    if hasattr(audio, 'info'):
        info = audio.info
        metadata["duration_seconds"] = getattr(info, "length", None)
        metadata["bitrate"] = getattr(info, "bitrate", None)
        metadata["sample_rate"] = getattr(info, "sample_rate", None)
        metadata["channels"] = getattr(info, "channels", None)
        metadata["encoder_info"] = getattr(info, "encoder", None) # e.g., for OggVorbis
        if hasattr(info, "codec") and hasattr(info, "codec_description"):
             metadata["codec"] = f"{getattr(info, 'codec', '')} ({getattr(info, 'codec_description', '')})"
        elif hasattr(info, "codec"):
            metadata["codec"] = getattr(info, "codec", None)
        if hasattr(info, "bits_per_sample"):
             metadata["bits_per_sample"] = getattr(info, "bits_per_sample", None)

    # 2. Extract tags (format-specific then general)
    tags_dict: Dict[str, Any] = {}
    if audio.tags:
        for key, value in audio.tags.items():
            tags_dict[key.lower().replace(" ", "_")] = _to_serializable(value)
    
    # For some formats, audio.tags might not be populated, or specific tags are elsewhere
    # Example: MP3 (ID3)
    if isinstance(audio, MP3) and hasattr(audio, "ID3") and audio.ID3:
        for key, frame in audio.ID3.items():
            # key is usually like 'TPE1', 'TALB', etc.
            # We want a more human-readable key if possible, and handle complex frames
            frame_key = frame.__class__.__name__.lower() # e.g., 'tpe1'
            if hasattr(frame, 'text'):
                tags_dict[frame_key] = _to_serializable(frame.text)
            elif hasattr(frame, 'url'): # For URL frames like WXXX
                tags_dict[frame_key] = _to_serializable(frame.url)
            elif isinstance(frame, list) and frame: # Some frames are lists of values
                 tags_dict[frame_key] = [_to_serializable(f) for f in frame]
            # Add more specific frame handling if needed (e.g., APIC for images)
            elif key.startswith("APIC:"): # Embedded Picture
                if not tags_dict.get("embedded_pictures"): tags_dict["embedded_pictures"] = []
                tags_dict["embedded_pictures"].append({
                    "description": frame.desc,
                    "mime_type": frame.mime,
                    "type": PictureType(frame.type).name if hasattr(PictureType, "name") else frame.type,
                    "data_length": len(frame.data)
                })
            elif key.startswith("COMM") or key.startswith("USLT"): # Comments or unsynced lyrics
                if not tags_dict.get(frame_key): tags_dict[frame_key] = []
                tags_dict[frame_key].append({
                    "language": getattr(frame, 'lang', 'XXX'),
                    "description": getattr(frame, 'desc', ''),
                    "text": _to_serializable(getattr(frame, 'text', ''))
                })
            # Fallback for other frame types
            elif not tags_dict.get(frame_key):
                 try: tags_dict[frame_key] = str(frame) # Generic representation
                 except: tags_dict[frame_key] = "<complex frame data>"

    # Example: MP4 (iTunes-style tags)
    elif isinstance(audio, MP4) and audio.tags:
        for key, value in audio.tags.items():
            # MP4 keys are often like '©nam' (track title), '©ART' (artist)
            clean_key = key.lstrip('©').lstrip('-').lstrip('gnre') if isinstance(key, str) else str(key)
            clean_key = clean_key.lower().replace(" ", "_")
            tags_dict[clean_key] = _to_serializable(value)
            if key == "covr" and isinstance(value, list):
                if not tags_dict.get("embedded_pictures"): tags_dict["embedded_pictures"] = []
                for i, cover_data in enumerate(value):
                    if isinstance(cover_data, MP4Cover):
                        tags_dict["embedded_pictures"].append({
                            "description": f"cover_{i}",
                            "mime_type": "image/jpeg" if cover_data.imageformat == MP4Cover.FORMAT_JPEG else "image/png",
                            "type": "COVER_FRONT", # MP4 doesn't have types like ID3 pictures
                            "data_length": len(cover_data)
                        })

    # Example: FLAC / Ogg (Vorbis Comments)
    elif isinstance(audio, (FLAC, OggVorbis, OggOpus)) and audio.tags:
        for key, value_list in audio.tags.items(): # Vorbis comments are key-value lists
            key = key.lower().replace(" ", "_")
            # value_list is always a list of strings for Vorbis comments
            tags_dict[key] = value_list if len(value_list) > 1 else value_list[0] if value_list else None
        if isinstance(audio, FLAC) and hasattr(audio, 'pictures') and audio.pictures:
            if not tags_dict.get("embedded_pictures"): tags_dict["embedded_pictures"] = []
            for pic in audio.pictures:
                tags_dict["embedded_pictures"].append({
                    "description": pic.desc,
                    "mime_type": pic.mime,
                    "type": PictureType(pic.type).name if hasattr(PictureType, "name") else pic.type,
                    "width": pic.width,
                    "height": pic.height,
                    "depth": pic.depth,
                    "data_length": len(pic.data)
                })

    # WAVE and AIFF often have less standardized tagging or rely on chunks
    elif isinstance(audio, WAVE):
        # WAVE can have ID3 tags in an 'ID3 ' chunk or other chunk types
        # Mutagen often puts these into audio.tags if found
        tags_dict["audio_format"] = "WAVE"
        if hasattr(audio, "metadata_specs") and audio.metadata_specs:
             tags_dict["wave_metadata_specs"] = str(audio.metadata_specs)

    elif isinstance(audio, AIFF):
        tags_dict["audio_format"] = "AIFF"
        if hasattr(audio, "filename") and audio.filename:
             tags_dict["aiff_filename_in_tag"] = audio.filename # AIFF can store filename internally

    if tags_dict: # Only add the 'tags' key if we found any
        metadata["tags"] = tags_dict

    # Attempt to get streaminfo for better format identification if not already clear
    if not metadata.get("codec") and hasattr(audio, 'mime') and audio.mime:
        metadata["mime_type"] = audio.mime[0] if isinstance(audio.mime, list) else audio.mime

    if not metadata and not metadata.get("error"):
        metadata["info"] = "No specific metadata or tags found by Mutagen."

    return metadata
