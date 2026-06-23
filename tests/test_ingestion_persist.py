"""DB-free unit tests for the chunked-persist helpers."""
from app.services.ingestion_persist import _safe_year, _stored_path_for


def test_safe_year_clamps_to_mysql_year_range():
    assert _safe_year(2008) == 2008
    assert _safe_year(1901) == 1901
    assert _safe_year(2155) == 2155
    assert _safe_year(12021) is None     # out of range (the V9 open-track case)
    assert _safe_year(1850) is None
    assert _safe_year("notayear") is None
    assert _safe_year(None) is None


def test_stored_path_is_uuid_keyed_with_lowercased_ext():
    # uuid-keyed → no uq_audio_path collision on duplicate filenames
    assert _stored_path_for("u1", "01. Song.MP3") == "internal/raw/u1.mp3"
    assert _stored_path_for("u2", "track.FLAC") == "internal/raw/u2.flac"
    assert _stored_path_for("u3", "noext") == "internal/raw/u3"
