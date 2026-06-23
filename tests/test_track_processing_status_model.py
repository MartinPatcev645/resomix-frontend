"""Unit tests for the track_processing_status transcode-stage columns.

Pure model introspection (no DB) — guards the pipeline-redesign schema change:
transcode is a first-class tracked stage alongside embedding/peaks/segments.
"""
from app.models.track_processing_status import TrackProcessingStatus


def _col(name):
    return TrackProcessingStatus.__table__.columns[name]


def test_transcode_stage_columns_exist():
    cols = TrackProcessingStatus.__table__.columns
    for name in ("transcode_status", "transcode_error", "transcode_completed_at"):
        assert name in cols, f"missing column {name!r}"


def test_transcode_status_not_null_defaults_pending():
    c = _col("transcode_status")
    assert c.nullable is False
    assert c.default is not None and c.default.arg == "pending"


def test_transcode_status_indexed_for_job_rollups():
    assert _col("transcode_status").index is True


def test_transcode_error_and_completed_at_are_nullable():
    assert _col("transcode_error").nullable is True
    assert _col("transcode_completed_at").nullable is True


def test_all_four_stage_status_columns_present():
    # transcode -> embedding -> (peaks, segments): the full per-track state machine.
    cols = TrackProcessingStatus.__table__.columns
    for name in ("transcode_status", "embedding_status", "peaks_status", "segments_status"):
        assert name in cols
