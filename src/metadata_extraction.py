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
    """
    Converts any Mutagen value to something the JSON encoder can cope with.
    Only the interior logic is tweaked – the function signature is unchanged.
    """
    # 1. -- Explicit fast-path for ID3TimeStamp objects
    if isinstance(value, ID3TimeStamp):
        return str(value)                    # e.g. '2023', '2024-05-21T14:17:03'

    # 2. -- Lists / tuples first, recurse element-wise
    if isinstance(value, (list, tuple)):
        return [_to_serializable(v) for v in value]

    # 3. -- Objects that *wrap* data behind .text or .url – recurse!
    if hasattr(value, "text"):
        return _to_serializable(value.text)  # .text is usually list-like
    if hasattr(value, "url"):
        return _to_serializable(value.url)

    # 4. -- Raw bytes – keep your original logic
    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode("utf-8", errors="replace")
        except UnicodeDecodeError:
            return f"<binary data: {len(value)} bytes>"

    # 5. -- Anything that JSON can already handle
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value

    # 6. -- Fallback – last resort stringification
    return str(value)

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
    print(f"DEBUG: audio object type: {type(audio)}")

    if audio.tags is not None and not isinstance(audio.tags, type):
        print(f"DEBUG: audio.tags type: {type(audio.tags)}")
        try:
            for key, value in audio.tags.items():
                tags_dict[key.lower().replace(" ", "_")] = _to_serializable(value)
        except TypeError as te: # Catching the specific "missing 'self'" error which is a TypeError
            if "missing 1 required positional argument: 'self'" in str(te):
                print(f"Caught TypeError calling audio.tags.items(): {te}. audio.tags object: {audio.tags}")
                tags_dict["error_processing_tags"] = f"Could not iterate audio.tags: {te}"
            else:
                raise # Re-raise if it's a different TypeError
        except Exception as e:
            print(f"Generic error iterating audio.tags.items(): {e}")
            tags_dict["error_processing_tags"] = f"Generic error iterating audio.tags: {e}"

    # For some formats, audio.tags might not be populated, or specific tags are elsewhere
    # Example: MP3 (ID3)
    if isinstance(audio, MP3):
        print(f"DEBUG: File is MP3 instance.")
        if hasattr(audio, 'ID3') and isinstance(audio.ID3, ID3):
            print(f"DEBUG: audio.ID3 is an instance of ID3, type: {type(audio.ID3)}")
            try:
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
            except TypeError as te:
                if "missing 1 required positional argument: 'self'" in str(te):
                    # This should ideally not be hit now with the isinstance check, but kept for safety
                    print(f"Caught TypeError calling audio.ID3.items() DESPITE isinstance check: {te}. audio.ID3 object: {audio.ID3}")
                    tags_dict["error_processing_id3_tags"] = f"Could not iterate audio.ID3 tags (unexpected TypeError): {te}"
                else:
                    raise
            except Exception as e:
                print(f"Generic error iterating audio.ID3.items(): {e}")
                tags_dict["error_processing_id3_tags"] = f"Generic error iterating ID3 tags: {e}"
        else:
            print("DEBUG: MP3 file: audio.ID3 is not an instance of mutagen.id3.ID3 or does not exist.")

    # Example: MP4 (iTunes-style tags)
    elif isinstance(audio, MP4) and audio.tags is not None and not isinstance(audio.tags, type):
        print(f"DEBUG: MP4 audio.tags type: {type(audio.tags)}")
        try:
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
        except TypeError as te:
            if "missing 1 required positional argument: 'self'" in str(te):
                print(f"Caught TypeError calling MP4 audio.tags.items(): {te}. audio.tags object: {audio.tags}")
                tags_dict["error_processing_mp4_tags"] = f"Could not iterate MP4 audio.tags: {te}"
            else:
                raise
        except Exception as e:
            print(f"Generic error iterating MP4 audio.tags.items(): {e}")
            tags_dict["error_processing_mp4_tags"] = f"Generic error iterating MP4 tags: {e}"

    # Example: FLAC / Ogg (Vorbis Comments)
    elif isinstance(audio, (FLAC, OggVorbis, OggOpus)) and audio.tags is not None and not isinstance(audio.tags, type):
        print(f"DEBUG: FLAC/Ogg audio.tags type: {type(audio.tags)}")
        try:
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
        except TypeError as te:
            if "missing 1 required positional argument: 'self'" in str(te):
                print(f"Caught TypeError calling FLAC/Ogg audio.tags.items(): {te}. audio.tags object: {audio.tags}")
                tags_dict["error_processing_flac_ogg_tags"] = f"Could not iterate FLAC/Ogg audio.tags: {te}"
            else:
                raise
        except Exception as e:
            print(f"Generic error iterating FLAC/Ogg audio.tags.items(): {e}")
            tags_dict["error_processing_flac_ogg_tags"] = f"Generic error iterating FLAC/Ogg tags: {e}"

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
        # If there was an error processing tags, it would be in tags_dict already.
        # Only add the 'tags' key if it's not already just an error message placeholder
        if not any(k.startswith("error_processing") for k in tags_dict):
             metadata["tags"] = tags_dict
        else: # Transfer error messages to the main metadata dict if they occurred
            for key, value in tags_dict.items():
                if key.startswith("error_processing"):
                    metadata[key] = value # Promote error to main metadata
            if "tags" in metadata: del metadata["tags"] # Clean up if it was partially made

    # Attempt to get streaminfo for better format identification if not already clear
    if not metadata.get("codec") and hasattr(audio, 'mime') and audio.mime:
        metadata["mime_type"] = audio.mime[0] if isinstance(audio.mime, list) else audio.mime

    if not metadata and not metadata.get("error") and not any(k.startswith("error_processing") for k in metadata):
        metadata["info"] = "No specific metadata or tags found by Mutagen."
    elif any(k.startswith("error_processing") for k in metadata) and not metadata.get("error"):
        # If we had a tag processing error but not a load error, make sure 'error' is present
        if "error" not in metadata:
            metadata["error"] = "Partial success: File loaded, but error during tag processing. Check specific error fields."

    return metadata
