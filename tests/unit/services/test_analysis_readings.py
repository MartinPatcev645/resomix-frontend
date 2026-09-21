"""
Unit tests for the DJ / producer / curator readings built from a canonical analysis result.

Pure: no HTTP, no DB, no Celery. Everything here is a dict in and a string out.

The load-bearing properties, in the order they matter:
  * a template is never offered a fact the analysis did not produce (no "None BPM" on the card);
  * the same analysis always renders the same sentence (the endpoint is polled);
  * every placeholder used anywhere in the template file actually exists.
"""

from __future__ import annotations

from string import Formatter

from app.constants.analysis_reading_templates import (
    CURATOR_TEMPLATES,
    DJ_TEMPLATES,
    KNOWN_PLACEHOLDERS,
    PRODUCER_TEMPLATES,
    TEMPLATES_BY_AUDIENCE,
)
from app.services.analysis_readings_service import (
    attach_readings,
    build_readings,
    extract_facts,
)

AUDIENCES = ("for_dj", "for_producers", "for_curators")


def _full_result() -> dict:
    """A canonical result with every section populated."""
    return {
        "identity": {"duration_ms": 402_000},
        "technical": {"integrated_loudness_lufs": -14.3, "loudness_range_lu": 8.2},
        "rhythm": {"bpm": 122.2, "confidence": 0.94},
        "tonality": {"key": "F#", "scale": "minor", "camelot": "11A", "strength": 0.78},
        "energy": {
            "bass_entry_ms": 31_000,
            "structure_segments": [
                {"label": "intro", "start_ms": 0, "end_ms": 29_000},
                {"label": "build", "start_ms": 29_000, "end_ms": 72_000},
                {"label": "drop", "start_ms": 72_000, "end_ms": 198_000},
                {"label": "breakdown", "start_ms": 198_000, "end_ms": 242_000},
                {"label": "drop", "start_ms": 242_000, "end_ms": 370_000},
                {"label": "outro", "start_ms": 370_000, "end_ms": 402_000},
            ],
        },
        "semantics": {
            "genre_top": [{"label": "Electronic---House", "score": 0.71}],
            "style_maest_top": [{"label": "Deep House", "score": 0.63}],
            "mood_dimensions": {"happy": 0.4, "party": 0.86, "relaxed": 0.2},
            "danceability": 0.82,
            "valence": 0.64,
            "arousal": 0.71,
            "voice_instrumental": "instrumental",
        },
    }


# --- template file hygiene -------------------------------------------------- #
def test_every_placeholder_is_known() -> None:
    """A typo in a template would silently make it permanently ineligible. Fail here instead."""
    for audience, templates in TEMPLATES_BY_AUDIENCE.items():
        for tpl in templates:
            for _, name, _, _ in Formatter().parse(tpl):
                if name:
                    assert name in KNOWN_PLACEHOLDERS, f"{audience}: unknown placeholder {name!r} in {tpl!r}"


def test_extract_facts_supplies_every_known_placeholder() -> None:
    """The catalogue and the extractor must not drift apart."""
    assert set(extract_facts(_full_result())) == set(KNOWN_PLACEHOLDERS)


def test_each_audience_has_templates() -> None:
    for templates in (DJ_TEMPLATES, PRODUCER_TEMPLATES, CURATOR_TEMPLATES):
        assert len(templates) >= 20
        assert len(set(templates)) == len(templates), "duplicate template"


def test_each_audience_survives_a_tempo_and_key_only_track() -> None:
    """Tracks that fail loudness/structure/semantics detection must still read."""
    minimal = {"rhythm": {"bpm": 128}, "tonality": {"key": "A", "scale": "minor", "camelot": "8A"}}
    readings = build_readings(minimal, "seed")
    for audience in AUDIENCES:
        assert readings.get(audience), f"{audience} has no low-requirement template"


def test_no_em_dashes_in_templates() -> None:
    for templates in TEMPLATES_BY_AUDIENCE.values():
        for tpl in templates:
            assert "—" not in tpl


# --- fact extraction -------------------------------------------------------- #
def test_facts_are_display_ready() -> None:
    facts = extract_facts(_full_result())
    assert facts["bpm"] == "122.2"
    assert facts["key_name"] == "F# minor"
    assert facts["camelot"] == "11A"
    assert facts["lufs"] == "-14.3"
    assert facts["lra"] == "8.2"
    assert facts["duration"] == "6:42"
    assert facts["genre"] == "House"  # "Electronic---House" leaf
    assert facts["style"] == "Deep House"
    assert facts["danceability_pct"] == "82%"
    assert facts["voice"] == "instrumental"
    assert facts["mood_top"] == "party"
    assert facts["section_count"] == "6"
    assert facts["drop_start"] == "1:12"  # FIRST drop, not the second
    assert facts["drop_end"] == "3:18"
    assert facts["bass_entry"] == "0:31"


def test_integer_tempo_loses_its_trailing_zero() -> None:
    assert extract_facts({"rhythm": {"bpm": 128.0}})["bpm"] == "128"


def test_missing_values_are_absent_not_placeholder_strings() -> None:
    facts = extract_facts({"rhythm": {"bpm": None}, "tonality": {"key": "C"}})
    assert "bpm" not in facts
    assert "key_name" not in facts  # a key with no scale is not a tonal centre
    assert "N/A" not in "".join(facts.values())


def test_out_of_range_scores_are_rejected() -> None:
    facts = extract_facts({"semantics": {"danceability": 82, "valence": -1.0}})
    assert "danceability_pct" not in facts
    assert "valence_pct" not in facts


def test_non_dict_result_is_survivable() -> None:
    assert extract_facts("boom") == {}
    assert build_readings(None, "seed") == {}


# --- selection -------------------------------------------------------------- #
def test_reading_never_contains_an_unfilled_placeholder() -> None:
    for seed in (f"analysis-{i}" for i in range(50)):
        for text in build_readings(_full_result(), seed).values():
            assert "{" not in text and "}" not in text
            assert "None" not in text


def test_same_analysis_always_reads_the_same() -> None:
    """The result endpoint is polled; the sentence must not change under the reader."""
    first = build_readings(_full_result(), "analysis-abc")
    for _ in range(20):
        assert build_readings(_full_result(), "analysis-abc") == first


def test_different_analyses_vary() -> None:
    seen = {build_readings(_full_result(), f"analysis-{i}")["for_dj"] for i in range(60)}
    assert len(seen) > 1, "seeding collapsed to a single template"


def test_audiences_are_seeded_independently() -> None:
    readings = build_readings(_full_result(), "analysis-abc")
    assert len({readings[a] for a in AUDIENCES}) == 3


def test_templates_needing_absent_facts_are_not_chosen() -> None:
    """A track with no drop must never be described as having one."""
    no_structure = _full_result()
    no_structure["energy"] = {}
    for seed in (f"analysis-{i}" for i in range(60)):
        for text in build_readings(no_structure, seed).values():
            for word in ("drop", "breakdown", "outro", "intro", "build", "sections"):
                assert word not in text.lower(), f"{word!r} claimed without structure data: {text!r}"


# --- attachment ------------------------------------------------------------- #
def test_attach_adds_readings() -> None:
    result = attach_readings(_full_result(), "analysis-abc")
    assert set(result["readings"]) == set(AUDIENCES)


def test_attach_defers_to_the_analysis_service() -> None:
    """If the upstream canonical result ever carries its own readings, they win."""
    result = _full_result()
    result["readings"] = {"for_dj": "Supplied upstream."}
    assert attach_readings(result, "analysis-abc")["readings"] == {"for_dj": "Supplied upstream."}


def test_attach_ignores_blank_upstream_readings() -> None:
    result = _full_result()
    result["readings"] = {"for_dj": "", "for_producers": "  "}
    assert attach_readings(result, "analysis-abc")["readings"]["for_dj"]


def test_attach_leaves_an_error_envelope_alone() -> None:
    assert attach_readings("not a result", "analysis-abc") == "not a result"
    empty = {"state": "queued"}
    assert "readings" not in attach_readings(empty, "analysis-abc")


# --------------------------------------------------------------------------- #
# the `structure` block
# --------------------------------------------------------------------------- #
def _section(label: str, word: str, start: int, end: int, *, hidden: bool = False) -> dict:
    return {"label": label, "word": None if hidden else word, "start_ms": start, "end_ms": end,
            "bars": 8, "hidden": hidden, "shown": None if hidden else word}


def _with_structure(family: str, sections: list) -> dict:
    result = _full_result()
    result["structure"] = {"status": "ok", "gate": None, "family": family, "vocabulary": family,
                           "summary": "", "sections": sections}
    return result


# A minimal track: its grooves are canonical `drop`, but it is SHOWN "groove".
_GROOVE = [
    _section("start", "", 0, 400, hidden=True),
    _section("intro", "intro", 400, 60_000),
    _section("buildup", "build", 60_000, 75_000),
    _section("drop", "groove", 75_000, 150_000),
    _section("breakdown", "break", 150_000, 165_000),
    _section("drop", "groove", 165_000, 280_000),
    _section("outro", "outro", 280_000, 300_000),
]
_PEAK = [
    _section("intro", "intro", 0, 60_000),
    _section("drop", "drop", 60_000, 150_000),
    _section("breakdown", "breakdown", 150_000, 165_000),
    _section("outro", "outro", 165_000, 300_000),
]


def test_structure_offers_sections_by_their_shown_word() -> None:
    facts = extract_facts(_with_structure("groove", _GROOVE))
    assert facts["build_start"] == "1:00"
    assert facts["outro_start"] == "4:40"
    # hidden start / end markers are not sections a reader is told about
    assert facts["section_count"] == "6"


def test_a_groove_track_is_never_told_about_a_drop() -> None:
    """M3.1. Its grooves are canonical `drop`, so matching on the canonical class would put "the
    drop enters at 1:15" into copy for the one genre that must never see the word."""
    result = _with_structure("groove", _GROOVE)
    facts = extract_facts(result)
    assert "drop_start" not in facts and "drop_end" not in facts
    for i in range(200):
        for text in build_readings(result, f"analysis-{i}").values():
            assert "drop" not in text.lower(), text


def test_a_peak_track_still_gets_its_drop() -> None:
    facts = extract_facts(_with_structure("peak", _PEAK))
    assert facts["drop_start"] == "1:00"
    assert facts["breakdown_start"] == "2:30"


def test_no_beat_grid_quotes_no_tempo_and_no_sections() -> None:
    result = _full_result()
    result["structure"] = {"status": "gate", "gate": "continuous piece", "sections": []}
    facts = extract_facts(result)
    assert "bpm" not in facts and "bpm_confidence_pct" not in facts
    assert "section_count" not in facts


def test_the_structure_block_outranks_the_deprecated_ones() -> None:
    result = _with_structure("peak", _PEAK)
    result["energy"]["structure_segments"] = [{"label": "drop", "start_ms": 5_000, "end_ms": 6_000}]
    assert extract_facts(result)["drop_start"] == "1:00"
