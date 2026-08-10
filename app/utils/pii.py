"""
Keeping personal data out of the logs
=====================================

WHY THIS EXISTS

``system_logs`` had the user's raw email address written into it from 24 places — login,
registration, verification, password reset, every outbound mail. Three things made that worse than
it sounds:

* the table has **no ``user_id`` column**, so those rows cannot be reached by any foreign key,
  cascade, or account-scoped scrub;
* there was **no retention job**, so they lived forever;
* which means that after a perfectly executed account deletion, a single
  ``... WHERE message LIKE '%their@email%'`` handed the identity straight back.

THE TWO REPLACEMENTS

Which one to use depends only on whether a ``User`` is in scope at the call site:

* **We have the user** → log ``user_uuid``. It is already the correlation key everywhere else, it
  is just as useful for debugging, and it survives the account scrub — so a log line from 2024
  still joins to the account in 2026 without naming anybody.
* **We only have an address** — a password reset for an account that may not exist, an SMTP
  failure inside ``EmailService`` — → :func:`mask_email`. There is no uuid to reach for, and
  dropping the field entirely would make delivery problems undiagnosable.

WHAT MASKING IS AND IS NOT

``mask_email`` keeps the domain and the first character. That is enough to answer the questions
logs are actually asked — *is this whole domain bouncing? is our provider rejecting us? are these
two failures the same user or two different ones?* — while removing the part that identifies a
person on sight.

It is a **reduction, not anonymisation**. A masked address plus a timestamp could still narrow to
one person. That is acceptable precisely because it is paired with the 90-day retention job in
``scripts/prune_system_logs.py``: short-lived and heavily reduced, rather than permanent and exact.
"""

from __future__ import annotations

from typing import Optional

__all__ = ["mask_email", "safe_user_ref"]


def mask_email(value: Optional[str]) -> Optional[str]:
    """``usman.naeem@gmail.com`` → ``u***@gmail.com``.

    Preserves the domain, which is what delivery debugging needs, and the first character, which is
    usually enough to tell two concurrent failures apart in a log.

    Passes through ``None`` so call sites can hand it an optional field without a guard. Anything
    that is not a recognisable address is reported as ``"<invalid>"`` rather than echoed back —
    a malformed value is exactly the kind of thing that turns out to be a whole raw payload.
    """
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    local, sep, domain = text.rpartition("@")
    # `rpartition` puts everything in `domain` when there is no separator, so an address is only
    # well-formed if we got a separator AND both halves are non-empty.
    if not sep or not local or not domain:
        return "<invalid>"

    return f"{local[0]}***@{domain}"


def safe_user_ref(user) -> Optional[str]:
    """The uuid of a user, for logs, without assuming one was passed.

    Call sites hand this whatever they have — a ``User``, ``None``, occasionally a dict from a
    service response. Returning ``None`` rather than raising matters: a logging call must never be
    the thing that fails a request.
    """
    if user is None:
        return None
    if isinstance(user, dict):
        return user.get("uuid")
    return getattr(user, "uuid", None)
