"""
Unit tests for the Alwyzon-side analysis client + the upload sibling enqueue (Phase B).

These are pure (no HTTP, no Celery broker): the transport is exercised only through the
"not configured" short-circuit, and the polling state machine is driven by stubbed
get_status/get_result. The enqueue helper is checked for its guard conditions and that it
spools the audio + hands the task the right args.
"""

from __future__ import annotations

import os

import pytest

from app.core.config import settings
from app.services.analysis_service import AnalysisService


# --- client: configuration + id minting ------------------------------------- #
def test_new_analysis_id_is_hex32() -> None:
    aid = AnalysisService.new_analysis_id()
    assert len(aid) == 32
    assert all(c in "0123456789abcdef" for c in aid)


async def test_unconfigured_short_circuits(monkeypatch) -> None:
    monkeypatch.setattr(settings, "analysis_server_url", None)
    svc = AnalysisService()
    assert svc.is_configured is False
    created = await svc.create_analysis(audio_bytes=b"x", original_filename="a.mp3", analysis_id="a" * 32)
    assert created["status"] == "error"
    assert (await svc.get_status("a" * 32))["status"] == "error"
    assert (await svc.wait_for_result("a" * 32))["status"] == "error"


async def test_create_rejects_empty_audio(monkeypatch) -> None:
    monkeypatch.setattr(settings, "analysis_server_url", "http://analysis")
    svc = AnalysisService()
    out = await svc.create_analysis(audio_bytes=b"", original_filename="a.mp3", analysis_id="a" * 32)
    assert out["status"] == "error"


# --- client: wait_for_result state machine ---------------------------------- #
async def test_wait_for_result_success(monkeypatch) -> None:
    monkeypatch.setattr(settings, "analysis_server_url", "http://analysis")
    svc = AnalysisService()

    async def fake_status(_aid):
        return {"state": "succeeded"}

    async def fake_result(aid):
        return {"analysis_id": aid, "technical": {}}

    monkeypatch.setattr(svc, "get_status", fake_status)
    monkeypatch.setattr(svc, "get_result", fake_result)

    out = await svc.wait_for_result("b" * 32, timeout=5, poll_interval=0)
    assert out["status"] == "success"
    assert out["result"]["analysis_id"] == "b" * 32


async def test_wait_for_result_failed(monkeypatch) -> None:
    monkeypatch.setattr(settings, "analysis_server_url", "http://analysis")
    svc = AnalysisService()

    async def fake_status(_aid):
        return {"state": "failed", "error": "boom"}

    monkeypatch.setattr(svc, "get_status", fake_status)
    out = await svc.wait_for_result("c" * 32, timeout=5, poll_interval=0)
    assert out["status"] == "error"
    assert "boom" in out["message"]


async def test_wait_for_result_timeout(monkeypatch) -> None:
    monkeypatch.setattr(settings, "analysis_server_url", "http://analysis")
    svc = AnalysisService()

    async def fake_status(_aid):
        return {"state": "running"}

    monkeypatch.setattr(svc, "get_status", fake_status)
    out = await svc.wait_for_result("d" * 32, timeout=0, poll_interval=0)
    assert out["status"] == "timeout"


async def test_wait_for_result_partial_when_not_requiring_full(monkeypatch) -> None:
    monkeypatch.setattr(settings, "analysis_server_url", "http://analysis")
    svc = AnalysisService()

    async def fake_status(_aid):
        return {"state": "running", "part1_ready": True}

    async def fake_result(aid):
        return {"analysis_id": aid}

    monkeypatch.setattr(svc, "get_status", fake_status)
    monkeypatch.setattr(svc, "get_result", fake_result)
    out = await svc.wait_for_result("e" * 32, timeout=5, poll_interval=0, require_full=False)
    assert out["status"] == "partial"


# --- controller: sibling enqueue guards + spool ----------------------------- #
def _controller():
    from app.controllers.similarity_controller import SimilarityController

    return SimilarityController()


class _FakeTask:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def delay(self, **kwargs) -> None:
        self.calls.append(kwargs)


def test_enqueue_inert_when_unconfigured(monkeypatch) -> None:
    c = _controller()
    c.analysis_service.base_url = None  # -> is_configured False
    fake = _FakeTask()
    monkeypatch.setattr("app.tasks.analysis_tasks.generate_track_analysis", fake)
    c._maybe_enqueue_analysis_sibling(
        audio_bytes=b"audio", original_filename="a.mp3", track_id=1, user_id=5,
        partner_id=settings.system_partner_id,
    )
    assert fake.calls == []


def test_enqueue_inert_for_guest_or_b2b(monkeypatch, tmp_path) -> None:
    c = _controller()
    c.analysis_service.base_url = "http://analysis"  # configured
    monkeypatch.setattr(settings, "temp_dir", str(tmp_path))
    fake = _FakeTask()
    monkeypatch.setattr("app.tasks.analysis_tasks.generate_track_analysis", fake)

    # guest (no user_id)
    c._maybe_enqueue_analysis_sibling(
        audio_bytes=b"audio", original_filename="a.mp3", track_id=1, user_id=None,
        partner_id=settings.system_partner_id,
    )
    # B2B partner (not the system/consumer partner)
    c._maybe_enqueue_analysis_sibling(
        audio_bytes=b"audio", original_filename="a.mp3", track_id=1, user_id=5,
        partner_id=settings.system_partner_id + 999,
    )
    assert fake.calls == []


def test_enqueue_fires_and_spools_for_consumer(monkeypatch, tmp_path) -> None:
    c = _controller()
    c.analysis_service.base_url = "http://analysis"  # configured
    monkeypatch.setattr(settings, "temp_dir", str(tmp_path))
    fake = _FakeTask()
    monkeypatch.setattr("app.tasks.analysis_tasks.generate_track_analysis", fake)

    c._maybe_enqueue_analysis_sibling(
        audio_bytes=b"real-audio-bytes", original_filename="song.flac", track_id=42, user_id=7,
        partner_id=settings.system_partner_id,
    )

    assert len(fake.calls) == 1
    kw = fake.calls[0]
    assert kw["track_id"] == 42 and kw["user_id"] == 7
    assert kw["original_filename"] == "song.flac"
    # analysis_id is a fresh hex token; the spool file exists with the real extension + our bytes.
    assert len(kw["analysis_id"]) == 32
    assert kw["audio_spool_path"].endswith(".flac")
    assert os.path.exists(kw["audio_spool_path"])
    with open(kw["audio_spool_path"], "rb") as fh:
        assert fh.read() == b"real-audio-bytes"
