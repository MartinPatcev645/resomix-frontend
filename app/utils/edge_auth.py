"""
Edge Authorization Utilities
============================

This module provides cryptographic utilities for generating Edge Authorization tokens
(JSON Web Tokens) to secure media playback on the Hetzner edge nodes.

Version: 3.5.0
Date: April 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import time
import logging
from jose import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)


def generate_edge_token(playlist_id: str, client_ip: str) -> str:
    """
    Generate a cryptographic Edge Authorization JWT for a playlist playback session.

    This token acts as a "boarding pass", allowing the client to fetch the server-stitched
    playlist (.m3u8) and all its underlying media segments (.ts) directly from the
    Hetzner edge node without hitting the backend database again.

    The Hetzner node (running OpenResty/Nginx) will mathematically verify the signature,
    IP address, and expiration.

    Args:
        playlist_id: The UUID of the playlist being requested
        client_ip: The IP address of the requesting client to lock the token to their network

    Returns:
        A signed JSON Web Token string
    """
    try:
        # Define the payload per Phase 3.5 spec
        payload = {
            "playlist": playlist_id,
            "ip": client_ip,
            "exp": int(time.time()) + settings.edge_token_ttl_seconds
        }

        # Encode and sign using HS256 and the shared secret
        token = jwt.encode(payload, settings.edge_jwt_secret, algorithm="HS256")
        
        return token
    except Exception as e:
        logger.error(f"Failed to generate edge token for playlist {playlist_id}: {e}")
        raise
