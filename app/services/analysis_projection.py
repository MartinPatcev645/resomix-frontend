"""
Analysis result projection — summary card vs full Track Intelligence
====================================================================

``can_view_full_analysis`` is a **page boundary**, not a feature count (pricing v2.1 §1.6). Everyone
who uploads gets the whole summary card; the full Track Intelligence dashboard is Pro.

The card and the dashboard are served by the *same* endpoint (``GET /analysis/{id}/result``) and the
frontend builds both from that one payload. So the gate cannot be "allow or refuse the request" —
refusing it would take the card away from the free user who is entitled to it. It has to be a
**projection**: same endpoint, fewer fields.

WHY AN ALLOW-LIST AND NOT A DENY-LIST
-------------------------------------
The canonical result is produced by a service we do not deploy in lockstep with this one. With a
deny-list, every field it adds later is served to everyone until somebody notices — the failure is
silent and open. With an allow-list, a new field is withheld until someone deliberately adds it, and
the failure is a missing value someone reports. Deny-by-default is the only direction that stays
correct without maintenance.

WHAT THE CARD GETS (and why each one)
-------------------------------------
Read off ``AnalysisSummaryCard.tsx``, field by field — not guessed:

    identity   file facts (name, duration, sample rate, bit rate, channels, codec)
    technical  integrated LUFS + loudness range — the two the card prints
    rhythm     bpm + confidence
    tonality   key / scale / camelot / strength
    energy     the energy-journey curve + the v1 section map
    semantics  genre, style, mood dimensions, danceability, valence, arousal, voice
    readings   the DJ / producer / curator blurbs
    structure  the section map the card draws as a table: every section with the
               word shown for it, its bars and times, and the one-line summary
    structure_v2  DEPRECATED. No longer produced; kept so results persisted
                  while it existed still render their tempo display decision

WHAT IT DOES NOT GET
--------------------
Everything that makes the dashboard a dashboard: spectrograms and spectral curves, the chromagram
and tuning detail, beat / downbeat / phrase / onset arrays, the loudness and RMS curves, the
over-time timelines, and stem composition. Withheld in the **payload** — never sent and hidden with
CSS, which is not withholding at all.

Version: 1.0.0
Init Date: August 5, 2026
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, Optional

from app.utils.public_names import scrub_text

# Per-section allow-lists, keyed by the canonical (snake_case) names the analysis service emits.
SUMMARY_FIELDS: Dict[str, frozenset] = {
    "identity": frozenset(
        {"input_filename", "duration_ms", "sample_rate_hz", "bit_rate", "channel_count", "codec"}
    ),
    # Deliberately NOT loudness_curve / rms_energy_curve / true_peak_dbtp / crest_factor /
    # average_loudness_db — those are dashboard panels.
    "technical": frozenset({"integrated_loudness_lufs", "loudness_range_lu"}),
    # Deliberately NOT beat_times_seconds / downbeats_seconds / phrase_boundaries_seconds.
    "rhythm": frozenset({"bpm", "confidence", "bar_count"}),
    # Deliberately NOT chromagram / mean_chroma / tuning_* / alt_camelot / key_margin.
    "tonality": frozenset({"key", "scale", "strength", "camelot", "ambiguous"}),
    # The energy journey and the section map are ON the card. onset_times_seconds is not.
    "energy": frozenset({"energy_curve", "structure_segments", "bass_entry_ms"}),
    # Deliberately NOT mood_theme_top / instrument_top / approachability / timbre_* /
    # mood_acoustic / mood_electronic.
    "semantics": frozenset(
        {
            "genre_top",
            "style_maest_top",
            "mood_dimensions",
            "danceability",
            "voice_instrumental",
            "voice_score",
            "valence",
            "arousal",
        }
    ),
    # The persona blurb. Aliases included because the service has emitted all three spellings.
    "readings": frozenset(
        {"for_dj", "dj", "for_djs", "for_producers", "producers", "for_producer",
         "for_curators", "curators", "for_curator"}
    ),
    # The section map the card draws. `status` / `gate` cover a track with no beat
    # grid, which gets a sentence instead of sections. Deliberately NOT
    # `family_detail` (the genre routing's raw numbers, kept to calibrate its
    # thresholds, the same reason `beat_support` is withheld below),
    # `routed_family`, or how the structure pass was run (see public_analysis below).
    "structure": frozenset(
        {"status", "gate", "sections", "summary", "family", "vocabulary", "family_reason"}
    ),
    # DEPRECATED: no longer produced. Kept so results persisted while it existed
    # keep their tempo display decision. `beat_support` is deliberately absent:
    # it is the rhythm-gate scorecard kept for threshold calibration.
    "structure_v2": frozenset(
        {"version", "profile", "grid", "bpm_display", "flags", "segments", "error"}
    ),
}

# Sections withheld ENTIRELY from a locked caller. Named explicitly so the intent is greppable —
# the allow-list above would drop them anyway, but a reader should not have to infer that.
FULL_ONLY_SECTIONS = frozenset({"spectral", "timeline", "composition"})

# Non-analysis plumbing the client needs whatever its plan: job state, progress, and the playback
# ids. None of it is intelligence, and dropping it would break polling for free users.
PASSTHROUGH_KEYS = frozenset(
    {
        "state",
        "status",
        "status_code",
        "part1_ready",
        "progress",
        "error",
        "message",
        "analysis_id",
        "id",
        "version",
        "created_at",
        "completed_at",
        "track_uuid",
        "playlist_uuid",
        "sibling_playlist_state",
    }
)

# Set on a projected payload so the client can render the upgrade CTA instead of empty charts.
LOCK_FLAG = "full_analysis_locked"


def _pick(section: Any, allowed: Iterable[str]) -> Optional[Dict[str, Any]]:
    """Copy only the allowed keys out of one section."""
    if not isinstance(section, dict):
        return None
    kept = {k: v for k, v in section.items() if k in allowed}
    return kept or None


def project_summary(result: Any, *, upgrade: str = "pro") -> Any:
    """Reduce a canonical analysis result to what the summary card renders.

    Non-dict input is returned untouched: an error envelope or a bare string is not a result, and
    mangling it here would turn a clear upstream failure into a confusing empty one.
    """
    if not isinstance(result, dict):
        return result

    projected: Dict[str, Any] = {}

    for key in PASSTHROUGH_KEYS:
        if key in result:
            projected[key] = result[key]

    for section, allowed in SUMMARY_FIELDS.items():
        kept = _pick(result.get(section), allowed)
        if kept is not None:
            projected[section] = kept

    projected[LOCK_FLAG] = True
    projected["upgrade"] = upgrade
    return projected


# --------------------------------------------------------------------------- #
# Public view: what any caller may see of HOW a result was made
# --------------------------------------------------------------------------- #

# The analysis service records how it produced a result (library versions, per-stage timings and
# errors, process memory, which model ran the structure pass and on what hardware). That is for
# debugging the service and says a lot about how it is built. A caller gets when it ran and which
# schema it follows, nothing more.
_PROVENANCE_PUBLIC = frozenset(
    {"schema_version", "service_version", "started_epoch", "completed_epoch", "elapsed_seconds"}
)
_IDENTITY_PRIVATE = frozenset({"discogs_embedding_dim", "maest_embedding_dim", "embeddings_source"})
_STRUCTURE_PRIVATE = frozenset({"model", "attention_backend", "device"})


def public_analysis(result: Any) -> Any:
    """Strip a result of everything that describes how it was produced, for ANY caller.

    Runs on every plan, after the summary projection. Field names that carry an internal model
    name are renamed to their public spelling here as well (``semantics.style_top``), so the
    response does not depend on the middleware net in ``app/utils/public_names.py`` for its shape.
    """
    if not isinstance(result, dict):
        return result
    out = dict(result)

    provenance = out.get("provenance")
    if isinstance(provenance, dict):
        out["provenance"] = {k: v for k, v in provenance.items() if k in _PROVENANCE_PUBLIC}

    identity = out.get("identity")
    if isinstance(identity, dict):
        out["identity"] = {k: v for k, v in identity.items() if k not in _IDENTITY_PRIVATE}

    structure = out.get("structure")
    if isinstance(structure, dict):
        out["structure"] = {k: v for k, v in structure.items() if k not in _STRUCTURE_PRIVATE}

    semantics = out.get("semantics")
    if isinstance(semantics, dict) and "style_maest_top" in semantics:
        semantics = dict(semantics)
        semantics["style_top"] = semantics.pop("style_maest_top")
        out["semantics"] = semantics

    # Upstream error text is the analysis service's own wording and can name what failed inside it.
    for key in ("error", "message"):
        if isinstance(out.get(key), str):
            out[key] = scrub_text(out[key], everything=True)

    return out
