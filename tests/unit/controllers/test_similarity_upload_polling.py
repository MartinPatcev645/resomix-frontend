"""Authorization and shape of the similarity-upload poll endpoint.

`GET /similarity/upload/{job_id}/status` hands back a playlist the caller is waiting for, so
the interesting cases are the ones where the caller is NOT the owner, and the contract the
frontend depends on: when `state` is `done`, `result` is byte-for-byte what the blocking
endpoint used to return in `data`.

Stubbed job store, no database — safe to run at any time.
"""
import asyncio
import json

import pytest

from app.controllers.similarity_controller import SimilarityController


class _StubJobs:
    def __init__(self, job=None):
        self._job = job

    async def get(self, job_id):
        if self._job is None:
            return None
        return {**self._job, "job_id": job_id}


class _User:
    def __init__(self, user_id):
        self.id = user_id


def _poll(job, current_user=None, partner_id=1):
    controller = SimilarityController()
    controller.upload_jobs = _StubJobs(job)
    response = asyncio.run(
        controller.get_upload_job(db=None, job_id="job-1", current_user=current_user, partner_id=partner_id)
    )
    return response.status_code, json.loads(response.body)


_OWNED_DONE = {
    "state": "done",
    "user_id": 7,
    "partner_id": 1,
    "track_id": 42,
    "track_uuid": "uuid-abc",
    "result": {"playlist": {"id": 9}, "tracks": [{"uuid": "t1"}]},
    "error": None,
    "reason": None,
}


def test_owner_gets_the_result_payload_unchanged():
    code, body = _poll(_OWNED_DONE, current_user=_User(7))
    assert code == 200
    assert body["data"]["state"] == "done"
    # The frontend's existing success handler consumes this verbatim.
    assert body["data"]["result"] == _OWNED_DONE["result"]
    assert body["data"]["track_uuid"] == "uuid-abc"


def test_a_different_user_is_refused():
    code, body = _poll(_OWNED_DONE, current_user=_User(8))
    assert code == 403
    assert "result" not in body.get("data", {})


def test_anonymous_caller_cannot_read_an_owned_job():
    """Without this, logging out (or never logging in) would read another user's playlist."""
    code, _ = _poll(_OWNED_DONE, current_user=None)
    assert code == 403


def test_another_partner_is_refused():
    code, _ = _poll(_OWNED_DONE, current_user=_User(7), partner_id=2)
    assert code == 403


def test_anonymous_job_is_readable_by_the_holder_of_the_id():
    """An unowned job has nothing to authorize against; the uuid4 job id is the capability."""
    job = {**_OWNED_DONE, "user_id": None}
    code, body = _poll(job, current_user=None)
    assert code == 200
    assert body["data"]["result"] == job["result"]


def test_unknown_or_expired_job_is_404_expired():
    code, body = _poll(None, current_user=_User(7))
    assert code == 404
    assert body["reason"] == "expired"


def test_queued_job_reports_state_without_a_result_key():
    job = {**_OWNED_DONE, "state": "queued", "result": None}
    code, body = _poll(job, current_user=_User(7))
    assert code == 200
    assert body["data"]["state"] == "queued"
    assert "result" not in body["data"]


def test_failed_job_reports_the_reason_and_no_result():
    job = {**_OWNED_DONE, "state": "failed", "result": None,
           "error": "We could not build a playlist for this track. Please try again.",
           "reason": "similarity_failed"}
    code, body = _poll(job, current_user=_User(7))
    assert code == 200
    assert body["data"]["state"] == "failed"
    assert body["data"]["reason"] == "similarity_failed"
    assert "result" not in body["data"]
