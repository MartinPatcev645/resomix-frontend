"""
Export target matching (pricing v2.1, C2)
=========================================

``check_export`` compares a requested target against the plan's ``export_targets`` CSV. The failure
that matters is not a stranger getting in — it is a **paying user being told their own feature is
not on their plan** because the two sides spell the same target differently.

That is a live risk, not a hypothetical: production stores ``apple``, ``useAccess.ts`` compares
against the literal ``"apple"``, and the pricing spec writes ``apple_music``. Both sides are
canonicalised so no spelling can be recognised in one place and rejected in the other.

Fakes only — no DB.
"""

import pytest

from app.services.entitlement_gate import EntitlementGate


class _Entitlements:
    def __init__(self, can_export=True, targets="txt,apple"):
        self.can_export = can_export
        self.targets = targets

    async def get_bool(self, db, key, *, user=None, visitor_id=None):
        return self.can_export

    async def get_str(self, db, key, *, user=None, visitor_id=None):
        return self.targets


class _User:
    id = 7


def _gate(**kw):
    g = EntitlementGate()
    g._entitlements = _Entitlements(**kw)
    return g


@pytest.mark.asyncio
class TestSpellingCannotDenyAnEntitledUser:
    @pytest.mark.parametrize("requested", ["apple", "apple_music", "APPLE", " Apple_Music "])
    async def test_any_apple_spelling_matches_a_stored_apple(self, requested):
        result = await _gate(targets="txt,apple").check_export(None, requested, user=_User())
        assert result.allowed is True

    @pytest.mark.parametrize("stored", ["apple", "apple_music", "TXT,APPLE_MUSIC"])
    async def test_any_stored_spelling_matches_a_requested_apple(self, stored):
        """An admin editing the CSV in the plans UI must not be able to break Apple export by
        typing the spec's spelling."""
        result = await _gate(targets=stored).check_export(None, "apple", user=_User())
        assert result.allowed is True

    async def test_whitespace_in_the_csv_is_tolerated(self):
        result = await _gate(targets=" txt , apple ").check_export(None, "txt", user=_User())
        assert result.allowed is True


@pytest.mark.asyncio
class TestDenials:
    async def test_a_target_not_on_the_plan_is_denied(self):
        result = await _gate(targets="txt").check_export(None, "apple", user=_User())
        assert result.allowed is False
        assert result.reason == "upgrade_required"

    async def test_canonicalisation_does_not_open_a_door(self):
        """Unknown tokens pass through unchanged rather than collapsing onto a real target — if
        they normalised to something, an unrecognised value could match an entitled one."""
        result = await _gate(targets="txt,apple").check_export(None, "embed", user=_User())
        assert result.allowed is False

    async def test_can_export_false_denies_every_target(self):
        """The boolean is checked first, so a plan with `can_export = false` cannot be bypassed by
        a stale target list left in its CSV."""
        result = await _gate(can_export=False, targets="txt,apple").check_export(
            None, "txt", user=_User()
        )
        assert result.allowed is False

    async def test_a_guest_is_told_to_log_in_not_to_upgrade(self):
        result = await _gate(can_export=False, targets="").check_export(None, "txt", user=None)
        assert result.reason == "login_required"

    async def test_an_empty_csv_denies(self):
        result = await _gate(targets="").check_export(None, "txt", user=_User())
        assert result.allowed is False

    async def test_an_empty_request_denies(self):
        """An empty target canonicalises to "", which must never match an empty CSV entry — the
        split already discards blanks, and this pins that it stays that way."""
        result = await _gate(targets="txt,apple").check_export(None, "", user=_User())
        assert result.allowed is False
