"""
Quota / entitlement denial responses
====================================

One place that turns a denied ``GateResult`` into an HTTP response, so every gated endpoint answers
in the same shape and the frontend can switch on a single field.

WHY 402 AND NOT 403
-------------------
403 means "you may not do this". A quota denial means "you may, but not right now / not on this
plan" — the request is well-formed and the caller is authenticated. 402 Payment Required is the
closest honest code and lets the frontend distinguish an upsell from a permission error without
parsing prose. 429 stays reserved for rate limiting: 402 = "you've used your allowance",
429 = "you're going too fast". Two different things to say to a user.

WHY BOTH `error` AND `code`
---------------------------
The spec asks for ``"error": "quota_exceeded"``. This codebase already puts a **human sentence** in
``error`` and the frontend renders it directly (``apiError.error`` becomes ``errorMessage`` in
``packages/api-client/src/utils.ts``). Moving a machine code into that field would literally show
users the words "quota_exceeded".

So both are sent: ``error`` keeps the sentence, ``code`` carries the machine value the spec wants,
and ``reason`` keeps the existing ``login_required`` / ``upgrade_required`` that ``useAccess`` and
``GateCtaModal`` already understand. Nothing that works today breaks; the frontend switches on
``code`` when it is ready to.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import status
from fastapi.responses import JSONResponse

from app.services.entitlement_gate import GateResult
from app.utils.response_utils import format_response

# Machine codes. The frontend picks its modal from these — never from the prose.
QUOTA_EXCEEDED = "quota_exceeded"            # daily search / monthly upload allowance spent
LIBRARY_FULL = "library_full"                # Library listing cap reached
EXPORT_LIMIT_REACHED = "export_limit_reached"  # exports_per_day spent
PLAN_REQUIRED = "plan_required"              # the capability is not on this plan at all
LOGIN_REQUIRED = "login_required"            # guest hit a signed-in-only capability


def iso_utc(dt: Optional[datetime]) -> Optional[str]:
    """Absolute ISO-8601 with an explicit offset. Shared with ``/entitlements/me``'s ``resets``.

    The window is computed in naive UTC to match the DB columns, so the tz is attached here. It
    matters: the client renders this in the visitor's local time, and a timestamp with no offset
    would be read as local and show the wrong reset hour.
    """
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc).isoformat() if dt.tzinfo is None else dt.isoformat()


def quota_denied_response(
    gate: GateResult,
    *,
    code: str = QUOTA_EXCEEDED,
    message: str,
    upgrade: Optional[str] = "pro",
    status_code: int = status.HTTP_402_PAYMENT_REQUIRED,
) -> JSONResponse:
    """Build the standard denial response from a denied ``GateResult``.

    ``gate`` supplies metric / used / limit / resets_at, which the gate already computed while
    deciding — recomputing them here could disagree across a period boundary.
    """
    data: Dict[str, Any] = {
        "metric": gate.metric,
        "used": gate.count,
        "limit": gate.limit,
        "resets_at": iso_utc(gate.resets_at),
        "upgrade": upgrade,
    }
    return JSONResponse(
        status_code=status_code,
        content=format_response(
            success=False,
            data=data,
            error=message,        # human sentence — the frontend renders this today
            code=code,            # machine value — what new frontend code switches on
            reason=gate.reason,   # login_required | upgrade_required — existing consumers
        ),
    )


def plan_required_response(
    gate: GateResult, *, message: str, upgrade: Optional[str] = "pro"
) -> JSONResponse:
    """Capability is not on this plan at all (embed export, full analysis).

    Distinct from a spent allowance: waiting will not help, so the copy must offer an upgrade
    rather than a reset time.
    """
    return quota_denied_response(gate, code=PLAN_REQUIRED, message=message, upgrade=upgrade)
