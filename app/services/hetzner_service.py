import httpx
import logging
from typing import Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class HetznerService:
    """
    Service for interacting with the Hetzner Audio Processing Server.
    Handles secure internal API calls for compliance and track management.
    """

    def __init__(self):
        self.hetzner_url = getattr(settings, "similarity_server_url", None)
        self.internal_api_key = getattr(settings, "hetzner_internal_api_key", None)

    async def delete_track_on_hetzner(self, track_uuid: str) -> Dict[str, Any]:
        """
        Calls the Hetzner server to securely wipe a track's audio and embedding assets.

        Args:
            track_uuid: The UUID of the track to firmly delete.

        Returns:
            Dict containing success boolean and a message/data payload.
        """
        if not self.hetzner_url:
            logger.error("HETZNER_URL or SIMILARITY_SERVER_URL not configured.")
            return {"success": False, "error": "Server configuration missing"}

        if not self.internal_api_key:
            logger.error(
                "HETZNER_INTERNAL_API_KEY is not configured. Aborting delete request for security."
            )
            return {"success": False, "error": "Authentication configuration missing"}

        # Ensure base URL is clean
        base_url = self.hetzner_url.rstrip("/")
        endpoint = f"{base_url}/delete-track/{track_uuid}"

        headers = {
            "Authorization": f"Bearer {self.internal_api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.delete(endpoint, headers=headers)

                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Hetzner cleared assets successfully for {track_uuid}")
                    return {
                        "success": True,
                        "data": data,
                        "message": "Track natively deleted from Hetzner server",
                    }
                elif response.status_code in [404, 410]:
                    logger.info(
                        f"Track {track_uuid} already absent or deleted on Hetzner."
                    )
                    return {
                        "success": True,
                        "data": None,
                        "message": "Track already wiped or not found",
                    }
                else:
                    logger.error(
                        f"Failed to delete track {track_uuid} on Hetzner. Status: {response.status_code}"
                    )
                    return {
                        "success": False,
                        "error": f"Hetzner server returned {response.status_code}",
                    }

        except httpx.RequestError as e:
            logger.error(
                f"Hetzner connection error during delete of {track_uuid}: {str(e)}"
            )
            return {"success": False, "error": f"Connection error: {str(e)}"}
