"""
Why an account is blocked, said once
====================================

Three places refuse a blocked account: the password login, the Google login, and ``assert_active``
on every authenticated request. They must agree, because they are the same fact reaching the user
through different doors — and the message is not cosmetic.

Once sign-in is blocked, this text is the **only** surface a returning user has. Someone who asked
to delete their account and changed their mind has no way back except by reading it, so telling
them "contact support to restore access" when the answer is "yes, we still have it" — or worse,
implying we can restore something that has already been scrubbed — is the difference between a
recovered customer and a stranded one.

Three states, three answers:

* **pending deletion** — they asked, we have not actioned it. Recoverable, and they must be told so.
* **scrubbed** — actioned. Nothing to restore, and the message must not suggest otherwise.
* **deactivated** — an admin switched it off. A support matter.

See ``docs/ACCOUNT_DELETION_GDPR_OPTIONS.md`` §6.3.
"""

from __future__ import annotations

from typing import Any, Dict

__all__ = ["inactive_account_detail"]

SUPPORT_EMAIL = "support@resomix.com"


def inactive_account_detail(user) -> Dict[str, Any]:
    """The ``{code, error}`` body for a blocked account.

    The **code** is what clients switch on; the prose is written for humans and is expected to
    change. Never branch a UI on the sentence.

    Uses ``getattr`` throughout so a partially-migrated database — one without ``anonymized_at``
    yet — degrades to the generic message instead of raising inside an auth path.
    """
    scrubbed = getattr(user, "anonymized_at", None)
    requested = getattr(user, "deletion_requested_at", None)

    # Order matters: a scrubbed account still carries `deletion_requested_at`, so the terminal
    # state has to be checked first or it would be reported as recoverable.
    if scrubbed:
        return {
            "code": "ACCOUNT_DELETED",
            "error": "This account has been deleted and cannot be restored.",
        }

    if requested:
        return {
            "code": "ACCOUNT_PENDING_DELETION",
            "error": (
                "This account has been closed at your request. If you'd like it back, email "
                f"{SUPPORT_EMAIL} — if we haven't completed the removal yet, we can restore it "
                "exactly as it was."
            ),
        }

    return {
        "code": "ACCOUNT_DEACTIVATED",
        "error": "This account is deactivated. Contact support to restore access.",
    }
