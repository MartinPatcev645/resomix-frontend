"""
Personal data must not reach `system_logs`
==========================================

Two things are tested here, and the second is the one that matters in a year's time.

1. :func:`mask_email` reduces an address to something still useful for debugging.
2. **No logging call site anywhere in ``app/`` passes a raw email.** This is a source scan, not a
   behavioural test, and it exists because the failure it guards against is invisible at runtime:
   a new ``logger``/``logging_service.log`` call with ``metadata={"email": user.email}`` works
   perfectly, ships, and quietly reintroduces the exact problem that made an account scrub
   defeatable by ``SELECT ... WHERE message LIKE '%their@email%'``.

The scan is deliberately AST-based rather than a grep. A regex over source cannot tell an API
response payload (``format_response(data={"email": user.email})`` — legitimate, the frontend needs
it) from a log payload (``metadata={"email": user.email}`` — not legitimate), and a test that
cannot make that distinction would either miss real regressions or cry wolf until someone deletes
it.

See ``docs/ACCOUNT_DELETION_GDPR_OPTIONS.md`` §5.
"""

from __future__ import annotations

import ast
import pathlib

import pytest

from app.utils.pii import mask_email, safe_user_ref

APP_ROOT = pathlib.Path(__file__).resolve().parents[3] / "app"


# --------------------------------------------------------------------------- #
# mask_email
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize(
    "raw, expected",
    [
        ("usman.naeem2212@gmail.com", "u***@gmail.com"),
        ("a@b.co", "a***@b.co"),
        ("  Spaced@Example.COM  ", "S***@Example.COM"),
        # A '+' alias must not leak the tag it was aliased with.
        ("someone+resomix-signup@gmail.com", "s***@gmail.com"),
    ],
)
def test_masking_keeps_the_domain_and_drops_the_person(raw, expected) -> None:
    """The domain is what delivery debugging needs; the local part is what identifies someone."""
    assert mask_email(raw) == expected


def test_masking_passes_none_through() -> None:
    """Call sites hand this optional fields directly — a guard at every one of them would be
    forgotten at exactly one."""
    assert mask_email(None) is None
    assert mask_email("") is None
    assert mask_email("   ") is None


@pytest.mark.parametrize("junk", ["not-an-address", "@nodomain.com", "nolocal@", "@"])
def test_malformed_input_is_reported_not_echoed(junk) -> None:
    """Echoing an unrecognised value back into the log is how a whole raw payload ends up there.

    Whatever this was, it was not an address, and saying so is more useful than repeating it.
    """
    assert mask_email(junk) == "<invalid>"


def test_masking_is_not_reversible_to_the_local_part() -> None:
    """A reduction, not a hash: two addresses on the same domain sharing a first letter collide,
    which is the point. If this ever became injective it would stop being a reduction at all."""
    assert mask_email("alice@x.com") == mask_email("anne@x.com")


def test_user_ref_survives_whatever_a_call_site_has() -> None:
    """A logging helper must never be the reason a request fails, so every shape returns something
    rather than raising."""
    class _U:
        uuid = "abc-123"

    assert safe_user_ref(_U()) == "abc-123"
    assert safe_user_ref({"uuid": "def-456"}) == "def-456"
    assert safe_user_ref(None) is None
    assert safe_user_ref(object()) is None  # no uuid attribute at all


# --------------------------------------------------------------------------- #
# The source scan
# --------------------------------------------------------------------------- #

def _python_files():
    return [p for p in APP_ROOT.rglob("*.py") if "__pycache__" not in p.parts]


def _is_masked(node: ast.AST) -> bool:
    """True when the value is wrapped in `mask_email(...)`."""
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    name = func.id if isinstance(func, ast.Name) else getattr(func, "attr", None)
    return name == "mask_email"


def _mentions_email(node: ast.AST) -> bool:
    """True when the expression reads an `email` attribute or key off something."""
    for sub in ast.walk(node):
        if isinstance(sub, ast.Attribute) and sub.attr == "email":
            return True
        if isinstance(sub, ast.Subscript):
            key = sub.slice
            if isinstance(key, ast.Constant) and key.value == "email":
                return True
        # A bare `email` local — the parameter name used throughout the auth flows.
        if isinstance(sub, ast.Name) and sub.id == "email":
            return True
    return False


def _log_payload_violations():
    """Every `metadata=` dict and `message=` string in `app/` that carries an unmasked email.

    Only these two keyword arguments are inspected. That is the whole point: `data=`, `content=`
    and `context=` payloads legitimately carry the address, because they are what we send to the
    user or return to the frontend.
    """
    violations = []
    for path in _python_files():
        try:
            tree = ast.parse(path.read_text())
        except SyntaxError:  # pragma: no cover — a broken file fails louder elsewhere
            continue

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            for kw in node.keywords:
                if kw.arg == "metadata" and isinstance(kw.value, ast.Dict):
                    for key, value in zip(kw.value.keys, kw.value.values):
                        if (
                            isinstance(key, ast.Constant)
                            and key.value == "email"
                            and not _is_masked(value)
                        ):
                            violations.append(
                                f"{path.relative_to(APP_ROOT.parent)}:{key.lineno} "
                                f"metadata={{'email': ...}} is not masked"
                            )
                elif kw.arg == "message" and isinstance(kw.value, ast.JoinedStr):
                    for piece in kw.value.values:
                        if (
                            isinstance(piece, ast.FormattedValue)
                            and _mentions_email(piece.value)
                            and not _is_masked(piece.value)
                        ):
                            violations.append(
                                f"{path.relative_to(APP_ROOT.parent)}:{kw.value.lineno} "
                                f"message=f'...' interpolates an unmasked email"
                            )
    return violations


def test_no_logging_call_site_writes_a_raw_email() -> None:
    """The regression guard.

    If this fails, a new log call is putting an address into `system_logs` — a table with no
    `user_id`, unreachable by any account scrub, whose contents outlive the account. Fix the call
    site rather than this test: log `user.uuid` when a user is in scope, `mask_email(...)` when
    only an address is.
    """
    violations = _log_payload_violations()
    assert not violations, "Unmasked email in a log payload:\n  " + "\n  ".join(violations)


def test_the_scan_would_actually_catch_a_regression(tmp_path) -> None:
    """A guard that cannot fail guards nothing.

    Two near-identical snippets: one is a log payload and must be caught, the other is an API
    response and must not be. If the scan ever stops distinguishing them it becomes either useless
    or unbearable, and this is what says which.
    """
    offending = ast.parse(
        'log(metadata={"email": user.email})\n'
        'log(message=f"hello {user.email}")\n'
    )
    innocent = ast.parse(
        'format_response(data={"email": user.email})\n'
        'log(metadata={"email": mask_email(user.email)})\n'
        'log(message=f"hello {user.uuid}")\n'
    )

    def scan(tree):
        found = []
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            for kw in node.keywords:
                if kw.arg == "metadata" and isinstance(kw.value, ast.Dict):
                    for key, value in zip(kw.value.keys, kw.value.values):
                        if isinstance(key, ast.Constant) and key.value == "email" and not _is_masked(value):
                            found.append("metadata")
                elif kw.arg == "message" and isinstance(kw.value, ast.JoinedStr):
                    for piece in kw.value.values:
                        if isinstance(piece, ast.FormattedValue) and _mentions_email(piece.value) and not _is_masked(piece.value):
                            found.append("message")
        return found

    assert scan(offending) == ["metadata", "message"]
    assert scan(innocent) == []
