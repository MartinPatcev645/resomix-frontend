"""
TrackResolver matching rules
============================

Exercises the pure matching core (``normalize`` / ``pick_match``) the DB lookup feeds into.
"""

from app.services.track_resolver import (
    DURATION_TOLERANCE_MS,
    bandcamp_url_key,
    bandcamp_url_variants,
    normalize,
    pick_match,
)


def test_bandcamp_url_key_ignores_scheme_case_and_trailing_slash():
    assert bandcamp_url_key("HTTPS://Label.com/track/Song/") == "label.com/track/song"
    assert bandcamp_url_key("http://label.com/track/Song") == bandcamp_url_key("https://Label.com/track/Song/")
    assert bandcamp_url_key(None) == ""
    assert set(bandcamp_url_variants("http://Label.com/track/Song/")) == {
        "https://label.com/track/song",
        "https://label.com/track/song/",
        "http://label.com/track/song",
        "http://label.com/track/song/",
    }


def test_normalize_ignores_case_accents_punctuation_and_spacing():
    assert normalize("  Beyoncé –  Halo!! ") == normalize("beyonce halo")
    assert normalize("Simon & Garfunkel") == normalize("simon and garfunkel")
    assert normalize(None) == ""


def test_matches_on_normalized_artist_and_title():
    candidates = [(10, "Daft Punk", "One More Time", 320_000), (11, "Other", "One More Time", 320_000)]
    assert pick_match("daft punk", "One more time!", None, candidates) == 10


def test_duration_within_tolerance_matches():
    candidates = [(10, "Artist", "Song", 200_000)]
    assert pick_match("Artist", "Song", 200_000 + DURATION_TOLERANCE_MS - 1, candidates) == 10


def test_duration_mismatch_rejects():
    candidates = [(10, "Artist", "Song", 200_000)]
    assert pick_match("Artist", "Song", 200_000 + DURATION_TOLERANCE_MS + 1, candidates) is None


def test_missing_duration_on_either_side_does_not_block():
    assert pick_match("Artist", "Song", None, [(10, "Artist", "Song", 200_000)]) == 10
    assert pick_match("Artist", "Song", 200_000, [(10, "Artist", "Song", None)]) == 10


def test_no_match():
    assert pick_match("Artist", "Song", None, [(10, "Someone Else", "Song", None)]) is None
    assert pick_match("Artist", "Song", None, []) is None


def test_ambiguous_match_is_rejected():
    candidates = [(10, "Artist", "Song", None), (11, "Artist", "Song", None)]
    assert pick_match("Artist", "Song", None, candidates) is None


def test_missing_artist_or_title_never_matches():
    candidates = [(10, "", "", None)]
    assert pick_match(None, "Song", None, candidates) is None
    assert pick_match("Artist", None, None, candidates) is None
