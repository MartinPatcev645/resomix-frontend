"""Optional ClamAV virus scanning for user uploads.

Enabled only when ``settings.clamav_host`` is set AND the ``clamd`` library is installed. Otherwise
scanning is a graceful no-op (treats input as clean) so uploads still work without the infra. A
definite malware hit rejects the upload; a scanner error is fail-open (a broken scanner shouldn't
block a cover image) — the alwyzon type/size gate + the media server's Pillow validation still apply.
"""
from __future__ import annotations

import io
import logging
from typing import Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)


def _client():
    host = getattr(settings, "clamav_host", None)
    if not host:
        return None
    try:
        import clamd  # type: ignore
    except ImportError:
        logger.warning("ClamAV host configured but 'clamd' library not installed — skipping scan.")
        return None
    try:
        return clamd.ClamdNetworkSocket(host=host, port=int(getattr(settings, "clamav_port", 3310)))
    except Exception as e:  # pragma: no cover - connection setup
        logger.warning(f"ClamAV client init failed ({e}) — skipping scan.")
        return None


def scan_bytes(data: bytes) -> Tuple[bool, Optional[str]]:
    """Return ``(is_clean, threat_name)``. Clean when scanning is disabled/unavailable."""
    client = _client()
    if client is None:
        return True, None
    try:
        result = client.instream(io.BytesIO(data)) or {}
        status = result.get("stream", ("OK", None))
        if status and status[0] == "FOUND":
            logger.warning(f"ClamAV flagged upload: {status[1]}")
            return False, status[1]
        return True, None
    except Exception as e:  # pragma: no cover - scanner runtime
        logger.warning(f"ClamAV scan error ({e}) — allowing (fail-open).")
        return True, None
