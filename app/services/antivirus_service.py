"""
Antivirus Service
=================

This service provides antivirus scanning functionality using ClamAV.
It handles malware detection for uploaded files using clamd daemon
with automatic fallback to clamscan subprocess if daemon is unavailable.

Manages streaming scans for efficiency and provides detailed scan results
with proper error handling and logging.

Version: 1.0.0
Init Date: October 18, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import io
import subprocess
import tempfile
import os
import threading
from typing import Dict, Any

from app.core.config import settings

# Cap on simultaneous clamd scans.
#
# Scans now run in a threadpool rather than one-at-a-time on the event loop, so nothing else
# bounds how many hit clamd at once. clamd's own `MaxThreads` defaults to 12 and its connection
# queue to 15; blowing past those turns into refused connections, which surface as failed scans
# and a 500 on the upload. 8 keeps a safety margin under the default while still letting scans
# run properly in parallel.
_MAX_CONCURRENT_SCANS = int(os.getenv("ANTIVIRUS_MAX_CONCURRENT_SCANS", "8"))
_scan_limiter = threading.BoundedSemaphore(_MAX_CONCURRENT_SCANS)


class AntivirusService:
    """
    Service for scanning uploaded files for malware using ClamAV.
    Prefers clamd streaming for speed, falls back to clamscan if needed.

    Thread safety
    -------------
    Scans are called from a threadpool (they are CPU/IO-bound and must not block the event loop),
    so several can be in flight at once. A clamd client instance is therefore NEVER shared: the
    `clamd` library keeps the live socket on the instance and closes it at the end of a command,
    so two threads sharing one client clobber each other's socket. A fresh client per scan is the
    fix — connecting to a Unix socket costs microseconds.
    """

    def __init__(self, socket_path: str = '/var/run/clamav/clamd.ctl'):
        """
        Initialize the antivirus service.

        Args:
            socket_path: Path to clamd Unix socket (default: /var/run/clamav/clamd.ctl)
        """
        self.socket_path = socket_path
        # Availability is a process-lifetime fact and safe to cache. The CLIENT is not — see the
        # class docstring.
        self._clamd_available = None
        
    def is_clamd_available(self) -> bool:
        """
        Check if clamd daemon is available and responsive.
        
        Returns:
            bool: True if clamd is available, False otherwise
        """
        if self._clamd_available is not None:
            return self._clamd_available
            
        try:
            import clamd
            cd = clamd.ClamdUnixSocket(path=self.socket_path)
            response = cd.ping()
            self._clamd_available = (response == 'PONG')
            if self._clamd_available:
                # Deliberately NOT retained — this probe's client must not be reused by scans.
                print(f"[AntiVirus] clamd daemon available at {self.socket_path}")
            return self._clamd_available
        except Exception as e:
            # Catch broadly: the clamd library raises its OWN clamd.ConnectionError
            # (NOT a subclass of the builtin ConnectionError), so a narrow except
            # would let it escape and 500 the upload. Any failure here just means
            # "clamd unavailable" → fall back to clamscan / graceful error.
            print(f"[AntiVirus] clamd not available: {e}")
            self._clamd_available = False
            return False
    
    def is_clamscan_available(self) -> bool:
        """
        Check if clamscan command-line tool is available.
        
        Returns:
            bool: True if clamscan is installed, False otherwise
        """
        try:
            result = subprocess.run(
                ['clamscan', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            available = result.returncode == 0
            if available:
                print("[AntiVirus] clamscan command-line tool available")
            return available
        except (FileNotFoundError, subprocess.SubprocessError, subprocess.TimeoutExpired):
            print("[AntiVirus] clamscan command-line tool not found")
            return False
    
    def scan_bytes(self, file_bytes: bytes, filename: str = "uploaded_file") -> Dict[str, Any]:
        """
        Scan file bytes for malware using ClamAV.
        
        This method attempts to use clamd streaming first for efficiency,
        then falls back to clamscan subprocess if daemon is unavailable.
        
        Args:
            file_bytes: The raw bytes of the file to scan
            filename: Original filename (used for logging and context)
            
        Returns:
            Dictionary containing scan results:
                - success (bool): True if scan completed successfully
                - clean (bool): True if no threats detected
                - threat (str): Name of detected threat (if any)
                - method (str): Scan method used ('clamd' or 'clamscan')
                - error (str): Error message if scan failed
        """
        # Skip antivirus check in development environment
        if os.getenv("RESOMIX_ENV") == "development":
            print(f"[AntiVirus] Skipping scan for '{filename}' because RESOMIX_ENV is 'development'")
            return {
                "success": True,
                "clean": True,
                "threat": None,
                "method": "skipped_dev",
                "filename": filename,
            }

        # Switched off for this environment (ANTIVIRUS_ENABLED=false), e.g. staging, which runs no
        # clamd. Default is on, so production is unaffected unless it opts out explicitly.
        if not settings.antivirus_enabled:
            return {
                "success": True,
                "clean": True,
                "threat": None,
                "method": "disabled",
                "filename": filename,
            }

        if not file_bytes:
            return {
                "success": False,
                "clean": False,
                "error": "Empty file provided for scanning"
            }
        
        # Try clamd streaming first (preferred method)
        if self.is_clamd_available():
            return self._scan_with_clamd(file_bytes, filename)
        
        # Fallback to clamscan subprocess
        if self.is_clamscan_available():
            return self._scan_with_clamscan(file_bytes, filename)
        
        # No scanning method available
        return {
            "success": False,
            "clean": False,
            "error": "No antivirus scanning method available (clamd or clamscan not found)"
        }
    
    def _scan_with_clamd(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Scan file bytes using clamd streaming (no disk writes).
        
        Args:
            file_bytes: The raw bytes of the file to scan
            filename: Original filename for context
            
        Returns:
            Dictionary with scan results
        """
        try:
            import clamd

            # A FRESH client per scan, never a shared one. The clamd library stores the live
            # socket on the instance and closes it when the command finishes, so a shared client
            # under concurrency has one thread closing the socket another is still writing to.
            # That surfaced on 2026-08-13 as 15 x 500 on the uploads the moment scans stopped
            # being serialised on the event loop — the bug was always there, the serialisation
            # was hiding it.
            cd = clamd.ClamdUnixSocket(path=self.socket_path)

            # Bounded so a burst of uploads cannot exhaust clamd's own thread/queue limits.
            with _scan_limiter:
                # Stream scan (efficient, no disk writes)
                result = cd.instream(io.BytesIO(file_bytes))

            # Parse result: {'stream': ('FOUND', 'ThreatName')} or {'stream': ('OK', None)}
            stream_result = result.get('stream', ('ERROR', 'Unknown'))
            status, threat_name = stream_result
            
            if status == 'FOUND':
                print(f"[AntiVirus] Threat detected in '{filename}': {threat_name}")
                return {
                    "success": True,
                    "clean": False,
                    "threat": threat_name,
                    "method": "clamd",
                    "filename": filename
                }
            elif status == 'OK':
                print(f"[AntiVirus] File '{filename}' is clean (clamd)")
                return {
                    "success": True,
                    "clean": True,
                    "threat": None,
                    "method": "clamd",
                    "filename": filename
                }
            else:
                # Unexpected status
                return {
                    "success": False,
                    "clean": False,
                    "error": f"Unexpected clamd status: {status}",
                    "method": "clamd"
                }
                
        except Exception as e:
            print(f"[AntiVirus] clamd scan error for '{filename}': {e}")
            return {
                "success": False,
                "clean": False,
                "error": f"clamd scan failed: {str(e)}",
                "method": "clamd"
            }
    
    def _scan_with_clamscan(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Scan file bytes using clamscan subprocess (writes to temp file).
        
        Args:
            file_bytes: The raw bytes of the file to scan
            filename: Original filename for context
            
        Returns:
            Dictionary with scan results
        """
        temp_path = None
        
        try:
            # Create temporary file for scanning
            # Use secure random filename - NEVER trust uploaded filename for security
            with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as temp_file:
                temp_path = temp_file.name
                temp_file.write(file_bytes)
            
            # Run clamscan
            cmd = ['clamscan', '--stdout', '--no-summary', temp_path]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30  # 30 second timeout
            )
            
            # Parse exit code:
            # 0 = no threats found
            # 1 = threats found
            # 2+ = error
            
            if result.returncode == 0:
                print(f"[AntiVirus] File '{filename}' is clean (clamscan)")
                return {
                    "success": True,
                    "clean": True,
                    "threat": None,
                    "method": "clamscan",
                    "filename": filename
                }
            elif result.returncode == 1:
                # Parse threat name from output
                # Format: "/path/to/file: ThreatName FOUND"
                threat_name = "Unknown"
                if result.stdout:
                    parts = result.stdout.strip().split(':')
                    if len(parts) >= 2:
                        threat_part = parts[1].strip()
                        if ' FOUND' in threat_part:
                            threat_name = threat_part.replace(' FOUND', '').strip()
                
                print(f"[AntiVirus] Threat detected in '{filename}': {threat_name}")
                return {
                    "success": True,
                    "clean": False,
                    "threat": threat_name,
                    "method": "clamscan",
                    "filename": filename
                }
            else:
                # Error occurred
                error_msg = result.stderr or result.stdout or "Unknown clamscan error"
                return {
                    "success": False,
                    "clean": False,
                    "error": f"clamscan error (exit {result.returncode}): {error_msg}",
                    "method": "clamscan"
                }
                
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "clean": False,
                "error": "clamscan timeout (file too large or scan too slow)",
                "method": "clamscan"
            }
        except Exception as e:
            print(f"[AntiVirus] clamscan error for '{filename}': {e}")
            return {
                "success": False,
                "clean": False,
                "error": f"clamscan failed: {str(e)}",
                "method": "clamscan"
            }
        finally:
            # Clean up temporary file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception as e:
                    print(f"[AntiVirus] Warning: Failed to delete temp file {temp_path}: {e}")

