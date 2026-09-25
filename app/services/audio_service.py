"""
Audio Service
=============

This service provides audio file validation and processing functionality.
It handles audio format validation using FFmpeg, file type checking,
and audio stream analysis to ensure uploaded files are valid audio content.

Manages FFmpeg availability detection and provides fallback validation methods
when FFmpeg is not available in the system environment.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import os
import subprocess
import tempfile
import json
from functools import lru_cache
from typing import Optional


class AudioService:
    """
    Service for audio file validation and processing using FFmpeg.
    """

    @staticmethod
    @lru_cache(maxsize=1)
    def is_ffmpeg_installed() -> bool:
        """
        Check if FFmpeg is installed and available in the system path.

        Cached for the life of the process. This used to spawn ``ffmpeg -version`` on EVERY
        upload, synchronously, on Alwyzon's single event loop — a subprocess fork per request to
        answer a question whose answer cannot change while the process is running. Under the
        2026-08-13 mixed load that was one of four blocking calls per upload, and the pile-up
        showed up as a 1.56s median on an endpoint that only reads one key from Redis.

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
            # Use secure random filename - NEVER trust uploaded filename for security
            with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as temp_file:
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
            result = subprocess.run(cmd, capture_output=True, text=True)
            
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

    # ------------------------------------------------------------------ #
    # Upload inspection (what a user is actually allowed to send)
    # ------------------------------------------------------------------ #
    #
    # The container ffprobe reports -> the extension we hand downstream. Uploads arrive named
    # anything at all: WhatsApp sends Opus as `.mpeg`, iOS sends AAC as `.m4a`, and a browser may
    # send no extension at all. Naming the onward file from the CONTENT means no service further
    # down has to trust a name. `format_name` is a comma-separated family ("mov,mp4,m4a,3gp,3g2"),
    # so each token is looked up in turn.
    _EXT_BY_FORMAT = {
        "mp3": ".mp3",
        "wav": ".wav",
        "flac": ".flac",
        "aiff": ".aiff",
        "ogg": ".ogg",
        "mp4": ".m4a",
        "asf": ".wma",
        "matroska": ".mka",
        "aac": ".aac",
        "amr": ".amr",
        "caf": ".caf",
        "wv": ".wv",
        "ape": ".ape",
    }

    # Codecs that carry no encoder loss. They are converted (when converted at all) to another
    # lossless format, never to MP3.
    _LOSSLESS_CODECS = {
        "flac", "alac", "wavpack", "ape", "tta", "mlp", "truehd", "wmalossless",
    }

    @staticmethod
    def probe_upload(audio_bytes: bytes) -> Optional[dict]:
        """One ffprobe pass over an upload. ``None`` when ffprobe cannot read it at all.

        Returns the few facts every later step needs, so nothing has to guess from a filename:
        container, codec, bitrate, sample rate, channels, duration, whether the codec is lossless,
        whether there is real video in the file, and the extension the content deserves.
        """
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as temp_file:
                temp_path = temp_file.name
                temp_file.write(audio_bytes)

            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_format", "-show_streams",
                 "-print_format", "json", temp_path],
                capture_output=True, text=True, timeout=60,
            )
            if result.returncode != 0 or not result.stdout:
                return None
            probe = json.loads(result.stdout)
        except (FileNotFoundError, subprocess.SubprocessError, json.JSONDecodeError, OSError) as exc:
            print(f"[AudioService] probe failed: {exc}")
            return None
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass

        streams = probe.get("streams") or []
        audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
        if audio is None:
            return None

        # Embedded cover art is a video stream with `attached_pic` set. Treating it as video would
        # reject every tagged MP3 in the world.
        has_video = any(
            s.get("codec_type") == "video" and not (s.get("disposition") or {}).get("attached_pic")
            for s in streams
        )

        fmt = probe.get("format") or {}
        tokens = [t.strip().lower() for t in (fmt.get("format_name") or "").split(",") if t.strip()]
        container = tokens[0] if tokens else ""
        extension = next(
            (AudioService._EXT_BY_FORMAT[t] for t in tokens if t in AudioService._EXT_BY_FORMAT),
            "",
        )

        def _num(value, cast):
            try:
                return cast(value)
            except (TypeError, ValueError):
                return None

        codec = (audio.get("codec_name") or "").lower()
        return {
            "container": container,
            "codec": codec,
            "extension": extension,
            "bitrate_bps": _num(audio.get("bit_rate") or fmt.get("bit_rate"), int),
            "sample_rate": _num(audio.get("sample_rate"), int),
            "channels": _num(audio.get("channels"), int),
            "duration_s": _num(fmt.get("duration") or audio.get("duration"), float),
            "lossless": codec in AudioService._LOSSLESS_CODECS or codec.startswith("pcm_"),
            "has_video": has_video,
        }

    @staticmethod
    def inspect_upload(audio_bytes: bytes, max_duration_s: Optional[int] = None) -> tuple:
        """``(info, error)`` for an upload. Exactly one of the two is set.

        The gate is the file's CONTENT, not its extension or its declared type: anything with an
        audio stream is accepted, whatever it is named. Video files are refused, and so is audio
        longer than ``max_duration_s``.
        """
        info = AudioService.probe_upload(audio_bytes)
        if info is None:
            return None, (
                "We could not read any audio in this file. It may be corrupted, protected by DRM, "
                "or not an audio file."
            )
        if info["has_video"]:
            return None, "This is a video file. Please upload an audio file."
        if max_duration_s and info["duration_s"] and info["duration_s"] > max_duration_s:
            return None, f"Audio is longer than {max_duration_s // 60} minutes."
        return info, None

    # Future audio processing methods can be added below

    @staticmethod
    def get_audio_metadata(audio_bytes: bytes, filename: str) -> Optional[dict]:
        """
        Extract audio metadata using FFprobe.
        
        Args:
            audio_bytes: The raw bytes of the audio file.
            filename: Original filename.
            
        Returns:
            dict: Audio metadata if successful, None otherwise.
        """
        # TODO: Implement audio metadata extraction
        pass
    
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
                            print(f"[FFmpeg Duration] Extracted duration: {duration:.2f}s for {filename}")
                            return duration
                        else:
                            print(f"[FFmpeg Duration] Duration field not found in format for {filename}")
                            return None
                    else:
                        print(f"[FFmpeg Duration] Format information not found in ffprobe output for {filename}")
                        return None
                except (json.JSONDecodeError, ValueError) as e:
                    print(f"[FFmpeg Duration] Failed to parse ffprobe output for {filename}: {e}")
                    return None
            else:
                print(f"[FFmpeg Duration] FFprobe command failed for {filename}. Return code: {result.returncode}")
                if result.stderr:
                    print(f"[FFmpeg Duration] FFprobe stderr: {result.stderr.strip()}")
                return None
        
        except FileNotFoundError:
            print("[FFmpeg Duration] ERROR: ffprobe command not found. Please ensure FFmpeg is installed.")
            return None
        except subprocess.SubprocessError as e:
            print(f"[FFmpeg Duration] Subprocess error during ffprobe execution for {filename}: {e}")
            return None
        except Exception as e:
            print(f"[FFmpeg Duration] Exception during duration extraction for {filename}: {str(e)}")
            return None
        
        finally:
            # Clean up temporary file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception as e:
                    print(f"[FFmpeg Duration] Error cleaning up temp file {temp_path}: {str(e)}")
    
    @staticmethod
    def convert_audio_format(audio_bytes: bytes, source_format: str, target_format: str) -> Optional[bytes]:
        """
        Convert audio from one format to another using FFmpeg.
        
        Args:
            audio_bytes: The raw bytes of the source audio file.
            source_format: Source audio format.
            target_format: Target audio format.
            
        Returns:
            bytes: Converted audio bytes if successful, None otherwise.
        """
        # TODO: Implement audio format conversion
        pass
    
    @staticmethod
    def extract_audio_features(audio_bytes: bytes, filename: str) -> Optional[dict]:
        """
        Extract audio features for analysis and processing.
        
        Args:
            audio_bytes: The raw bytes of the audio file.
            filename: Original filename.
            
        Returns:
            dict: Audio features if successful, None otherwise.
        """
        # TODO: Implement audio feature extraction
        pass
