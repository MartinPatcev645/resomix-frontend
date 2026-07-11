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
from typing import Optional
from jose import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)


def generate_edge_token(
    playlist_id: str,
    client_ip: str,
    partner_id: Optional[int] = None,
    scope: Optional[str] = None,
    max_tracks: Optional[int] = None,
) -> str:
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
        partner_id: Optional partner ID to embed so Hetzner can resolve partner-scoped
            assets directly from the verified token claim (no DB round-trip).
        scope: Optional scope marker (e.g. "playback") describing what the token grants.

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

        # Partner-scoped storage refactor: embed the owning partner so the Hetzner
        # edge can resolve assets under {partner_data_root}/{partner_id}/internal/...
        if partner_id is not None:
            payload["partner_id"] = partner_id
        if scope is not None:
            payload["scope"] = scope
        # Freemium gate: cap how many tracks the HLS manifest may expose for this session
        # (set for anonymous frontend users so playback is limited to a preview). Signed, so
        # it can't be tampered with on the m3u8 request (where the user JWT isn't present).
        if max_tracks is not None:
            payload["max_tracks"] = int(max_tracks)

        # Encode and sign using HS256 and the shared secret
        token = jwt.encode(payload, settings.edge_jwt_secret, algorithm="HS256")

        return token
    except Exception as e:
        logger.error(f"Failed to generate edge token for playlist {playlist_id}: {e}")
        raise


def decode_edge_token(token: str) -> dict:
    """Decode an edge token and return its claims, or ``{}`` on any failure.

    Used to read non-security session hints (e.g. ``max_tracks``) on requests where the
    user JWT isn't available (the HLS player only sends the edge token). The signature is
    verified with the shared secret; expiry is NOT enforced here (the edge node enforces it).
    """
    if not token:
        return {}
    try:
        return jwt.decode(
            token,
            settings.edge_jwt_secret,
            algorithms=["HS256"],
            options={"verify_exp": False},
        )
    except Exception:
        return {}


def generate_playback_token(partner_id: int, client_ip: str) -> dict:
    """
    Mint a short-lived "valet" playback token for a partner.

    Unlike :func:`generate_edge_token`, this token is not bound to a single playlist.
    It carries ``partner_id`` + ``scope="playback"`` so the partner can fetch any of
    their own server-managed assets (previews, peaks, covers, HLS segments) from the
    Hetzner edge for the duration of the token, without Hetzner needing DB access or
    re-validating the partner's API key on every request.

    Args:
        partner_id: The authenticated partner's ID.
        client_ip: The requesting client's IP (token is locked to this network).

    Returns:
        ``{"token": <jwt>, "expires_in": <ttl_seconds>}``
    """
    ttl = settings.edge_token_ttl_seconds
    payload = {
        "scope": "playback",
        "partner_id": partner_id,
        "ip": client_ip,
        "exp": int(time.time()) + ttl,
    }
    token = jwt.encode(payload, settings.edge_jwt_secret, algorithm="HS256")
    return {"token": token, "expires_in": ttl}


def generate_analysis_token(analysis_id: str, client_ip: str) -> dict:
    """Mint a short-lived "boarding pass" to fetch a cached analysis JSON from the Hetzner
    served cache.

    Same model as :func:`generate_edge_token`: the token embeds the ``analysis`` id it is minted
    for plus ``scope="analysis"``, ip and exp. Authorization happens at MINT time (Alwyzon only
    signs when the requester owns the analysis or it is public); the Hetzner node then enforces
    that the ``{id}`` in the request path equals the ``analysis`` claim in the token — so a token
    minted for analysis X can't be replayed to fetch analysis Y.

    Args:
        analysis_id: The analysis UUID this token authorizes (and only this one).
        client_ip: The requesting client's IP (token is locked to this network).

    Returns:
        ``{"token": <jwt>, "expires_in": <ttl_seconds>}``
    """
    ttl = settings.edge_token_ttl_seconds
    payload = {
        "scope": "analysis",
        "analysis": analysis_id,
        "ip": client_ip,
        "exp": int(time.time()) + ttl,
    }
    token = jwt.encode(payload, settings.edge_jwt_secret, algorithm="HS256")
    return {"token": token, "expires_in": ttl}


def verify_analysis_token(token: str, analysis_id: str, client_ip: str) -> bool:
    """Verify an analysis retrieval token (mirrors :func:`verify_edge_token`).

    Checks the signature + expiry (via ``jwt.decode``), that ``scope == "analysis"``, that the
    embedded ``analysis`` id equals the requested ``analysis_id`` (the replay guard), and the IP
    lock. Returns True only if all hold. (Reference implementation of the check the Hetzner edge
    performs — also usable server-side/in tests.)
    """
    try:
        payload = jwt.decode(token, settings.edge_jwt_secret, algorithms=["HS256"])
        if payload.get("scope") != "analysis":
            logger.warning("Analysis token scope mismatch: %s", payload.get("scope"))
            return False
        if payload.get("analysis") != analysis_id:
            logger.warning(
                "Analysis token id mismatch: expected %s, got %s",
                analysis_id, payload.get("analysis"),
            )
            return False
        if payload.get("ip") != client_ip:
            logger.warning("Analysis token IP mismatch: expected %s, got %s", client_ip, payload.get("ip"))
            return False
        return True
    except Exception as e:
        logger.warning(f"Analysis token verification failed: {e}")
        return False


def verify_edge_token(token: str, playlist_id: str, client_ip: str) -> bool:
    """
    Verify a cryptographic Edge Authorization JWT.
    
    Args:
        token: The JWT string to verify
        playlist_id: The UUID of the playlist being requested
        client_ip: The IP address of the requesting client
        
    Returns:
        True if the token is valid, False otherwise
    """
    try:
        # Note: jwt.decode handles expiration (exp) automatically
        payload = jwt.decode(token, settings.edge_jwt_secret, algorithms=["HS256"])
        
        # Verify playlist ID matches
        if payload.get("playlist") != playlist_id:
            logger.warning(f"Edge token playlist mismatch: expected {playlist_id}, got {payload.get('playlist')}")
            return False
            
        # Verify IP matches (Optional: Some environments might have floating IPs, but for now we lock it)
        if payload.get("ip") != client_ip:
            logger.warning(f"Edge token IP mismatch: expected {client_ip}, got {payload.get('ip')}")
            return False
            
        return True
    except Exception as e:
        logger.warning(f"Edge token verification failed: {e}")
        return False
