"""
ES index document building — Apple-first display names (2026-07-22)
===================================================================

The search index must carry the same title/artist the playlist responses display
(PLAYBACK_APPLE_MUSIC_PLAN.md §6): Apple's `name`/`artist` when the track plays from an Apple
preview (non-empty), in-house otherwise. When Apple wins, the differing in-house spelling is kept
as extra recall text in `all_text` — but never as the displayed/indexed title.
"""
from app.utils.es_index import build_track_doc, resolve_display_names, split_artists


# ---------------------------------------------------------------------------
# resolve_display_names — the shared index-time / read-time policy
# ---------------------------------------------------------------------------

def test_apple_wins_when_preview_present():
    t, a = resolve_display_names("germs (I) (I)", "Sikora", "germs (I)", "Sikora", "https://prev/x.m4a")
    assert (t, a) == ("germs (I)", "Sikora")


def test_inhouse_when_no_preview():
    # A match row without a preview never applies Apple metadata (same as enrichment).
    t, a = resolve_display_names("Inhouse T", "Inhouse A", "Apple T", "Apple A", None)
    assert (t, a) == ("Inhouse T", "Inhouse A")


def test_empty_apple_fields_fall_back_per_field():
    t, a = resolve_display_names("Inhouse T", "Inhouse A", "", "Apple A", "https://prev/x.m4a")
    assert (t, a) == ("Inhouse T", "Apple A")


# ---------------------------------------------------------------------------
# build_track_doc — extra recall text
# ---------------------------------------------------------------------------

def test_extra_text_joins_all_text_only():
    doc = build_track_doc("u1", "Apple Title", "Apple Artist", extra_text="Inhouse Title")
    assert doc["title"] == "Apple Title"                 # display/index title is Apple's
    assert "Inhouse Title" in doc["all_text"]            # old spelling still searchable
    assert "Inhouse" not in doc["dedupe"]                # collapse key uses display names only


def test_extra_text_skipped_when_duplicate_or_empty():
    doc = build_track_doc("u1", "Same Title", "A", extra_text="same title")
    assert doc["all_text"].lower().count("same title") == 1
    doc2 = build_track_doc("u1", "T", "A", extra_text="   ")
    assert doc2["all_text"] == "A T"


def test_doc_shape_unchanged():
    doc = build_track_doc("u1", "T", "A & B")
    assert set(doc) == {"uuid", "type", "artists", "title", "all_text", "dedupe"}
    assert doc["artists"] == ["A", "B"]


def test_split_artists_conservative():
    assert split_artists("Mihai Popoviciu") == ["Mihai Popoviciu"]
    assert split_artists("A, B & C") == ["A", "B", "C"]
    assert split_artists(None) == []
