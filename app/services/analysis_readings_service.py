"""
Analysis readings — build the DJ / producer / curator blurbs from a canonical result
====================================================================================

The analysis page shows one sentence per audience under "FOR DJS / FOR PRODUCERS / FOR CURATORS".
Until now the frontend assembled that text itself from a single hardcoded sentence per audience, so
every track in the product read identically apart from the numbers. This module moves the wording
server-side, where it belongs: the copy lives in one editable file
(``app/constants/analysis_reading_templates.py``), and each analysis gets one of many phrasings.

HOW A READING IS CHOSEN
-----------------------
1. Flatten the canonical result into display-ready facts (:func:`extract_facts`). A fact is only
   present if the analysis actually produced it, so a track whose key detection failed simply has no
   ``key_name``.
2. Keep the templates whose placeholders are *all* satisfied by those facts. A template mentioning
   ``{drop_start}`` is never offered for a track with no drop, which is why templates declare their
   own requirements just by being written.
3. Pick one of the survivors and format it.

WHY THE CHOICE IS SEEDED, NOT RANDOM
------------------------------------
``GET /analysis/{id}/result`` is **polled** while a job runs, and re-read whenever the user reopens
the analysis. A fresh ``random.choice`` per request would rewrite the sentence under the reader every
few seconds and give a shared link different text for each visitor. So the pick is seeded with the
analysis id: varied *across* analyses, fixed *for* one. Same analysis, same sentence, forever.

WHAT THIS DOES NOT DO
---------------------
It never overwrites readings the analysis service itself supplied. That service owns the canonical
result; if a future version emits its own ``readings``, that wins and this module steps aside.

Version: 1.0.0
Init Date: August 5, 2026
"""

from __future__ import annotations

import hashlib
import logging
import random
from string import Formatter
from typing import Any, Dict, List, Optional

from app.constants.analysis_reading_templates import TEMPLATES_BY_AUDIENCE

logger = logging.getLogger(__name__)

_FORMATTER = Formatter()

# Section labels the structure detector emits (see resomix-analysis-service/app/utils/structure.py):
# intro, build, drop, main, breakdown, section, outro.
_DROP_LABELS = ("drop",)


def _clock(ms: Any) -> Optional[str]:
    """Milliseconds to m:ss. ``None`` for anything not a usable number."""
    if not isinstance(ms, (int, float)) or ms < 0:
        return None
    total = int(round(ms / 1000))
    return f"{total // 60}:{total % 60:02d}"


def _pct(value: Any) -> Optional[str]:
    """A 0..1 score as a whole percentage. Values outside that range are treated as unusable."""
    if not isinstance(value, (int, float)):
        return None
    if not 0.0 <= value <= 1.0:
        return None
    return f"{round(value * 100)}%"


def _decimal(value: Any, places: int = 1) -> Optional[str]:
    if not isinstance(value, (int, float)):
        return None
    return f"{value:.{places}f}"


def _tempo(value: Any) -> Optional[str]:
    """Tempo without a pointless trailing zero: 128 stays 128, 122.2 keeps its tenth."""
    if not isinstance(value, (int, float)) or value <= 0:
        return None
    return str(int(value)) if float(value).is_integer() else f"{value:.1f}"


def _short_genre(label: Any) -> Optional[str]:
    """Discogs labels arrive as "Electronic---House"; the leaf is the readable part.

    Mirrors ``shortGenre`` in packages/hooks, so the sentence and the genre chip beside it never
    disagree.
    """
    if not isinstance(label, str) or not label.strip():
        return None
    return label.split("---")[-1].strip() or None


def _first_label(items: Any) -> Optional[str]:
    if not isinstance(items, list) or not items:
        return None
    head = items[0]
    if isinstance(head, dict):
        return _short_genre(head.get("label"))
    return None


def _key_name(tonality: Dict[str, Any]) -> Optional[str]:
    """"F#" + "minor" -> "F# minor". Needs both halves; a bare key is not a tonal centre."""
    key = tonality.get("key")
    scale = tonality.get("scale")
    if not isinstance(key, str) or not key.strip():
        return None
    if not isinstance(scale, str) or not scale.strip():
        return None
    return f"{key.strip()} {scale.strip().lower()}"


def _voice(semantics: Dict[str, Any]) -> Optional[str]:
    raw = semantics.get("voice_instrumental")
    if not isinstance(raw, str) or not raw.strip():
        return None
    return "instrumental" if raw.strip().lower() == "instrumental" else "vocal"


def _mood_top(semantics: Dict[str, Any]) -> Optional[str]:
    """The strongest of the five two-class mood scores."""
    dims = semantics.get("mood_dimensions")
    if not isinstance(dims, dict):
        return None
    scored = [(k, v) for k, v in dims.items() if isinstance(v, (int, float))]
    if not scored:
        return None
    return max(scored, key=lambda kv: kv[1])[0]


def _structure_facts(energy: Dict[str, Any]) -> Dict[str, str]:
    """Timestamps for the sections this track actually has.

    Only the *first* occurrence of each label is offered. A template says "the drop enters at X",
    and with several drops the first one is the honest answer to that sentence.
    """
    facts: Dict[str, str] = {}
    segments = energy.get("structure_segments")
    if not isinstance(segments, list) or not segments:
        return facts

    valid = [s for s in segments if isinstance(s, dict) and isinstance(s.get("label"), str)]
    if not valid:
        return facts

    facts["section_count"] = str(len(valid))

    def first(*labels: str) -> Optional[Dict[str, Any]]:
        for seg in valid:
            if seg.get("label", "").lower() in labels:
                return seg
        return None

    intro = first("intro")
    if intro and (end := _clock(intro.get("end_ms"))):
        facts["intro_end"] = end

    build = first("build")
    if build and (start := _clock(build.get("start_ms"))):
        facts["build_start"] = start

    drop = first(*_DROP_LABELS)
    if drop:
        if start := _clock(drop.get("start_ms")):
            facts["drop_start"] = start
        if end := _clock(drop.get("end_ms")):
            facts["drop_end"] = end

    breakdown = first("breakdown")
    if breakdown and (start := _clock(breakdown.get("start_ms"))):
        facts["breakdown_start"] = start

    outro = first("outro")
    if outro and (start := _clock(outro.get("start_ms"))):
        facts["outro_start"] = start

    return facts


def _section(result: Dict[str, Any], name: str) -> Dict[str, Any]:
    value = result.get(name)
    return value if isinstance(value, dict) else {}


def extract_facts(result: Dict[str, Any]) -> Dict[str, str]:
    """Canonical result -> display-ready placeholder values.

    Only keys the analysis genuinely produced are returned; a missing value is an absent key, never
    an "N/A" string. That is what lets template eligibility be decided by simple key presence.
    """
    if not isinstance(result, dict):
        return {}

    identity = _section(result, "identity")
    technical = _section(result, "technical")
    rhythm = _section(result, "rhythm")
    tonality = _section(result, "tonality")
    energy = _section(result, "energy")
    semantics = _section(result, "semantics")

    candidates: Dict[str, Optional[str]] = {
        "bpm": _tempo(rhythm.get("bpm")),
        "bpm_confidence_pct": _pct(rhythm.get("confidence")),
        "key_name": _key_name(tonality),
        "camelot": tonality.get("camelot") if isinstance(tonality.get("camelot"), str) else None,
        "key_strength_pct": _pct(tonality.get("strength")),
        "lufs": _decimal(technical.get("integrated_loudness_lufs")),
        "lra": _decimal(technical.get("loudness_range_lu")),
        "duration": _clock(identity.get("duration_ms")),
        "genre": _first_label(semantics.get("genre_top")),
        "style": _first_label(semantics.get("style_maest_top")),
        "danceability_pct": _pct(semantics.get("danceability")),
        "valence_pct": _pct(semantics.get("valence")),
        "arousal_pct": _pct(semantics.get("arousal")),
        "voice": _voice(semantics),
        "mood_top": _mood_top(semantics),
        "bass_entry": _clock(energy.get("bass_entry_ms")),
    }

    facts = {k: v for k, v in candidates.items() if v}
    facts.update(_structure_facts(energy))
    return facts


def _placeholders(template: str) -> List[str]:
    """The field names a template needs, read straight off its own text."""
    return [name for _, name, _, _ in _FORMATTER.parse(template) if name]


def _choose(templates: List[str], facts: Dict[str, str], seed: str, audience: str) -> str:
    """Pick one template every one of whose placeholders is satisfied, and fill it.

    Seeded by ``analysis_id`` + audience so the three sentences vary independently while each stays
    fixed for the life of the analysis.
    """
    eligible = [t for t in templates if all(name in facts for name in _placeholders(t))]
    if not eligible:
        # Not an error: a track that failed tempo, key, loudness AND structure detection has nothing
        # to say. The frontend still renders its own fallback line from whatever it has.
        logger.info("analysis readings: no eligible %s template (facts=%s)", audience, sorted(facts))
        return ""

    digest = hashlib.sha256(f"{seed}:{audience}".encode("utf-8")).hexdigest()
    picked = eligible[random.Random(digest).randrange(len(eligible))]
    try:
        return picked.format(**facts)
    except (KeyError, IndexError, ValueError):
        # Unreachable via eligibility, but a malformed template must never break the result payload.
        logger.warning("analysis readings: %s template failed to format: %r", audience, picked)
        return ""


def build_readings(result: Any, analysis_id: str) -> Dict[str, str]:
    """The three blurbs for one analysis. Audiences with nothing to say are omitted."""
    facts = extract_facts(result)
    if not facts:
        return {}
    readings = {
        audience: _choose(templates, facts, analysis_id, audience)
        for audience, templates in TEMPLATES_BY_AUDIENCE.items()
    }
    return {k: v for k, v in readings.items() if v}


def attach_readings(result: Any, analysis_id: str) -> Any:
    """Add ``readings`` to a canonical result, in place, and return it.

    Left untouched when the payload is not a result dict (an error envelope), when the analysis
    service already supplied its own readings, or when this track yielded no usable facts.
    """
    if not isinstance(result, dict):
        return result

    existing = result.get("readings")
    if isinstance(existing, dict) and any(
        isinstance(v, str) and v.strip() for v in existing.values()
    ):
        return result

    readings = build_readings(result, analysis_id)
    if readings:
        result["readings"] = readings
    return result
