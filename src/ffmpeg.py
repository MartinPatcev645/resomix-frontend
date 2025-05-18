"""
FFmpeg Audio Validation Module
=============================

This module provides functionality to validate audio files using FFmpeg (ffprobe).
It is primarily used to check if a file contains a valid audio stream.

Version: 0.2.0
Date: May 6, 2025
Author: Muhammad Usman Naeem (updated by AI Assistant)
Email: usman.naeem2212@gmail.com
"""

import os
import subprocess
import tempfile
import json # For parsing ffprobe output

def is_ffmpeg_installed():
    """
    Check if FFmpeg is installed and available in the system path.
    
    Returns:
        bool: True if FFmpeg is installed, False otherwise
    """
    try:
        # Try to run ffmpeg -version to check if it's installed
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, shell=True)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.SubprocessError):
        print("[FFmpeg Validation] ERROR: FFmpeg (ffprobe) not found on system path!")
        return False

def validate_audio_format(audio_bytes: bytes, filename: str) -> bool:
    """
    Validate if the provided bytes represent a valid audio file by checking for an audio stream using ffprobe.
    
    Args:
        audio_bytes: The raw bytes of the audio file.
        filename: Original filename (used for logging and potentially for hints if ffprobe needed it).
        
    Returns:
        bool: True if a valid audio stream is detected, False otherwise.
    """
    temp_path = None
    
    try:
        # Create a temporary file to pass to ffprobe
        # ffprobe can also take input from stdin, but writing to a temp file is straightforward
        # and aligns with how the function was structured.
        # Adding a suffix might help ffprobe in some edge cases, though often not strictly necessary.
        file_suffix = os.path.splitext(filename)[1] if filename else ".tmp"
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_suffix) as temp_file:
            temp_path = temp_file.name
            temp_file.write(audio_bytes)
            # print(f"[FFmpeg Validation] Created temp file for validation: {temp_path}") # Optional: verbose logging

        # Use FFprobe to analyze the file
        cmd = [
            'ffprobe',
            '-v', 'error',             # Suppress verbose output, only errors
            '-show_format',            # Get format information
            '-show_streams',           # Get stream information
            '-print_format', 'json',   # Output as JSON
            temp_path
        ]
        
        # print(f"[FFmpeg Validation] Running FFprobe command: {' '.join(cmd)}") # Optional: verbose logging
        
        # Execute FFprobe command
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        
        if result.returncode == 0 and result.stdout:
            try:
                ffprobe_output = json.loads(result.stdout)
                if "streams" in ffprobe_output and isinstance(ffprobe_output["streams"], list):
                    for stream in ffprobe_output["streams"]:
                        if isinstance(stream, dict) and stream.get("codec_type") == "audio":
                            print(f"[FFmpeg Validation] Valid audio stream found for {filename} using ffprobe.")
                            return True  # Audio stream found
                    print(f"[FFmpeg Validation] No audio stream found in {filename} according to ffprobe.")
                    return False  # No audio stream found
                else:
                    print(f"[FFmpeg Validation] 'streams' array not found or invalid in ffprobe output for {filename}.")
                    return False  # Streams array missing or not a list
            except json.JSONDecodeError as e:
                print(f"[FFmpeg Validation] Failed to parse ffprobe JSON output for {filename}: {e}")
                return False  # JSON parsing error
        else:
            # print(f"[FFmpeg Validation] FFprobe command failed or produced no output for {filename}. stderr: {result.stderr.strip()}") # Optional: verbose logging
            if "Permission denied" in result.stderr:
                 print(f"[FFmpeg Validation] FFprobe execution failed due to permission issues for {filename}.")
            elif not result.stdout:
                 print(f"[FFmpeg Validation] FFprobe produced no output for {filename}. It might not be a valid media file or is corrupted.")
            else:
                 print(f"[FFmpeg Validation] FFprobe command failed for {filename}. Return code: {result.returncode}. stderr: {result.stderr.strip()}")
            return False  # ffprobe command failed or no stdout
    
    except FileNotFoundError:
        print("[FFmpeg Validation] ERROR: ffprobe command not found. Please ensure FFmpeg (which includes ffprobe) is installed and in the system PATH.")
        return False # ffprobe not found
    except subprocess.SubprocessError as e:
        print(f"[FFmpeg Validation] Subprocess error during ffprobe execution for {filename}: {e}")
        return False
    except Exception as e:
        print(f"[FFmpeg Validation] Exception during ffprobe validation of {filename}: {str(e)}")
        return False
    
    finally:
        # Clean up temporary file
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
                # print(f"[FFmpeg Validation] Removed validation temp file: {temp_path}") # Optional: verbose logging
            except Exception as e:
                print(f"[FFmpeg Validation] Error cleaning up validation temp file {temp_path}: {str(e)}")
