"""
Upload credit is charged on success, never on acceptance (pricing v2.1, B3)
==========================================================================

One upload = one credit, and it buys two artefacts: an analysis and a sibling similarity playlist.
The agreed rule is **charge if either artefact succeeds** — refund only when the user got nothing.

The system implements that by *recording on success* rather than consuming-then-refunding, which is
a stronger position: if nothing was delivered, nothing was ever charged, so there is no refund path
that can double-fire or be missed.

The analysis-upload path used to break this. It charged at step 9, right after the analysis service
ACCEPTED the job — before any result existed. A hard pipeline failure after that point left the user
having paid for nothing. The charge now lives where the result is persisted.

These tests pin the invariant at the source level, because the alternative — asserting a Celery task
against a live analysis service — tests the infrastructure rather than the rule.
"""

import inspect
import re
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[3] / "app"


def _source(relative: str) -> str:
    return (APP / relative).read_text()


def _strip_comments(src: str) -> str:
    """Comments explain the rule and mention the same call names; match on code only."""
    return re.sub(r"^\s*#.*$", "", src, flags=re.M)


class TestAnalysisUploadDoesNotChargeOnAcceptance:
    def test_controller_never_records_an_upload(self):
        """The controller only knows the job was accepted; it cannot know a result exists."""
        code = _strip_comments(_source("controllers/analysis_result_controller.py"))
        assert 'record_success' not in code, (
            "the analysis upload controller must not charge — the result does not exist yet"
        )

    def test_controller_still_peeks_the_allowance(self):
        """Moving the charge must not remove the cap: the peek is what stops someone exceeding it."""
        code = _strip_comments(_source("controllers/analysis_result_controller.py"))
        assert 'operation_code="upload_create"' in code
        assert ".check(" in code


class TestChargeHappensWhereTheResultIsPersisted:
    def test_persist_task_records_the_upload(self):
        code = _strip_comments(_source("tasks/analysis_tasks.py"))
        assert 'operation_code="upload_create"' in code

    def test_charge_is_after_the_persist_call(self):
        """Ordering is the whole point: charging before `_persist_summary` would charge for a
        result that may still fail to store."""
        code = _strip_comments(_source("tasks/analysis_tasks.py"))
        persist_at = code.index("await _persist_summary(")
        charge_at = code.index('operation_code="upload_create"')
        assert charge_at > persist_at

    def test_charge_is_guarded_by_a_user_id(self):
        """Guests cannot upload, but the task signature allows None — charging None would raise
        inside a background task where nobody would see it."""
        code = _strip_comments(_source("tasks/analysis_tasks.py"))
        charge_at = code.index('operation_code="upload_create"')
        assert "if user_id:" in code[max(0, charge_at - 800):charge_at]


class TestFailurePathsLeaveTheCallerUncharged:
    @pytest.mark.parametrize(
        "early_return",
        [
            "analysis service not configured",   # client.is_configured is False
            "did not complete",                  # wait_for_result returned non-success
        ],
    )
    def test_every_early_return_precedes_the_charge(self, early_return):
        """Each of these is a path where the user got nothing. All must return before the charge,
        which is why no refund logic exists anywhere in the upload flow."""
        code = _source("tasks/analysis_tasks.py")
        assert early_return in code
        assert code.index(early_return) < code.index('operation_code="upload_create"')


class TestSimilarityUploadPathUnchanged:
    def test_similarity_upload_still_records_after_its_playlist_exists(self):
        """This path was already correct and must stay that way — it is the pattern the analysis
        path was moved to match."""
        code = _strip_comments(_source("controllers/similarity_controller.py"))
        assert 'operation_code="upload_create"' in code

    def test_no_refund_path_was_introduced(self):
        """Record-on-success means there is nothing to reverse. A refund appearing here would mean
        someone reintroduced charge-on-acceptance somewhere."""
        for module in ("tasks/analysis_tasks.py", "controllers/analysis_result_controller.py"):
            assert "refund" not in _strip_comments(_source(module)).lower()
