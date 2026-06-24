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

    async def remove_vectors_batch(
        self, partner_id: int, track_uuids: list, engine: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Take down MANY tracks in one call — the media server rebuilds the index ONCE
        (vs once per track). Idempotent."""
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}
        base_url = self.hetzner_url.rstrip("/")
        headers = {"Authorization": f"Bearer {self.internal_api_key}", "Content-Type": "application/json"}
        payload: Dict[str, Any] = {"partner_id": partner_id, "track_uuids": list(track_uuids)}
        if engine:
            payload["engine"] = engine
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:  # one rebuild can take a while
                resp = await client.post(
                    f"{base_url}/internal/ingest/remove-vectors-batch", json=payload, headers=headers
                )
                if resp.status_code == 200:
                    return {"success": True, "data": resp.json()}
                return {"success": False, "error": f"Media server returned {resp.status_code}",
                        "detail": resp.text[:300]}
        except httpx.RequestError as e:
            logger.error(f"Hetzner remove-vectors-batch connection error (partner {partner_id}): {e}")
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

    async def rebuild_index(
        self, partner_id: int
    ) -> Dict[str, Any]:
        """
        Trigger a full FAISS index rebuild on the Hetzner media server for a specific partner.

        Calls Hetzner once per engine (maest + discogs) because the endpoint requires
        both ``partner_id`` and ``engine`` as mandatory fields.

        Args:
            partner_id: The partner whose FAISS indexes should be rebuilt.

        Returns:
            Dict with overall ``success`` boolean and per-engine results under
            ``engines.maest`` and ``engines.discogs``.
        """
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}

        base_url = self.hetzner_url.rstrip("/")
        endpoint = f"{base_url}/internal/ingest/rebuild-index"
        headers = {
            "Authorization": f"Bearer {self.internal_api_key}",
            "Content-Type": "application/json",
        }

        engines = ["maest", "discogs"]
        results: Dict[str, Any] = {}
        all_ok = True

        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                for engine in engines:
                    payload = {"partner_id": partner_id, "engine": engine}
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code in (200, 202):
                        results[engine] = {"success": True, "data": resp.json()}
                    else:
                        all_ok = False
                        results[engine] = {
                            "success": False,
                            "error": f"Media server returned {resp.status_code}",
                            "detail": resp.text[:300],
                        }
                        logger.error(
                            f"Hetzner rebuild-index failed for partner {partner_id} engine={engine}: "
                            f"{resp.status_code} {resp.text[:200]}"
                        )
        except httpx.RequestError as e:
            logger.error(f"Hetzner rebuild-index connection error: {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

        return {
            "success": all_ok,
            "partner_id": partner_id,
            "engines": results,
        }

    async def start_ingestion(
        self, job_id: int, partner_id: int, home_dir: str, env: str = "live"
    ) -> Dict[str, Any]:
        """
        Fire-and-forget hand-off of an ingestion job to the Hetzner media server.

        Hetzner validates the partner's uploaded manifest + audio under
        ``home_dir/{env}`` in a background task and writes a result JSON keyed by
        ``job_id``. This call returns as soon as Hetzner has accepted the job
        (HTTP 202); the actual validation runs asynchronously there.

        Args:
            job_id: Alwyzon ``ingest_logs.id`` — the cross-server job key.
            partner_id: ID of the partner being ingested.
            home_dir: Container SFTP home, e.g. ``/srv/sftp/partners/<slug>``.
            env: SFTP env — ``"test"`` (dry-run) or ``"live"``.
        """
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}

        base_url = self.hetzner_url.rstrip("/")
        headers = {
            "Authorization": f"Bearer {self.internal_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "job_id": job_id,
            "partner_id": partner_id,
            "home_dir": home_dir,
            "env": env,
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{base_url}/internal/ingestion/run", json=payload, headers=headers
                )
                if resp.status_code in (200, 202):
                    return {"success": True, "data": resp.json()}
                return {
                    "success": False,
                    "error": f"Media server returned {resp.status_code}",
                    "detail": resp.text[:300],
                }
        except httpx.RequestError as e:
            logger.error(f"Hetzner start-ingestion connection error (job {job_id}): {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    async def reject_done(
        self, partner_id: int, home_dir: str, env: str = "live"
    ) -> Dict[str, Any]:
        """Ask the media server to delete ONLY the ``.done`` marker for a partner.

        Used by the per-partner concurrency guard: when a partner uploads a ``.done``
        while a batch is already active, we remove just that marker (the other files
        in ``live/`` are untouched) so it doesn't trigger a second ingestion.
        """
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}

        base_url = self.hetzner_url.rstrip("/")
        headers = {
            "Authorization": f"Bearer {self.internal_api_key}",
            "Content-Type": "application/json",
        }
        payload = {"partner_id": partner_id, "home_dir": home_dir, "env": env}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{base_url}/internal/ingestion/reject-done", json=payload, headers=headers
                )
                if resp.status_code in (200, 202):
                    return {"success": True, "data": resp.json()}
                return {"success": False, "error": f"Media server returned {resp.status_code}", "detail": resp.text[:300]}
        except httpx.RequestError as e:
            logger.error(f"Hetzner reject-done connection error (partner {partner_id}): {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    async def get_ingestion_status(
        self, partner_id: int, job_id: int,
        include_records: bool = True, timeout: float = 30.0,
    ) -> Dict[str, Any]:
        """
        Poll the Hetzner media server for the current state of an ingestion job.

        Hetzner reads back the result JSON it wrote for ``job_id`` and returns a
        snapshot (status running|completed|failed, counts, errors, and — when
        completed — the validated ``records`` Alwyzon persists).

        Args:
            partner_id: ID of the partner being ingested.
            job_id: Alwyzon ``ingest_logs.id`` — the cross-server job key.
            include_records: progress polls pass False to skip the (100s-of-MB) records
                array — re-downloading + JSON-parsing it on every poll would block the
                event loop. Only the persist task needs the records (passes True).
            timeout: HTTP timeout; bump it when fetching records for a huge batch.
        """
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}

        base_url = self.hetzner_url.rstrip("/")
        headers = {"Authorization": f"Bearer {self.internal_api_key}"}
        params = {"include_records": "true" if include_records else "false"}
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(
                    f"{base_url}/internal/ingestion/status/{partner_id}/{job_id}",
                    headers=headers, params=params,
                )
                if resp.status_code == 200:
                    return {"success": True, "data": resp.json()}
                if resp.status_code == 404:
                    return {
                        "success": False,
                        "error": "not_found",
                        "detail": "No ingestion job result found on media server",
                    }
                return {
                    "success": False,
                    "error": f"Media server returned {resp.status_code}",
                    "detail": resp.text[:300],
                }
        except httpx.RequestError as e:
            logger.error(f"Hetzner ingestion-status connection error (job {job_id}): {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    async def start_embeddings(
        self,
        job_id: int,
        partner_id: int,
        items: list,
        env: str = "live",
        index_after: bool = True,
        processing_dir: Optional[str] = None,
        transcode_job_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Fire-and-forget hand-off of a batch-embeddings job to the Hetzner media server.

        Hetzner generates (and optionally indexes) embeddings for ``items`` in a
        background task and writes incremental progress to a result JSON keyed by
        ``job_id``. This call returns as soon as Hetzner has accepted the job
        (HTTP 202); the actual embedding work runs asynchronously there. Poll
        ``get_embeddings_status`` for progress + per-track results.

        This is the scalable replacement for ``batch_embeddings`` (which blocked a
        single 600 s HTTP call for the whole batch — fatal for 10k-track jobs).

        Args:
            job_id: Alwyzon ``partner_processing_jobs.id`` — the cross-server job key.
            partner_id: ID of the partner being processed.
            items: list of {"track_uuid": str, "filename": str}.
            env: "live" persists artifacts; "test" is a dry-run (generate + discard).
            index_after: when live, also insert each vector into FAISS + catalog.
            processing_dir: the snapshot dir for embedding ingestion.
            transcode_job_id: when set, the media server runs the embeddings in OVERLAP
                mode — embedding each track as soon as that transcode job writes its mp3,
                so the GPU isn't idle while transcode runs. None = single-pass (resume /
                post-transcode safety net).
        """
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}

        base_url = self.hetzner_url.rstrip("/")
        headers = {
            "Authorization": f"Bearer {self.internal_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "job_id": job_id,
            "partner_id": partner_id,
            "env": env,
            "index_after": index_after,
            "items": items,
        }
        if processing_dir:
            payload["processing_dir"] = processing_dir
        # Overlap mode: tell the media server to embed each track as soon as this
        # transcode job has produced its mp3 (instead of waiting for transcode to finish).
        if transcode_job_id is not None:
            payload["transcode_job_id"] = transcode_job_id

        try:
            # Only the hand-off — the heavy work runs in Hetzner's background task.
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{base_url}/internal/process/embeddings/run", json=payload, headers=headers
                )
                if resp.status_code in (200, 202):
                    return {"success": True, "data": resp.json()}
                return {
                    "success": False,
                    "error": f"Media server returned {resp.status_code}",
                    "detail": resp.text[:300],
                }
        except httpx.RequestError as e:
            logger.error(f"Hetzner start-embeddings connection error (job {job_id}): {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    async def pause_embeddings(self, partner_id: int, job_id: int) -> Dict[str, Any]:
        """
        Signal the media server to pause a running embeddings job.

        Hetzner's loop stops after the current track and writes a 'paused' snapshot.
        Idempotent and safe even if the job already finished or isn't running.
        """
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}

        base_url = self.hetzner_url.rstrip("/")
        headers = {"Authorization": f"Bearer {self.internal_api_key}"}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{base_url}/internal/process/embeddings/pause/{partner_id}/{job_id}",
                    headers=headers,
                )
                if resp.status_code in (200, 202):
                    return {"success": True, "data": resp.json()}
                return {
                    "success": False,
                    "error": f"Media server returned {resp.status_code}",
                    "detail": resp.text[:300],
                }
        except httpx.RequestError as e:
            logger.error(f"Hetzner pause-embeddings connection error (job {job_id}): {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    # ------------------------------------------------------------------ transcode
    async def start_transcode(
        self,
        job_id: int,
        partner_id: int,
        items: list,
        processing_dir: str,
        env: str = "live",
    ) -> Dict[str, Any]:
        """Fire-and-forget hand-off of a transcode job (raw upload -> 128k mp3) to Hetzner.

        ``items`` is a list of {"track_uuid": str, "filename": str}; the sources live under
        ``processing/<processing_dir>/``. Returns on HTTP 202; poll ``get_transcode_status``.
        """
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}
        base_url = self.hetzner_url.rstrip("/")
        headers = {"Authorization": f"Bearer {self.internal_api_key}", "Content-Type": "application/json"}
        payload = {
            "job_id": job_id, "partner_id": partner_id, "env": env,
            "processing_dir": processing_dir, "items": items,
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{base_url}/internal/process/transcode/run", json=payload, headers=headers
                )
                if resp.status_code in (200, 202):
                    return {"success": True, "data": resp.json()}
                return {"success": False, "error": f"Media server returned {resp.status_code}",
                        "detail": resp.text[:300]}
        except httpx.RequestError as e:
            logger.error(f"Hetzner start-transcode connection error (job {job_id}): {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    async def pause_transcode(self, partner_id: int, job_id: int) -> Dict[str, Any]:
        """Signal the media server to pause a running transcode job (idempotent)."""
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}
        base_url = self.hetzner_url.rstrip("/")
        headers = {"Authorization": f"Bearer {self.internal_api_key}"}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{base_url}/internal/process/transcode/pause/{partner_id}/{job_id}", headers=headers
                )
                if resp.status_code in (200, 202):
                    return {"success": True, "data": resp.json()}
                return {"success": False, "error": f"Media server returned {resp.status_code}",
                        "detail": resp.text[:300]}
        except httpx.RequestError as e:
            logger.error(f"Hetzner pause-transcode connection error (job {job_id}): {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    async def get_transcode_status(
        self, partner_id: int, job_id: int,
        include_records: bool = True, timeout: float = 30.0,
    ) -> Dict[str, Any]:
        """Poll the media server for the current state of a transcode job.

        ``include_records=False`` omits the per-track results array (which grows with the
        batch) — progress polls use it; the terminal apply re-fetches with it True.
        """
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}
        base_url = self.hetzner_url.rstrip("/")
        headers = {"Authorization": f"Bearer {self.internal_api_key}"}
        params = {"include_records": "true" if include_records else "false"}
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(
                    f"{base_url}/internal/process/transcode/status/{partner_id}/{job_id}",
                    headers=headers, params=params,
                )
                if resp.status_code == 200:
                    return {"success": True, "data": resp.json()}
                if resp.status_code == 404:
                    return {"success": False, "error": "not_found",
                            "detail": "No transcode job result found on media server"}
                return {"success": False, "error": f"Media server returned {resp.status_code}",
                        "detail": resp.text[:300]}
        except httpx.RequestError as e:
            logger.error(f"Hetzner transcode-status connection error (job {job_id}): {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}

    async def get_embeddings_status(
        self, partner_id: int, job_id: int,
        include_records: bool = True, timeout: float = 30.0,
    ) -> Dict[str, Any]:
        """
        Poll the Hetzner media server for the current state of an embeddings job.

        Hetzner reads back the result JSON it wrote for ``job_id`` and returns a
        snapshot (status running|completed|failed, counts, and per-track results
        Alwyzon uses to update ``track_processing_status``).

        Args:
            partner_id: ID of the partner being processed.
            job_id: Alwyzon ``partner_processing_jobs.id`` — the cross-server job key.
            include_records: progress polls pass False to skip the per-track results array
                (large for a big batch); only the background finalize fetches it (True).
            timeout: HTTP timeout; bump it when fetching results for a huge batch.
        """
        if not self.hetzner_url or not self.internal_api_key:
            return {"success": False, "error": "Media server not configured"}

        base_url = self.hetzner_url.rstrip("/")
        headers = {"Authorization": f"Bearer {self.internal_api_key}"}
        params = {"include_records": "true" if include_records else "false"}
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(
                    f"{base_url}/internal/process/embeddings/status/{partner_id}/{job_id}",
                    headers=headers, params=params,
                )
                if resp.status_code == 200:
                    return {"success": True, "data": resp.json()}
                if resp.status_code == 404:
                    return {
                        "success": False,
                        "error": "not_found",
                        "detail": "No embeddings job result found on media server",
                    }
                return {
                    "success": False,
                    "error": f"Media server returned {resp.status_code}",
                    "detail": resp.text[:300],
                }
        except httpx.RequestError as e:
            logger.error(f"Hetzner embeddings-status connection error (job {job_id}): {e}")
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
