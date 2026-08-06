"""
Full Track Intelligence is Pro; the summary card is not (pricing v2.1, C3)
=========================================================================

``can_view_full_analysis`` is a **page boundary**. Everyone who uploads gets the whole summary card
— BPM, key, energy journey, sections, the persona blurb — and only Pro gets the dashboard.

The card and the dashboard come from the SAME endpoint, so the gate is a projection rather than a
refusal: refusing would take the card away from the free user who is entitled to it.

Two failure directions, both bad and neither loud:

  * **too generous** — a dashboard field slips through and the Pro feature is free. Nothing errors.
  * **too strict**   — a card field is dropped and a free user's summary silently loses a panel.

So the allow-list is asserted from both ends: every card field survives, and every dashboard field
is gone.
"""

import pytest

from app.services.analysis_projection import (
    FULL_ONLY_SECTIONS,
    LOCK_FLAG,
    SUMMARY_FIELDS,
    project_summary,
)


def _full_result():
    """A canonical result carrying every section the analysis service emits."""
    return {
        "state": "succeeded",
        "part1_ready": True,
        "progress": {"percent": 100},
        "analysis_id": "abc-123",
        "identity": {
            "input_filename": "track.wav", "duration_ms": 214000, "sample_rate_hz": 44100,
            "bit_rate": 320000, "channel_count": 2, "codec": "pcm",
        },
        "technical": {
            "integrated_loudness_lufs": -8.2, "loudness_range_lu": 4.1,
            "true_peak_dbtp": -0.3, "average_loudness_db": -12.0, "crest_factor": 7.7,
            "loudness_curve": [1, 2, 3], "rms_energy_curve": [4, 5, 6],
        },
        "rhythm": {
            "bpm": 124.0, "confidence": 0.91, "bar_count": 108,
            "beat_times_seconds": [0.1, 0.6], "downbeats_seconds": [0.1],
            "phrase_boundaries_seconds": [8.0],
        },
        "tonality": {
            "key": "A", "scale": "minor", "strength": 0.8, "camelot": "8A", "ambiguous": False,
            "chromagram": [[1, 2]], "mean_chroma": [0.1], "alt_camelot": "8B",
            "key_margin": 0.2, "tonic_in_top_chroma": True, "tuning_hz": 440.0, "tuning_cents": 0.0,
        },
        "energy": {
            "energy_curve": [0.1, 0.9], "structure_segments": [{"start_ms": 0, "end_ms": 1000}],
            "bass_entry_ms": 320, "onset_times_seconds": [0.2, 0.4],
        },
        "semantics": {
            "genre_top": [{"label": "house", "score": 0.7}],
            "style_maest_top": [{"label": "deep house", "score": 0.6}],
            "mood_dimensions": {"happy": 0.4}, "danceability": 0.8,
            "voice_instrumental": "instrumental", "voice_score": 0.1,
            "valence": 0.5, "arousal": 0.6,
            "mood_theme_top": [{"label": "energetic", "score": 0.5}],
            "instrument_top": [{"label": "synth", "score": 0.9}],
            "approachability": 0.7, "timbre_bright": 0.3, "timbre_dark": 0.2,
            "mood_acoustic": 0.1, "mood_electronic": 0.9,
        },
        "spectral": {
            "centroid_curve": [1], "rolloff_curve": [2], "flatness_curve": [3],
            "bandwidth_curve": [4], "zcr_curve": [5],
            "mel_spectrogram": [[1, 2]], "linear_spectrogram": [[3, 4]],
        },
        "timeline": {
            "genre_over_time": {"series": []}, "mood_over_time": {"series": []},
            "instrument_over_time": {"series": []}, "voice_regions": [],
        },
        "composition": {"stems": {"drums": {}}, "vocal_regions": []},
        "readings": {"for_dj": "Mix it in at 124.", "for_producers": "…", "for_curators": "…"},
    }


@pytest.fixture
def projected():
    return project_summary(_full_result())


class TestTheCardSurvivesIntact:
    """Each of these is printed on `AnalysisSummaryCard.tsx`. Losing one is a visible regression
    for a free user who is entitled to the whole card."""

    @pytest.mark.parametrize(
        "section,field",
        [
            ("identity", "input_filename"), ("identity", "duration_ms"),
            ("technical", "integrated_loudness_lufs"), ("technical", "loudness_range_lu"),
            ("rhythm", "bpm"), ("rhythm", "confidence"),
            ("tonality", "key"), ("tonality", "camelot"), ("tonality", "strength"),
            ("energy", "energy_curve"), ("energy", "structure_segments"),
            ("semantics", "genre_top"), ("semantics", "style_maest_top"),
            ("semantics", "mood_dimensions"), ("semantics", "danceability"),
            ("semantics", "valence"), ("semantics", "arousal"),
            ("semantics", "voice_instrumental"), ("semantics", "voice_score"),
            ("readings", "for_dj"), ("readings", "for_producers"), ("readings", "for_curators"),
        ],
    )
    def test_card_field_is_present(self, projected, section, field):
        assert field in projected[section]

    def test_values_are_not_altered(self, projected):
        """A projection removes fields; it must never round, rescale or otherwise touch what is
        left — the free card and the Pro card must show the same BPM."""
        assert projected["rhythm"]["bpm"] == 124.0
        assert projected["energy"]["structure_segments"] == [{"start_ms": 0, "end_ms": 1000}]


class TestTheDashboardIsWithheld:
    @pytest.mark.parametrize("section", sorted(FULL_ONLY_SECTIONS))
    def test_full_only_sections_are_gone(self, projected, section):
        """Spectrograms, over-time timelines and stem composition ARE the dashboard."""
        assert section not in projected

    @pytest.mark.parametrize(
        "section,field",
        [
            ("technical", "loudness_curve"), ("technical", "rms_energy_curve"),
            ("technical", "true_peak_dbtp"), ("technical", "crest_factor"),
            ("rhythm", "beat_times_seconds"), ("rhythm", "downbeats_seconds"),
            ("rhythm", "phrase_boundaries_seconds"),
            ("tonality", "chromagram"), ("tonality", "mean_chroma"), ("tonality", "tuning_hz"),
            ("energy", "onset_times_seconds"),
            ("semantics", "mood_theme_top"), ("semantics", "instrument_top"),
            ("semantics", "approachability"), ("semantics", "timbre_bright"),
            ("semantics", "mood_electronic"),
        ],
    )
    def test_dashboard_field_is_absent(self, projected, section, field):
        assert field not in projected.get(section, {})

    def test_withheld_means_absent_not_nulled(self, projected):
        """A null still tells you the field exists and roughly what it is. More importantly, the
        point of moving this server-side is that the value never leaves the server."""
        import json

        blob = json.dumps(projected)
        assert "mel_spectrogram" not in blob
        assert "chromagram" not in blob


class TestUnknownFieldsAreDeniedByDefault:
    def test_a_new_upstream_section_is_withheld(self):
        """The analysis service ships independently of this one. A deny-list would serve every
        field it adds until somebody noticed — silently, and in the generous direction."""
        result = _full_result()
        result["stem_separation_v2"] = {"secret": 1}
        assert "stem_separation_v2" not in project_summary(result)

    def test_a_new_field_inside_an_allowed_section_is_withheld(self):
        result = _full_result()
        result["semantics"]["brand_new_premium_metric"] = 0.99
        assert "brand_new_premium_metric" not in project_summary(result)["semantics"]


class TestPlumbingSurvives:
    """Job state and playback ids are not intelligence. Dropping them would break polling and
    the "Find similar tracks" link for exactly the users who are allowed to use them."""

    @pytest.mark.parametrize("key", ["state", "part1_ready", "progress", "analysis_id"])
    def test_plumbing_key_is_kept(self, projected, key):
        assert key in projected

    def test_playback_refs_survive_when_present(self):
        result = _full_result()
        result.update({"track_uuid": "t-1", "playlist_uuid": "p-1", "sibling_playlist_state": "ready"})
        out = project_summary(result)
        assert out["track_uuid"] == "t-1"
        assert out["playlist_uuid"] == "p-1"
        assert out["sibling_playlist_state"] == "ready"


class TestTheClientCanTell:
    def test_the_lock_flag_is_set(self, projected):
        """Without it a free user opening the full dashboard gets empty charts rather than an
        upgrade prompt — which reads as a broken page, not a paywall."""
        assert projected[LOCK_FLAG] is True

    def test_the_upgrade_target_is_named(self, projected):
        assert projected["upgrade"] == "pro"

    def test_a_full_result_carries_no_lock_flag(self):
        """Pro must not be told anything is locked."""
        assert LOCK_FLAG not in _full_result()


class TestDegenerateInput:
    def test_a_partial_result_does_not_raise(self):
        """Part-1 results arrive with only some sections filled; the projection runs on those too."""
        out = project_summary({"state": "running", "part1_ready": True, "rhythm": {"bpm": 120}})
        assert out["rhythm"]["bpm"] == 120
        assert "identity" not in out

    def test_an_empty_section_is_dropped_rather_than_left_empty(self):
        out = project_summary({"identity": {}, "rhythm": {"bpm": 120}})
        assert "identity" not in out

    def test_a_non_dict_section_is_ignored(self):
        assert "identity" not in project_summary({"identity": "unexpected", "rhythm": {"bpm": 1}})

    def test_non_dict_input_is_returned_untouched(self):
        """An error envelope or a bare string is not a result. Mangling it here would turn a clear
        upstream failure into a confusing empty one."""
        assert project_summary(None) is None
        assert project_summary("boom") == "boom"


class TestAllowListIntegrity:
    def test_no_section_is_both_allowed_and_full_only(self):
        assert not (set(SUMMARY_FIELDS) & FULL_ONLY_SECTIONS)

    def test_every_allow_list_is_non_empty(self):
        """An accidentally empty set would silently strip a whole section from the free card."""
        assert all(fields for fields in SUMMARY_FIELDS.values())
