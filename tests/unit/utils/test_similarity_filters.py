"""
Response-level metadata sanitisation (`apply_response_filtering`)
=================================================================

Pins the per-field sanitisation policy for track dicts on their way out:
  * `title` / `artist` / `label` / `album` get the URL/stopper filter — a whole-field URL/domain is
    blanked, and promo tails ("… www.site.com") are truncated (album was ADDED to this set when the
    similarity/playlist responses started carrying it, 2026-07-20),
  * `genre` is deliberately NOT filtered — in-house it comes from the controlled `genres` table and
    the Apple value is a clean pipe list ("House | Afro"); the stopper filter could only truncate a
    legitimate value,
  * unrelated fields pass through untouched, and the input dicts are not mutated.
"""
from app.utils.similarity_filters import apply_response_filtering


def _track(**over):
    t = {
        "rank": 1, "score": 0.9, "id": "uuid-1",
        "title": "Clean Title", "artist": "Clean Artist",
        "label": "Clean Label", "album": "Clean Album",
        "genre": "House | Music | Dance",
        "year": 2024, "duration": 120.0, "type": "internal",
    }
    t.update(over)
    return t


def test_clean_metadata_passes_through_unchanged():
    [out] = apply_response_filtering([_track()])
    assert out["title"] == "Clean Title"
    assert out["artist"] == "Clean Artist"
    assert out["label"] == "Clean Label"
    assert out["album"] == "Clean Album"
    assert out["genre"] == "House | Music | Dance"
    assert out["year"] == 2024 and out["score"] == 0.9  # untouched passthrough


def test_album_whole_field_url_is_blanked():
    [out] = apply_response_filtering([_track(album="www.freemusicpromo.com")])
    assert out["album"] == ""


def test_album_promo_tail_is_truncated():
    [out] = apply_response_filtering([_track(album="Great Album www.promo-site.com")])
    assert out["album"] == "Great Album"


def test_label_still_filtered_regression():
    [out] = apply_response_filtering([_track(label="Cool Label https://spam.example")])
    assert out["label"] == "Cool Label"


def test_genre_is_never_filtered():
    # Even a genre containing a stopper-like substring must come through verbatim — the filter
    # would truncate it, and genre values are controlled-vocabulary, never scraped promo text.
    [out] = apply_response_filtering([_track(genre="House | www-adjacent")])
    assert out["genre"] == "House | www-adjacent"


def test_missing_optional_fields_are_tolerated():
    [out] = apply_response_filtering([{"id": "x", "title": "T"}])
    assert out["title"] == "T"
    assert "album" not in out and "genre" not in out


def test_input_is_not_mutated():
    src = _track(album="Great Album www.promo-site.com")
    apply_response_filtering([src])
    assert src["album"] == "Great Album www.promo-site.com"
