"""
Unit tests for the ingestion v2 stage-lifecycle helpers.
"""

from datetime import datetime, timezone

from app.services.ingestion_stages import (
    Stage, advance_stage, is_terminal, sanitized_logs_json,
    ACTIVE_STAGES, TERMINAL_STAGES,
)


class _Log:
    """Minimal stand-in for an IngestLog row (the helpers only touch these attrs)."""
    def __init__(self):
        self.stage = None
        self.stage_timeline = None
        self.status = "PROCESSING"
        self.batch_filename = "manifest.csv"
        self.track_count = 2


def test_advance_stage_stamps_utc_and_reassigns_dict():
    log = _Log()
    first = log.stage_timeline
    advance_stage(log, Stage.RECEIVED)
    advance_stage(log, Stage.VALIDATING)

    assert log.stage == Stage.VALIDATING
    assert list(log.stage_timeline) == [Stage.RECEIVED, Stage.VALIDATING]
    # A NEW dict object each time (so SQLAlchemy sees the JSON column as dirty).
    assert log.stage_timeline is not first
    # Timestamps are ISO-8601 UTC (offset-aware).
    ts = datetime.fromisoformat(log.stage_timeline[Stage.VALIDATING])
    assert ts.tzinfo is not None and ts.utcoffset() == timezone.utc.utcoffset(None)


def test_explicit_timestamp_is_honored():
    log = _Log()
    advance_stage(log, Stage.MOVED, at="2026-06-19T00:00:00+00:00")
    assert log.stage_timeline[Stage.MOVED] == "2026-06-19T00:00:00+00:00"


def test_terminal_vs_active_sets_are_disjoint_and_correct():
    assert is_terminal(Stage.READY)
    assert is_terminal(Stage.FAILED_VALIDATION)
    assert is_terminal(Stage.FAILED)
    assert not is_terminal(Stage.INGESTED)   # ingested-but-not-embedded still blocks
    assert not is_terminal(None)
    # No stage is simultaneously active and terminal.
    assert set(ACTIVE_STAGES).isdisjoint(TERMINAL_STAGES)
    # INGESTED is active (this is what keeps a partner blocked until embeddings run).
    assert Stage.INGESTED in ACTIVE_STAGES


def test_sanitized_logs_json_has_no_internal_leakage():
    log = _Log()
    advance_stage(log, Stage.RECEIVED)
    out = sanitized_logs_json(log)
    assert set(out) == {"batch", "status", "stage", "track_count", "stages_utc", "generated_at"}
    assert out["batch"] == "manifest.csv"
    assert out["stages_utc"] == log.stage_timeline
    # Must not expose paths / hostnames / ids.
    blob = repr(out).lower()
    for leak in ("/srv/", "internal", "partner_id", "home_dir", "traceback"):
        assert leak not in blob
