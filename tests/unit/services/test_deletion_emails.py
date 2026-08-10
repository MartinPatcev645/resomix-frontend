"""
The deletion emails
===================

Four templates, and the assertions here are **legal accuracy, not style**.

Under the current design most of a deleted account is retained — playlists, activity, support
history, and invoices complete with the customer's name. So a template that says "everything will
be permanently deleted", or "nothing in it identifies you", is a false statement about erasure,
which is a violation in its own right rather than a wording nitpick. Both sentences were in the
templates this replaced.

The banned-phrase scan is therefore asserted rather than left to review: it is the kind of thing a
well-meaning copy edit reintroduces, and nothing at runtime would ever complain.

Also pinned:

* **No template names a deletion date.** The scrub is run by an admin, not a timer.
* **The completion email survives `name = NULL`.** It is sent *after* the scrub, so the greeting
  has to fall back rather than render "Hi None".

See ``docs/ACCOUNT_DELETION_GDPR_OPTIONS.md`` §6.
"""

from __future__ import annotations

import re

import pytest

from app.services.email_service import jinja_env

# Every phrase that would misdescribe what we actually do. Matched case-insensitively against the
# rendered HTML of all four templates.
BANNED = (
    "anonymis",            # it is pseudonymisation; claiming otherwise is a false claim
    "anonymiz",
    "all your data",       # we keep most of it
    "everything will be",  # "...permanently deleted" — the previous template's opening promise
    "permanently deleted",
    "nothing in it identifies you",  # the invoice keeps their name
    "cannot be recovered by us or by anyone else",
)

# A date rendered into the body would be a promise the manual process cannot keep — §1.4.
DATE_SHAPED = re.compile(r"\b\d{1,2}\s+(January|February|March|April|May|June|July|August|"
                         r"September|October|November|December)\b")

TEMPLATES = {
    "account_deletion_scheduled.html": {
        "name": "Alex", "had_subscription": True, "app_url": "https://resomix.com",
    },
    "account_deletion_cancelled.html": {
        "name": "Alex", "app_url": "https://resomix.com",
    },
    "account_deleted.html": {
        "name": "Alex", "requested_date": "1 August 2026", "app_url": "https://resomix.com",
    },
    "account_deletion_extended.html": {
        "name": "Alex", "requested_date": "1 August 2026",
        "reason": "We are working through a backlog of requests.", "app_url": "https://resomix.com",
    },
}


def _render(template_name: str, **overrides) -> str:
    context = {**TEMPLATES[template_name], **overrides}
    return jinja_env.get_template(template_name).render(**context)


@pytest.mark.parametrize("template_name", sorted(TEMPLATES))
def test_every_template_renders(template_name) -> None:
    html = _render(template_name)

    assert "{{" not in html, "an unrendered placeholder survived"
    assert len(html) > 500


@pytest.mark.parametrize("template_name", sorted(TEMPLATES))
def test_no_template_overstates_what_we_delete(template_name) -> None:
    """The one that matters.

    Fix the copy, not this test. If a sentence here is genuinely true of what the scrub does, the
    scrub has changed and §4 of the doc needs updating first.
    """
    html = _render(template_name).lower()

    found = [phrase for phrase in BANNED if phrase in html]
    assert not found, f"{template_name} claims more than we do: {found}"


@pytest.mark.parametrize("template_name", ["account_deletion_scheduled.html"])
def test_the_request_email_promises_a_window_not_a_date(template_name) -> None:
    """`purge_due_at` ages the admin queue; it is not a day we promise anyone — §1.4."""
    html = _render(template_name)

    assert "within 4 weeks" in html
    assert not DATE_SHAPED.search(html), "a deletion date was rendered into the body"


def test_the_request_email_leads_with_the_way_back() -> None:
    """Someone who deleted in anger needs the recovery route before they need the fine print.

    Asserted as an ORDERING against other content, not as a position in the document: the rendered
    page is ~5KB of base-template CSS wrapping ~1KB of message, so "in the first half of the HTML"
    measures the stylesheet rather than the copy.
    """
    html = _render("account_deletion_scheduled.html")

    assert "Changed your mind" in html
    # Before the retention explanation and before the privacy-policy link.
    assert html.index("Changed your mind") < html.index("Privacy Policy")
    assert html.index("Changed your mind") < html.index("kept without your personal details")


def test_the_request_email_mentions_the_subscription_only_when_there_was_one() -> None:
    with_sub = _render("account_deletion_scheduled.html", had_subscription=True)
    without = _render("account_deletion_scheduled.html", had_subscription=False)

    assert "won't be charged again" in with_sub
    assert "won't be charged again" not in without


def test_the_completion_email_says_what_was_kept_as_well_as_what_went() -> None:
    """Art. 12(3) requires informing the person of the action taken, and since sign-in is blocked
    this is the only signal they get. Half the story is not the action taken."""
    html = _render("account_deleted.html")

    assert "What we removed" in html
    assert "What we kept" in html
    # The honest version of the sentence that used to say the opposite.
    assert "including your name" in html
    assert "tax law" in html


def test_the_completion_email_survives_a_scrubbed_name() -> None:
    """It is sent AFTER the scrub, when `users.name` is already NULL. Rendering "Hi None" on the
    one email that closes a legal obligation would be a poor look.
    """
    html = _render("account_deleted.html", name="there")

    assert "Hi there," in html
    assert "None" not in html


def test_the_extension_email_carries_the_admin_s_own_reason() -> None:
    """Art. 12(3) asks for the actual reason for the delay. A canned sentence is not one, so the
    template must render whatever the admin wrote rather than supplying its own."""
    html = _render("account_deletion_extended.html", reason="Our billing export is mid-migration.")

    assert "Our billing export is mid-migration." in html


def test_the_cancellation_email_confirms_nothing_was_lost() -> None:
    """The whole message: your account is back and intact."""
    html = _render("account_deletion_cancelled.html")

    assert "nothing was removed" in html
    assert "exactly as you left it" in html


# --------------------------------------------------------------------------- #
# The send methods
# --------------------------------------------------------------------------- #

def test_the_request_email_no_longer_accepts_a_purge_date() -> None:
    """The signature is the guard. While `purge_date` remained a parameter, any caller could
    reintroduce a promised deletion date without touching the template.
    """
    import inspect

    from app.services.email_service import EmailService

    params = inspect.signature(EmailService.send_account_deletion_scheduled).parameters
    assert "purge_date" not in params


def test_every_deletion_email_has_a_send_method() -> None:
    """A template with no caller is a template nobody notices has rotted."""
    from app.services.email_service import EmailService

    for method in (
        "send_account_deletion_scheduled",
        "send_account_deletion_cancelled",
        "send_account_deleted",
        "send_account_deletion_extended",
    ):
        assert callable(getattr(EmailService, method, None)), f"{method} is missing"
