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

    async def delete_track_on_hetzner(self, track_uuid: str, partner_id: Optional[int] = None) -> Dict[str, Any]:
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
        if partner_id is not None:
            endpoint += f"?partner_id={partner_id}"

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

    async def add_vector(
        self, partner_id: int, track_uuid: str, filename: str, engine: str
    ) -> Dict[str, Any]:
        """Index a single track's pre-generated embedding into the partner FAISS index."""
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}

        base_url = self.hetzner_url.rstrip("/")
        headers = {
            "Authorization": f"Bearer {self.internal_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "partner_id": partner_id,
            "track_uuid": track_uuid,
            "filename": filename,
            "engine": engine,
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{base_url}/internal/ingest/add-vector", json=payload, headers=headers
                )
                if resp.status_code == 200:
                    return {"success": True, "data": resp.json()}
                return {
                    "success": False,
                    "error": f"Media server returned {resp.status_code}",
                    "detail": resp.text[:300],
                }
        except httpx.RequestError as e:
            logger.error(f"Hetzner add-vector connection error for {track_uuid}: {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    async def remove_vector(
        self,
        partner_id: int,
        track_uuid: str,
        engine: Optional[str] = None,
        delete_embedding_file: bool = False,
    ) -> Dict[str, Any]:
        """Remove a track's vector(s) from the partner FAISS index + catalog (idempotent)."""
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}

        base_url = self.hetzner_url.rstrip("/")
        headers = {
            "Authorization": f"Bearer {self.internal_api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "partner_id": partner_id,
            "track_uuid": track_uuid,
            "delete_embedding_file": delete_embedding_file,
        }
        if engine:
            payload["engine"] = engine
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{base_url}/internal/ingest/remove-vector", json=payload, headers=headers
                )
                if resp.status_code == 200:
                    return {"success": True, "data": resp.json()}
                return {
                    "success": False,
                    "error": f"Media server returned {resp.status_code}",
                    "detail": resp.text[:300],
                }
        except httpx.RequestError as e:
            logger.error(f"Hetzner remove-vector connection error for {track_uuid}: {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    async def batch_embeddings(
        self,
        partner_id: int,
        items: list,
        env: str = "live",
        index_after: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate (and optionally index) dual embeddings for a batch of tracks.

        Args:
            items: list of {"track_uuid": str, "filename": str}.
            env: "live" persists artifacts; "test" is a dry-run (generate + discard).
            index_after: when live, also insert each vector into FAISS + catalog.
        """
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}

        base_url = self.hetzner_url.rstrip("/")
        headers = {
            "Authorization": f"Bearer {self.internal_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "partner_id": partner_id,
            "env": env,
            "index_after": index_after,
            "items": items,
        }
        try:
            # Embedding generation can be slow for large batches.
            async with httpx.AsyncClient(timeout=600.0) as client:
                resp = await client.post(
                    f"{base_url}/internal/process/batch-embeddings", json=payload, headers=headers
                )
                if resp.status_code == 200:
                    return {"success": True, "data": resp.json()}
                return {
                    "success": False,
                    "error": f"Media server returned {resp.status_code}",
                    "detail": resp.text[:300],
                }
        except httpx.RequestError as e:
            logger.error(f"Hetzner batch-embeddings connection error (partner {partner_id}): {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    async def get_deletion_log(
        self,
        partner_id: int,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch ECDSA-signed deletion audit log entries for a partner from the media server."""
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}

        base_url = self.hetzner_url.rstrip("/")
        params = {}
        if from_date:
            params["from_date"] = from_date
        if to_date:
            params["to_date"] = to_date

        headers = {
            "Authorization": f"Bearer {self.internal_api_key}",
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{base_url}/internal/audit-log/{partner_id}",
                    params=params,
                    headers=headers,
                )
                if response.status_code == 200:
                    return {"success": True, "data": response.json()}
                else:
                    logger.error(f"Audit log fetch failed: {response.status_code} {response.text[:200]}")
                    return {"success": False, "error": f"Media server returned {response.status_code}"}
        except httpx.RequestError as e:
            logger.error(f"Connection error fetching audit log for partner {partner_id}: {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}
