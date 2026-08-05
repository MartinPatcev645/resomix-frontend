"""
Server-built export — formatting and caps (pricing v2.1, C2)
============================================================

Export moved from the browser to the server so the plan's limits apply to the bytes the user
receives. Two things therefore have to hold:

  * **the file must not change.** Users already download this file. A relocation that quietly
    renumbers, reorders or re-punctuates it is a regression they will notice before we do.
  * **the cap must be the lowest of every ceiling.** Getting that wrong in the generous direction
    turns the export into a way to read the blurred tracks the teaser is meant to withhold.

Pure unit tests: dicts in, string out. No DB, no Redis, no entitlements.
"""

from datetime import datetime, timezone

import pytest

from app.services import playlist_export_service as svc


def _data(track_count=3, name="Sonic Journey", label="Warp"):
    return {
        "playlist": {"name": name},
        "queried_track": {"artist": "Boards of Canada", "title": "Roygbiv", "label": label},
        "similar_tracks": [
            {"rank": float(i), "artist": f"Artist {i}", "title": f"Track {i}", "label": label}
            for i in range(1, track_count + 1)
        ],
    }


FIXED_NOW = datetime(2026, 8, 5, 12, 0, 0, tzinfo=timezone.utc)


class TestTheFileIsUnchanged:
    def test_ranks_render_as_integers(self):
        """`rank` is a float in the DB. JavaScript printed 1.0 as "1"; Python prints "1.0" unless
        told otherwise, which would alter every line of every export ever produced."""
        out = svc.build_txt(_data(2), now=FIXED_NOW)
        assert "1. Artist 1 - Track 1 [Warp]" in out["content"]
        assert "1.0." not in out["content"]

    def test_playlist_name_is_uppercased(self):
        out = svc.build_txt(_data(1), now=FIXED_NOW)
        assert out["content"].startswith("SONIC JOURNEY\n\n")

    def test_input_track_line(self):
        out = svc.build_txt(_data(1), now=FIXED_NOW)
        assert "INPUT TRACK: Boards of Canada - Roygbiv [Warp]" in out["content"]

    def test_label_is_omitted_when_absent(self):
        """An empty label must not leave an empty bracket pair behind."""
        out = svc.build_txt(_data(1, label=None), now=FIXED_NOW)
        assert "[]" not in out["content"]
        assert "INPUT TRACK: Boards of Canada - Roygbiv\n" in out["content"]

    def test_footer_on_a_complete_export(self):
        out = svc.build_txt(_data(3), now=FIXED_NOW)
        assert out["content"].endswith("\n\nSonic matches provided by Resomix https://resomix.com")
        assert "Showing the first" not in out["content"]

    def test_footer_when_trimmed(self):
        out = svc.build_txt(_data(50), track_limit=20, now=FIXED_NOW)
        assert "Showing the first 20 tracks. Upgrade your plan to export the full list." in out["content"]

    def test_track_order_is_preserved(self):
        content = svc.build_txt(_data(5), now=FIXED_NOW)["content"]
        positions = [content.index(f"{i}. Artist {i}") for i in range(1, 6)]
        assert positions == sorted(positions)


class TestFilename:
    def test_shape(self):
        assert svc.build_filename("Sonic Journey", now=FIXED_NOW) == "sonic_journey_2026-08-05.txt"

    def test_special_characters_are_stripped(self):
        assert svc.build_filename("Sigur Rós — Hoppípolla!", now=FIXED_NOW).startswith("sigur_rs_")

    def test_hyphen_and_underscore_survive(self):
        """The browser's character class kept these; a filename changing shape is a user-visible
        difference even though nothing about the content moved."""
        assert svc.build_filename("late-night_set", now=FIXED_NOW) == "late-night_set_2026-08-05.txt"

    def test_a_name_of_only_symbols_still_produces_a_filename(self):
        """Sanitising to an empty string would yield "_2026-08-05.txt" — a hidden file on macOS
        and Linux, which is a silently broken download rather than a visible failure."""
        assert svc.build_filename("!!!???", now=FIXED_NOW) == "playlist_2026-08-05.txt"

    def test_missing_name_falls_back(self):
        assert svc.build_filename(None, now=FIXED_NOW) == "playlist_2026-08-05.txt"

    def test_the_date_is_utc(self):
        """Matches the browser's `toISOString()`. A local-time stamp would give two people
        different filenames for the same export."""
        just_before_midnight_utc = datetime(2026, 8, 5, 23, 59, tzinfo=timezone.utc)
        assert svc.build_filename("x", now=just_before_midnight_utc).endswith("2026-08-05.txt")


class TestEffectiveTrackLimit:
    def test_the_lowest_ceiling_wins(self):
        assert svc.effective_track_limit(100, 20) == 20
        assert svc.effective_track_limit(20, 100) == 20

    def test_unlocked_count_bounds_the_export(self):
        """This is what `export_scope = "full"` means: export what the user can SEE. A free user
        with a 50-track playlist sees 20 unlocked, so the file holds 20 — otherwise the export
        would hand over the blurred tracks the teaser withholds."""
        assert svc.effective_track_limit(0, 20) == 20

    def test_zero_means_no_cap_from_that_source(self):
        """Historical convention for `export_track_limit`: 0 was "full". It must never be read as
        "export nothing" — `can_export` is what denies, and it is checked earlier."""
        assert svc.effective_track_limit(0, 0) is None

    def test_unlimited_sentinel_means_no_cap(self):
        """-1 is `EntitlementGate.UNLIMITED`. Read as a number it would be the lowest ceiling of
        all and would produce an empty file for exactly the users who paid for the most."""
        assert svc.effective_track_limit(-1, -1) is None
        assert svc.effective_track_limit(-1, 100) == 100

    def test_a_client_request_can_only_lower_the_cap(self):
        assert svc.effective_track_limit(100, 100, 10) == 10

    def test_a_client_request_can_never_raise_it(self):
        """The whole reason a browser-supplied number is safe to accept."""
        assert svc.effective_track_limit(20, 20, 500) == 20

    def test_no_client_request_changes_nothing(self):
        assert svc.effective_track_limit(20, 100, None) == 20


class TestTrimming:
    def test_the_cap_is_applied_to_the_payload(self):
        out = svc.build_txt(_data(50), track_limit=20, now=FIXED_NOW)
        assert out["track_count"] == 20
        assert out["total_tracks"] == 50
        assert out["truncated"] is True

    def test_trimmed_tracks_are_absent_from_the_content(self):
        """Not merely uncounted — the bytes must not be there. The point of moving this server-side
        was that a client-side cap could be edited away."""
        content = svc.build_txt(_data(50), track_limit=20, now=FIXED_NOW)["content"]
        assert "Track 20" in content
        assert "Track 21" not in content

    def test_no_cap_exports_everything(self):
        out = svc.build_txt(_data(50), track_limit=None, now=FIXED_NOW)
        assert out["track_count"] == 50
        assert out["truncated"] is False

    def test_a_cap_above_the_playlist_size_is_not_truncation(self):
        """A Pro user with a 12-track playlist and a cap of 100 must not be told their export was
        trimmed — the notice would be a lie and reads as an upsell."""
        out = svc.build_txt(_data(12), track_limit=100, now=FIXED_NOW)
        assert out["truncated"] is False
        assert "Showing the first" not in out["content"]


class TestDegenerateInput:
    def test_an_empty_playlist_does_not_raise(self):
        out = svc.build_txt({"playlist": {}, "queried_track": {}, "similar_tracks": []}, now=FIXED_NOW)
        assert out["track_count"] == 0
        assert out["truncated"] is False

    def test_missing_sections_do_not_raise(self):
        """`queried_track` is None for a playlist whose seed row was removed. Formatting must not
        be the thing that turns that into a 500."""
        out = svc.build_txt({"playlist": None, "queried_track": None, "similar_tracks": None}, now=FIXED_NOW)
        assert out["content"]


class TestTargetCanonicalisation:
    @pytest.mark.parametrize("spelling", ["apple", "apple_music", "APPLE_MUSIC", " Apple ", "applemusic"])
    def test_apple_spellings_collapse_to_one_target(self, spelling):
        """Production stores "apple" and `useAccess.ts` compares against that literal; the pricing
        spec writes "apple_music". A token recognised on one side but not the other reads to a
        paying user as "not on your plan"."""
        assert svc.canonical_target(spelling) == svc.TARGET_APPLE

    def test_unknown_targets_pass_through_unchanged(self):
        """So the caller can reject them explicitly rather than have them quietly become something
        else — silently mapping an unknown target onto a real one would grant access."""
        assert svc.canonical_target("rekordbox") == "rekordbox"

    def test_empty_target_is_empty(self):
        assert svc.canonical_target(None) == ""
        assert svc.canonical_target("") == ""

    def test_only_txt_is_downloadable(self):
        """Apple and Spotify are transfers with their own endpoints; embed is a link. If one of
        them reached this endpoint it would consume an export and return an empty TXT."""
        assert svc.DOWNLOADABLE_TARGETS == {svc.TARGET_TXT}
