"""
Tests for the analysis summary layer (Phase C1)
===============================================

Covers the pure canonical→summary mapping and the DB upsert/read/idempotency against the real
``track_analysis_results`` table (admin context, like the other library tests).
"""

import uuid

import pytest

from app.core.context import set_admin_context
from app.services.track_analysis_result_service import (
    TrackAnalysisResultService,
    _clip,
    _to_int,
)
from database.connection import AsyncSessionLocal
from tests.api.library_helpers import create_track, create_user


def _canonical() -> dict:
    """A representative (partial) canonical analysis document."""
    return {
        "analysis_id": "x" * 32,
        "identity": {
            "duration_ms": 201345.6,
            "sample_rate_hz": 44100.0,
            "bit_rate": 320000,
            "channel_count": 2,
            "codec": "mp3",
        },
        "technical": {"integrated_loudness_lufs": -8.4},
        "rhythm": {"bpm": 128.02},
        "tonality": {"key": "A", "scale": "minor", "camelot": "8A"},
        "semantics": {
            "genre_top": [{"label": "House", "score": 0.7}, {"label": "Techno", "score": 0.2}],
            "style_maest_top": [{"label": "Deep House", "score": 0.5}],
            "mood_theme_top": [{"label": "energetic", "score": 0.6}],
            "instrument_top": [{"label": "synthesizer", "score": 0.8}],
            "danceability": 0.91,
            "valence": 0.62,
            "arousal": 0.71,
            "voice_score": 0.12,
            "voice_instrumental": "instrumental",
        },
    }


# --- pure mapping ----------------------------------------------------------- #
def test_summarize_maps_canonical_fields() -> None:
    s = TrackAnalysisResultService.summarize(_canonical())
    assert s["bpm"] == 128.02
    assert s["music_key"] == "A" and s["scale"] == "minor" and s["camelot"] == "8A"
    assert s["loudness_lufs"] == -8.4
    assert s["top_genre"] == "House"  # top-1 only
    assert s["top_style"] == "Deep House"
    assert s["top_mood"] == "energetic"
    assert s["top_instrument"] == "synthesizer"
    assert s["danceability"] == 0.91
    assert s["valence"] == 0.62 and s["arousal"] == 0.71
    assert s["voice_instrumental"] == "instrumental"
    assert s["sample_rate_hz"] == 44100  # float → int
    assert s["channels"] == 2
    assert s["codec"] == "mp3"


def test_summarize_tolerates_missing_sections() -> None:
    s = TrackAnalysisResultService.summarize({})
    assert all(s[k] is None for k in ("bpm", "music_key", "top_genre", "valence", "codec"))


def test_helpers() -> None:
    assert _to_int(44100.0) == 44100
    assert _to_int(None) is None
    assert _to_int("nope") is None
    assert _clip("abcdef", 3) == "abc"
    assert _clip(None, 3) is None


# --- DB persist / read / idempotency ---------------------------------------- #
async def test_record_read_and_idempotent_upsert() -> None:
    user = await create_user()
    track = await create_track(user_id=user.id, partner_id=1)
    set_admin_context(True)
    svc = TrackAnalysisResultService()
    analysis_uuid = uuid.uuid4().hex

    async with AsyncSessionLocal() as db:
        row = await svc.record_from_canonical(
            db, analysis_uuid=analysis_uuid, result=_canonical(),
            track_id=track.id, user_id=user.id, partner_id=1,
        )
        assert row.bpm == 128.02 and row.top_genre == "House"

    # read back
    async with AsyncSessionLocal() as db:
        got = await svc.get_by_analysis_uuid(db, analysis_uuid)
        assert got is not None
        d = svc.to_dict(got)
        assert d["key"] == "A" and d["camelot"] == "8A" and d["top_genre"] == "House"

    # re-run with a changed value → SAME row updated (idempotent on analysis_uuid)
    changed = _canonical()
    changed["rhythm"]["bpm"] = 130.0
    async with AsyncSessionLocal() as db:
        row2 = await svc.record_from_canonical(
            db, analysis_uuid=analysis_uuid, result=changed,
            track_id=track.id, user_id=user.id, partner_id=1,
        )
        assert row2.id == row.id  # updated, not duplicated
        assert row2.bpm == 130.0

    async with AsyncSessionLocal() as db:
        latest = await svc.get_latest_for_track(db, track.id)
        assert latest is not None and latest.analysis_uuid == analysis_uuid
