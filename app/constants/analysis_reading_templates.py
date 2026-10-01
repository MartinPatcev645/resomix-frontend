"""
Analysis reading templates — the DJ / producer / curator blurbs
==============================================================

The three sentences under "FOR DJS / FOR PRODUCERS / FOR CURATORS" on the analysis page. One
template per audience is chosen per analysis and filled from that analysis's own measured values.

EDITING THIS FILE
-----------------
This is the only file you need to touch to change the wording. Add, remove or rewrite entries in
``DJ_TEMPLATES`` / ``PRODUCER_TEMPLATES`` / ``CURATOR_TEMPLATES``. There is no second place to keep
in sync:

* **A template's data requirements are read off its own placeholders.** A template that mentions
  ``{drop_start}`` is simply not offered for a track with no drop. You never declare requirements by
  hand, so they can never drift from the text.
* **Any placeholder from the catalogue below may be used**, in any combination. An unknown
  placeholder makes the template permanently ineligible rather than raising at request time; the
  test suite fails on one, so it is caught before it ships.
* **Lists may be any length.** Twenty each is the starting point, not a constraint.

Keep at least a few low-requirement templates per audience (tempo and key only). Tracks that fail
tonal or structural detection can *only* match those, and an audience with none of them renders
nothing at all.

WRITING GUIDANCE
----------------
These sit directly above the disclaimer "No mix points, transitions or compatibility are inferred;
set decisions stay yours." So they **describe what was measured** and stop there. Do not instruct
the reader ("mix out at 3:20", "pair this with…"), do not predict performance, and do not editorialise
about quality. State the value and let the professional decide, which is also the promise made on
the Trust page.

House style: British English, no em-dashes, no exclamation marks, sentence case, two short sentences
at most so the card does not overflow on mobile.

PLACEHOLDER CATALOGUE
---------------------
Every placeholder is pre-formatted for display, so a template never does arithmetic or rounding.
Each is offered only when the underlying analysis actually produced it.

Tempo and key
    {bpm}                 tempo, trimmed of a trailing zero          "122.2" / "128"
    {bpm_confidence_pct}  tempo confidence                           "94%"
    {key_name}            key and scale                              "F# minor"
    {camelot}             Camelot wheel position                     "11A"
    {key_strength_pct}    key detection strength                     "78%"

Loudness
    {lufs}                integrated loudness                        "-14.3"
    {lra}                 loudness range in LU                       "8.2"

Identity
    {duration}            running time                               "6:42"

Semantics (model predictions, not measurements)
    {genre}               top genre, short form                      "House"
    {style}               top style indicator                        "Deep House"
    {danceability_pct}    danceability                               "82%"
    {valence_pct}         valence                                    "64%"
    {arousal_pct}         arousal                                    "71%"
    {voice}               vocal presence                             "instrumental" / "vocal"
    {mood_top}            strongest mood dimension                   "party"

Structure (only for the sections this track actually has)
    {section_count}       number of structural sections              "7"
    {intro_end}           where the intro resolves                   "0:29"
    {build_start}         where the first build begins               "1:12"
    {drop_start}          where the first drop enters                "2:04"
    {drop_end}            where that drop gives way                  "3:18"
    {breakdown_start}     where the first breakdown begins           "4:02"
    {outro_start}         where the outro begins                     "6:10"
    {bass_entry}          where sustained bass enters                "0:31"

Version: 1.0.0
Init Date: August 5, 2026
"""

from __future__ import annotations

from typing import Dict, List

# --------------------------------------------------------------------------------------------
# FOR DJS — reading the record for placement in a set: tempo, key, phrasing, where energy moves.
# --------------------------------------------------------------------------------------------
DJ_TEMPLATES: List[str] = [
    "Structure peaks through the drop from {drop_start} to {drop_end}. Tonal centre {key_name} ({camelot}), steady {bpm} BPM.",
    "{bpm} BPM in {key_name}, Camelot {camelot}. The drop enters at {drop_start} and holds to {drop_end}.",
    "Runs {bpm} BPM in {key_name} ({camelot}) across {duration}. The intro resolves by {intro_end}.",
    "Camelot {camelot} at {bpm} BPM. Energy opens at {drop_start}, and the breakdown from {breakdown_start} resets it.",
    "Reads {genre} at {bpm} BPM in {key_name} ({camelot}). Danceability {danceability_pct}.",
    "Steady {bpm} BPM in {key_name} ({camelot}). Bass enters at {bass_entry} and the main section carries from {drop_start}.",
    "{key_name} ({camelot}) at {bpm} BPM. {section_count} structural sections, with the outro from {outro_start}.",
    "Tempo holds at {bpm} BPM with {bpm_confidence_pct} confidence. Tonal centre {key_name} ({camelot}).",
    "{genre} at {bpm} BPM. Key reads {key_name} ({camelot}) at {key_strength_pct} strength.",
    "The build from {build_start} resolves into the drop at {drop_start}. {bpm} BPM in {key_name} ({camelot}).",
    "Integrated loudness {lufs} LUFS with {lra} LU of range. {bpm} BPM in {key_name} ({camelot}).",
    "{duration} at {bpm} BPM in {key_name} ({camelot}). The energy journey peaks through the drop at {drop_start}.",
    "Camelot {camelot} at {bpm} BPM, {voice}. The arrangement moves through {section_count} sections.",
    "{bpm} BPM in {key_name} ({camelot}). Breakdown at {breakdown_start}, with the drop returning at {drop_start}.",
    "Reads {genre} at {bpm} BPM. Tonal centre {key_name} ({camelot}), arousal {arousal_pct}.",
    "{key_name} ({camelot}) at {bpm} BPM across {duration}. Loudness range {lra} LU.",
    "Tempo {bpm} BPM, Camelot {camelot}. Bass entry at {bass_entry} sets the floor of the first section.",
    "{bpm} BPM in {key_name} ({camelot}). Danceability {danceability_pct}, {voice}.",
    "Tonal centre {key_name} ({camelot}), holding a steady {bpm} BPM.",
    "{genre} at {bpm} BPM in {key_name} ({camelot}). The outro begins at {outro_start}.",
]

# --------------------------------------------------------------------------------------------
# FOR PRODUCERS — reading the record as construction: arrangement, dynamics, texture, loudness.
# --------------------------------------------------------------------------------------------
PRODUCER_TEMPLATES: List[str] = [
    "Integrated loudness {lufs} LUFS with {lra} LU of range. The arrangement moves through {section_count} sections in {key_name}.",
    "{key_name} at {bpm} BPM. Loudness range {lra} LU across {duration}.",
    "Dynamics sit at {lufs} LUFS integrated with {lra} LU of range. The drop enters at {drop_start}.",
    "The arrangement runs {section_count} sections: build from {build_start}, drop at {drop_start}, outro from {outro_start}.",
    "Tonal centre {key_name} ({camelot}) at {bpm} BPM.",
    "Bass enters at {bass_entry}. Loudness range {lra} LU with {lufs} LUFS integrated.",
    "Style indicator {style} at {bpm} BPM. Loudness range {lra} LU.",
    "The breakdown at {breakdown_start} drops energy before the section at {drop_start} returns it.",
    "{duration} in {key_name} at {bpm} BPM. Key strength reads {key_strength_pct}.",
    "Texture reads {genre} at {bpm} BPM. Integrated loudness {lufs} LUFS.",
    "{section_count} sections across {duration}. Tempo {bpm} BPM, key {key_name} ({camelot}).",
    "Loudness range {lra} LU with {lufs} LUFS integrated, {voice}.",
    "The intro resolves by {intro_end} and the arrangement opens from there. {bpm} BPM in {key_name}.",
    "{key_name} ({camelot}) at {bpm} BPM. Danceability {danceability_pct}, arousal {arousal_pct}.",
    "Measured at {bpm} BPM with {bpm_confidence_pct} tempo confidence. Key {key_name} ({camelot}).",
    "{genre} at {lufs} LUFS integrated. The drop carries from {drop_start} to {drop_end}.",
    "The arrangement peaks through the drop at {drop_start}. Loudness range {lra} LU.",
    "{bpm} BPM in {key_name}. Valence {valence_pct}, arousal {arousal_pct}.",
    "Bass entry at {bass_entry}, outro from {outro_start}. {bpm} BPM in {key_name}.",
    "Style indicator {style} across {duration} at {bpm} BPM. Integrated {lufs} LUFS.",
]

# --------------------------------------------------------------------------------------------
# FOR CURATORS — reading the record for a listener: mood, character, pacing, running time.
# --------------------------------------------------------------------------------------------
CURATOR_TEMPLATES: List[str] = [
    "Reads {genre} with {valence_pct} valence and {arousal_pct} arousal, {voice} across {duration}.",
    "Style indicator {style}. Mood reads {mood_top} with danceability {danceability_pct}.",
    "{genre} at {bpm} BPM, {voice}. Valence reads {valence_pct}.",
    "Mood signals read {mood_top} with {arousal_pct} arousal. Running time {duration}.",
    "{duration} of {genre}, {voice}. Danceability {danceability_pct}.",
    "Valence {valence_pct} against {arousal_pct} arousal. Tonal centre {key_name} at {bpm} BPM.",
    "Style indicator {style} across {duration}. Mood reads {mood_top}.",
    "{genre}, {voice}, {bpm} BPM. Energy peaks through the drop at {drop_start}.",
    "Danceability {danceability_pct} with {valence_pct} valence. Style indicator {style}.",
    "A {voice} {genre} record in {key_name}, running {duration}.",
    "Mood reads {mood_top}. {bpm} BPM with {valence_pct} valence.",
    "{genre} at {bpm} BPM across {duration}. Arousal reads {arousal_pct}.",
    "Tonal centre {key_name} ({camelot}), running at {bpm} BPM.",
    "The arrangement moves through {section_count} sections over {duration}. Style indicator {style}.",
    "Valence {valence_pct} against {arousal_pct} arousal, {voice}. {genre} at {bpm} BPM.",
    "Reads {genre} with danceability {danceability_pct}. Running time {duration}.",
    "Mood reads {mood_top} with {valence_pct} valence, {voice}.",
    "{style} at {bpm} BPM across {duration}. Danceability {danceability_pct}.",
    "{genre} in {key_name} ({camelot}) across {duration}. Arousal reads {arousal_pct}.",
    "The breakdown at {breakdown_start} opens space before the energy returns. {genre} at {bpm} BPM.",
]

# The canonical key each audience is emitted under. The frontend also accepts the `dj` / `producers`
# / `curators` spellings, but these are the ones we send.
TEMPLATES_BY_AUDIENCE: Dict[str, List[str]] = {
    "for_dj": DJ_TEMPLATES,
    "for_producers": PRODUCER_TEMPLATES,
    "for_curators": CURATOR_TEMPLATES,
}

# Every placeholder a template is allowed to use. Kept beside the catalogue in this module's
# docstring; the reading service builds exactly these keys and the tests assert the two agree, so a
# typo in a template is a failing test rather than a blank card in production.
KNOWN_PLACEHOLDERS = frozenset(
    {
        "bpm",
        "bpm_confidence_pct",
        "key_name",
        "camelot",
        "key_strength_pct",
        "lufs",
        "lra",
        "duration",
        "genre",
        "style",
        "danceability_pct",
        "valence_pct",
        "arousal_pct",
        "voice",
        "mood_top",
        "section_count",
        "intro_end",
        "build_start",
        "drop_start",
        "drop_end",
        "breakdown_start",
        "outro_start",
        "bass_entry",
    }
)
