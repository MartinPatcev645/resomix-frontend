"""
Ingestion pipeline v2 — stage lifecycle helpers
===============================================

The fine-grained lifecycle of one batch (one ``.done``). ``IngestLog.stage`` holds
the current value; ``IngestLog.stage_timeline`` is a ``{stage: utc_iso}`` map that
is mirrored verbatim into the partner-visible ``processing/<dt>/logs.json``.

These are pure helpers (no DB session, no I/O) — the caller mutates the in-memory
``IngestLog`` and commits. UTC, always.

See ``docs/ingestion_pipeline_v2_plan.md`` (§3 state machine, D7).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional


class Stage:
    """Canonical stage names (plain strings — adding one needs no migration)."""
    RECEIVED = "RECEIVED"
    VALIDATING = "VALIDATING"
    MOVED = "MOVED"
    TRANSCODING = "TRANSCODING"
    INGESTED = "INGESTED"
    EMBEDDING = "EMBEDDING"
    INDEXED = "INDEXED"
    FINALIZING = "FINALIZING"
    READY = "READY"
    # Terminal failure variants.
    FAILED_VALIDATION = "FAILED_VALIDATION"
    FAILED = "FAILED"


# Ordered happy-path stages (for display / progress %).
ORDERED_STAGES = (
    Stage.RECEIVED, Stage.VALIDATING, Stage.MOVED, Stage.TRANSCODING,
    Stage.INGESTED, Stage.EMBEDDING, Stage.INDEXED, Stage.FINALIZING, Stage.READY,
)

# A batch in any of these is "done" — the partner may start a new one.
TERMINAL_STAGES = frozenset({Stage.READY, Stage.FAILED_VALIDATION, Stage.FAILED})

# A batch in any of these is "active" — blocks a new .done for that partner.
ACTIVE_STAGES = tuple(s for s in (
    Stage.RECEIVED, Stage.VALIDATING, Stage.MOVED, Stage.TRANSCODING,
    Stage.INGESTED, Stage.EMBEDDING, Stage.INDEXED, Stage.FINALIZING,
))


def utc_now_iso() -> str:
    """Timezone-aware UTC ISO-8601 timestamp (e.g. ``2026-06-19T14:05:11.123456+00:00``)."""
    return datetime.now(timezone.utc).isoformat()


def advance_stage(log, stage: str, *, at: Optional[str] = None) -> Dict[str, str]:
    """Set ``log.stage`` and stamp ``stage_timeline[stage]`` with a UTC timestamp.

    Reassigns a *new* dict so SQLAlchemy flags the JSON column dirty (in-place
    mutation of a JSON column is not reliably detected). The caller commits.
    Returns the updated timeline.
    """
    timeline: Dict[str, str] = dict(log.stage_timeline or {})
    timeline[stage] = at or utc_now_iso()
    log.stage = stage
    log.stage_timeline = timeline
    return timeline


def is_terminal(stage: Optional[str]) -> bool:
    return stage in TERMINAL_STAGES


def sanitized_logs_json(log) -> Dict[str, Any]:
    """Partner-safe snapshot for ``processing/<dt>/logs.json``.

    Deliberately omits internal paths, hostnames, stack traces, and DB ids — those
    live in ``ingest_logs`` / ``IngestionError``. Only the batch identity, the
    coarse status, and the UTC stage timeline are exposed.
    """
    return {
        "batch": log.batch_filename,
        "status": log.status,
        "stage": log.stage,
        "track_count": log.track_count,
        "stages_utc": dict(log.stage_timeline or {}),
        "generated_at": utc_now_iso(),
    }
