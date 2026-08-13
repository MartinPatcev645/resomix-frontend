"""
Similarity Upload Job Service
=============================

Job records for the poll-based similarity upload (``POST /similarity/upload/async``).

Why this exists
---------------
The blocking upload endpoint holds the HTTP request open for the whole pipeline: receive the
file, embed it on the GPU, search the index, build the playlist. Capacity testing on
2026-08-13 found the platform's only failure mode there — 20 concurrent 40 MB uploads
*finished* on the server at 93 s, but **Cloudflare closes any origin request at 100 s**, so
15 of the 20 completed results were discarded with a 524. The work was done; the answer had
nowhere to go.

No amount of backend speed fixes that. A request that is never held open cannot time out at
the edge, at any file size or concurrency — so the upload is accepted, a job id comes back
immediately, and the client polls. This is the same contract ``/analysis/upload`` already
uses, deliberately, so the frontend has one pattern for both.

Storage
-------
A Redis hash per job with a TTL, rather than a database table, because the record is
short-lived plumbing and losing one is survivable: the *durable* product of a similarity
upload is the playlist row, which the worker writes regardless of whether anyone is still
polling. A job record is how the client finds that result quickly, not where the result
lives.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Dict, Optional

from app.core.config import settings
from app.db.redis import get_redis_or_none

logger = logging.getLogger(__name__)

# Job lifecycle. `failed` is terminal and carries a client-safe message; the worker never
# leaves a job in `running` on an exception (see similarity_tasks).
STATE_QUEUED = "queued"
STATE_RUNNING = "running"
STATE_DONE = "done"
STATE_FAILED = "failed"

TERMINAL_STATES = (STATE_DONE, STATE_FAILED)

_KEY_PREFIX = "simupload:job:"


class SimilarityUploadJobService:
    """Create, advance and read one poll-based similarity upload job.

    Every method degrades to ``None``/``False`` rather than raising: a Redis blip must not
    turn into a 500 on a path the caller can report honestly instead.
    """

    # ------------------------------------------------------------------ #
    # keys / ids
    # ------------------------------------------------------------------ #
    @staticmethod
    def _key(job_id: str) -> str:
        return f"{_KEY_PREFIX}{job_id}"

    @staticmethod
    def new_job_id() -> str:
        """Unguessable id — it is also the capability that lets an anonymous caller poll."""
        return uuid.uuid4().hex

    @property
    def ttl(self) -> int:
        return int(getattr(settings, "similarity_job_ttl_seconds", 3600))

    # ------------------------------------------------------------------ #
    # writes
    # ------------------------------------------------------------------ #
    async def create(
        self,
        *,
        job_id: str,
        user_id: Optional[int],
        partner_id: Optional[int],
        track_id: Optional[int],
        track_uuid: str,
        visible_count: Optional[int] = None,
    ) -> bool:
        """Record an accepted upload as ``queued``. Returns False if Redis is unreachable.

        The caller MUST treat False as "do not accept this upload" — a job we cannot track is
        a job the client can never collect, which is worse than a synchronous failure.
        """
        client = await get_redis_or_none()
        if client is None:
            logger.error("SIMILARITY UPLOAD JOB: Redis unavailable — cannot create job %s", job_id)
            return False
        try:
            await client.hset(
                self._key(job_id),
                mapping={
                    "state": STATE_QUEUED,
                    "user_id": "" if user_id is None else int(user_id),
                    "partner_id": "" if partner_id is None else int(partner_id),
                    "track_id": "" if track_id is None else int(track_id),
                    "track_uuid": track_uuid or "",
                    # Resolved at submit time while the DB session and the caller's plan are in
                    # hand, so the worker never has to re-derive entitlements out of request scope.
                    "visible_count": "" if visible_count is None else int(visible_count),
                    "created_at": time.time(),
                },
            )
            await client.expire(self._key(job_id), self.ttl)
            return True
        except Exception as exc:  # pragma: no cover — defensive
            logger.error("SIMILARITY UPLOAD JOB: could not create %s: %s", job_id, exc)
            return False
        finally:
            await client.close()

    async def mark_running(self, job_id: str) -> None:
        await self._update(job_id, {"state": STATE_RUNNING, "started_at": time.time()})

    async def mark_done(self, job_id: str, result: Dict[str, Any]) -> None:
        """Store the finished payload and restart the TTL clock.

        The TTL is refreshed here on purpose: the window that matters is how long the client
        has to *collect* the result, not how long the job sat in the queue beforehand.
        """
        await self._update(
            job_id,
            {"state": STATE_DONE, "finished_at": time.time(), "result": json.dumps(result)},
            refresh_ttl=True,
        )

    async def mark_failed(self, job_id: str, error: str, reason: str = "processing_failed") -> None:
        await self._update(
            job_id,
            {"state": STATE_FAILED, "finished_at": time.time(), "error": error, "reason": reason},
            refresh_ttl=True,
        )

    async def _update(
        self, job_id: str, fields: Dict[str, Any], *, refresh_ttl: bool = False
    ) -> None:
        client = await get_redis_or_none()
        if client is None:
            logger.error("SIMILARITY UPLOAD JOB: Redis unavailable — lost update for %s", job_id)
            return
        try:
            key = self._key(job_id)
            # Never resurrect an expired job: hset would recreate it as a partial record with no
            # owner, which the poll endpoint would then have to authorize with nothing to go on.
            if not await client.exists(key):
                logger.warning("SIMILARITY UPLOAD JOB: %s expired before update %s", job_id, fields.get("state"))
                return
            await client.hset(key, mapping=fields)
            if refresh_ttl:
                await client.expire(key, self.ttl)
        except Exception as exc:  # pragma: no cover — defensive
            logger.error("SIMILARITY UPLOAD JOB: could not update %s: %s", job_id, exc)
        finally:
            await client.close()

    # ------------------------------------------------------------------ #
    # reads
    # ------------------------------------------------------------------ #
    async def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        """The job record, or ``None`` if it never existed / has expired."""
        client = await get_redis_or_none()
        if client is None:
            return None
        try:
            raw = await client.hgetall(self._key(job_id))
        except Exception as exc:  # pragma: no cover — defensive
            logger.error("SIMILARITY UPLOAD JOB: could not read %s: %s", job_id, exc)
            return None
        finally:
            await client.close()

        if not raw:
            return None

        job: Dict[str, Any] = {
            "job_id": job_id,
            "state": raw.get("state") or STATE_QUEUED,
            "track_uuid": raw.get("track_uuid") or None,
            "user_id": _as_int(raw.get("user_id")),
            "partner_id": _as_int(raw.get("partner_id")),
            "track_id": _as_int(raw.get("track_id")),
            "visible_count": _as_int(raw.get("visible_count")),
            "created_at": _as_float(raw.get("created_at")),
            "started_at": _as_float(raw.get("started_at")),
            "finished_at": _as_float(raw.get("finished_at")),
            "error": raw.get("error") or None,
            "reason": raw.get("reason") or None,
            "result": None,
        }
        if raw.get("result"):
            try:
                job["result"] = json.loads(raw["result"])
            except (ValueError, TypeError):
                # A corrupt payload is a failed job, not a 500 on the poll endpoint.
                logger.error("SIMILARITY UPLOAD JOB: %s has an unreadable result payload", job_id)
                job["state"] = STATE_FAILED
                job["error"] = "The result could not be read."
                job["reason"] = "corrupt_result"
        return job


def _as_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
