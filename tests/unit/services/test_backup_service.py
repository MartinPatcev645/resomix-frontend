"""
Unit tests for the backup control plane service.

Pure: no database, no HTTP. The repository and the session are replaced with
in-memory fakes, and the agent with a stub, because everything worth testing
here is decision logic — how a run's status is derived, when a trigger is
refused, and what happens when the agent is not wired up yet.

The rollup tests are the important ones. A run whose status is taken on trust
from whoever reported last is a run that can claim success while a component
inside it failed, which is the exact failure mode a backup system must not have.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app.models.backup_run import BackupComponent, BackupRun
from app.services.backup_service import BackupService, BackupServiceError


# --- fakes ------------------------------------------------------------------ #

class FakeSession:
    """Enough of AsyncSession for the service: flush/commit/refresh are no-ops."""

    def __init__(self):
        self.commits = 0

    async def flush(self):
        pass

    async def commit(self):
        self.commits += 1

    async def refresh(self, _obj):
        pass

    def add(self, _obj):
        pass


class FakeRepo:
    """In-memory stand-in for BackupRepository."""

    def __init__(self):
        self.runs: list[BackupRun] = []
        self.components: dict[int, list[BackupComponent]] = {}
        self._next_id = 1

    # runs
    async def create_run(self, db, **kw):
        run = BackupRun(**kw)
        run.id = self._next_id
        self._next_id += 1
        run.bytes_stored = 0
        run.files_processed = 0
        run.created_at = datetime.utcnow()
        self.runs.append(run)
        self.components.setdefault(run.id, [])
        return run

    async def get_run_by_uid(self, db, run_uid, with_components=False):
        return next((r for r in self.runs if r.run_uid == run_uid), None)

    async def update_run(self, db, run, **fields):
        for k, v in fields.items():
            setattr(run, k, v)
        return run

    async def active_run(self, db, server_role):
        return next(
            (r for r in reversed(self.runs)
             if r.server_role == server_role and r.status in ("pending", "running")),
            None,
        )

    async def latest_run(self, db, server_role, statuses=None):
        rows = [r for r in self.runs if r.server_role == server_role]
        return rows[-1] if rows else None

    async def list_runs(self, db, **kw):
        rows = list(reversed(self.runs))
        return rows, len(rows)

    # components
    async def list_components(self, db, run_id):
        return list(self.components.get(run_id, []))

    async def upsert_component(self, db, *, run_id, component, **fields):
        rows = self.components.setdefault(run_id, [])
        row = next((c for c in rows if c.component == component), None)
        if row is None:
            row = BackupComponent(run_id=run_id, component=component)
            for attr in ("files_new", "files_changed", "files_processed",
                         "bytes_processed", "bytes_added", "bytes_stored"):
                setattr(row, attr, 0)
            rows.append(row)
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        return row

    async def get_component(self, db, run_id, component):
        return next((c for c in self.components.get(run_id, []) if c.component == component), None)

    async def upsert_run(self, db, *, run_uid, server_role, **fields):
        run = await self.get_run_by_uid(db, run_uid)
        if run is None:
            run = await self.create_run(db, run_uid=run_uid, server_role=server_role, status="pending")
        for k, v in fields.items():
            if v is not None:
                setattr(run, k, v)
        return run

    async def last_component_success(self, db):
        out = {}
        for rows in self.components.values():
            for c in rows:
                if c.status == "succeeded" and c.finished_at:
                    if c.component not in out or c.finished_at > out[c.component]:
                        out[c.component] = c.finished_at
        return out


class FakeAgent:
    """Stub agent. `configured=False` reproduces the current, unwired state."""

    def __init__(self, configured=True, success=True, reason=None):
        self.configured = configured
        self.success = success
        self.reason = reason
        self.calls = []

    def is_configured(self, role):
        return self.configured

    async def start_backup(self, role, run_uid, components=None):
        self.calls.append(("start", role, run_uid, components))
        if not self.configured:
            return {"success": False, "reason": "not_configured", "error": "no agent"}
        if not self.success:
            return {"success": False, "reason": self.reason or "unreachable", "error": "boom"}
        return {"success": True, "data": {}}

    async def start_verify(self, role, run_uid, full=False):
        self.calls.append(("verify", role, run_uid, full))
        if not self.configured:
            return {"success": False, "reason": "not_configured", "error": "no agent"}
        return {"success": self.success, "reason": self.reason, "error": "boom"}

    async def list_snapshots(self, role, tag=None):
        self.calls.append(("snapshots", role, tag))
        if not self.configured:
            return {"success": False, "reason": "not_configured", "error": "no agent"}
        return {"success": True, "data": {"snapshots": []}}


def make_service(agent=None):
    repo = FakeRepo()
    return BackupService(repo=repo, agent=agent or FakeAgent()), repo, FakeSession()


async def seed_components(svc, repo, db, run, spec):
    """spec: [(component, status, bytes_stored, files_processed)]"""
    for component, status, stored, files in spec:
        await repo.upsert_component(
            db, run_id=run.id, component=component, status=status,
            bytes_stored=stored, files_processed=files,
            finished_at=datetime.utcnow(),
        )


# --- the contract with the agent --------------------------------------------- #

def test_role_components_are_all_valid_component_names():
    """ROLE_COMPONENTS may only name components the ingest endpoint accepts.

    This is the bug that shipped. `ROLE_COMPONENTS` expected `analysis-results`,
    `media-embeddings` and `media-uploads`; `BACKUP_COMPONENTS` listed the same
    three, so the two agreed with each other perfectly and neither agreed with the
    agent, which sends `media` and `analysis`. `ingest_component` rejects an
    unknown component with a 400, so every media push but `secrets` would have
    been refused nightly while the panel showed a box that had barely reported.
    """
    from app.models.backup_run import BACKUP_COMPONENTS
    from app.services.backup_service import ROLE_COMPONENTS

    for role, names in ROLE_COMPONENTS.items():
        for name in names:
            assert name in BACKUP_COMPONENTS, (
                f"{role} expects '{name}', which /internal/backups/metrics would reject"
            )


def test_component_names_match_the_backup_agent():
    """The agent's names, pinned here so a rename on either side fails loudly.

    Each value below is the `COMPONENT="..."` line at the top of the matching
    script in the server-backups repo, and the role split is that repo's
    `run_nightly.sh` `case "$ROLE"` block. Nothing in this codebase can check the
    other repo directly, so this test is the tripwire: if it fails, one side was
    renamed and the other was not, and the fix is to look at the shell scripts
    rather than to update this list until it goes green.
    """
    from app.models.backup_run import BACKUP_COMPONENTS
    from app.services.backup_service import ROLE_COMPONENTS

    assert set(BACKUP_COMPONENTS) == {"db", "secrets", "media", "analysis", "verify", "retention"}
    # secrets is on BOTH roles deliberately: while it ran on Alwyzon alone, the
    # media box's .env files, SFTPGo password and audit signing key were captured
    # nowhere at all.
    assert ROLE_COMPONENTS["alwyzon"] == ("db", "secrets")
    assert ROLE_COMPONENTS["media"] == ("secrets", "media", "analysis")


# --- rollup: the run's status is derived, never trusted ---------------------- #

async def test_all_components_succeeded_makes_the_run_succeeded():
    svc, repo, db = make_service()
    run = await repo.create_run(db, run_uid="u1", server_role="alwyzon", status="running")
    run.started_at = datetime.utcnow() - timedelta(minutes=5)
    await seed_components(svc, repo, db, run, [
        ("db", "succeeded", 100, 1),
        ("secrets", "succeeded", 10, 1),
    ])
    await svc.recompute_run(db, run)
    assert run.status == "succeeded"
    assert run.bytes_stored == 110
    assert run.files_processed == 2


async def test_one_failure_among_successes_is_partial_not_failed():
    """Some components working is a different situation from nothing working.
    Collapsing them loses the distinction that decides whether anyone gets out of
    bed."""
    svc, repo, db = make_service()
    run = await repo.create_run(db, run_uid="u2", server_role="media", status="running")
    await seed_components(svc, repo, db, run, [
        ("secrets", "succeeded", 10, 1),
        ("media", "succeeded", 100, 1),
        ("analysis", "failed", 0, 0),
    ])
    await svc.recompute_run(db, run)
    assert run.status == "partial"


async def test_everything_failed_is_failed():
    svc, repo, db = make_service()
    run = await repo.create_run(db, run_uid="u3", server_role="alwyzon", status="running")
    await seed_components(svc, repo, db, run, [
        ("db", "failed", 0, 0),
        ("secrets", "failed", 0, 0),
    ])
    await svc.recompute_run(db, run)
    assert run.status == "failed"


async def test_still_reporting_stays_running():
    svc, repo, db = make_service()
    run = await repo.create_run(db, run_uid="u4", server_role="alwyzon", status="running")
    await seed_components(svc, repo, db, run, [
        ("db", "succeeded", 100, 1),
        ("secrets", "running", 0, 0),
    ])
    await svc.recompute_run(db, run)
    assert run.status == "running"


async def test_a_component_that_never_reported_makes_the_run_partial():
    """The regression this exists for: a run can end with every REPORTED
    component green while one never reported at all. Judging only what arrived
    would call that a clean night and leave a silent gap in the restore point."""
    svc, repo, db = make_service()
    run = await repo.create_run(db, run_uid="u5", server_role="alwyzon", status="running")
    run.started_at = datetime.utcnow() - timedelta(minutes=1)
    await seed_components(svc, repo, db, run, [
        ("db", "succeeded", 100, 1),
        # secrets never reported
    ])
    await svc.recompute_run(db, run, force_terminal=True)
    assert run.status == "partial"
    assert "secrets" in (run.error or "")


async def test_maintenance_components_do_not_decide_a_data_run():
    """A failed retention pass does not mean last night's data is missing."""
    svc, repo, db = make_service()
    run = await repo.create_run(db, run_uid="u6", server_role="alwyzon", status="running")
    await seed_components(svc, repo, db, run, [
        ("db", "succeeded", 100, 1),
        ("secrets", "succeeded", 10, 1),
        ("retention", "failed", 0, 0),
    ])
    await svc.recompute_run(db, run)
    assert run.status == "succeeded"


async def test_verify_only_run_is_judged_by_verify():
    """A run with no data components must not be graded against the empty set,
    which would call it succeeded whatever verify reported."""
    svc, repo, db = make_service()
    run = await repo.create_run(db, run_uid="u7", server_role="media", status="running")
    await seed_components(svc, repo, db, run, [("verify", "failed", 0, 0)])
    await svc.recompute_run(db, run, force_terminal=True)
    assert run.status == "failed"


async def test_duration_is_computed_on_terminal_states():
    svc, repo, db = make_service()
    run = await repo.create_run(db, run_uid="u8", server_role="media", status="running")
    run.started_at = datetime(2026, 8, 29, 2, 0, 0)
    for name in ("secrets", "media", "analysis"):
        await repo.upsert_component(
            db, run_id=run.id, component=name, status="succeeded",
            finished_at=datetime(2026, 8, 29, 2, 4, 30), bytes_stored=1, files_processed=1,
        )
    await svc.recompute_run(db, run)
    assert run.status == "succeeded"
    assert run.duration_s == 270


# --- ingest ----------------------------------------------------------------- #

async def test_ingest_is_idempotent_on_run_and_component():
    """Called over the network by a shell script, so a retry after a lost
    response is the normal case, not an edge one."""
    svc, repo, db = make_service()
    payload = {"status": "succeeded", "bytes_stored": 100, "files_processed": 4,
               "finished_at": "2026-08-29T02:04:00Z"}
    await svc.ingest_component(db, run_uid="r1", server_role="alwyzon", component="db", payload=payload)
    await svc.ingest_component(db, run_uid="r1", server_role="alwyzon", component="db", payload=payload)

    assert len(repo.runs) == 1
    assert len(repo.components[repo.runs[0].id]) == 1
    assert repo.components[repo.runs[0].id][0].bytes_stored == 100


async def test_ingest_rejects_unknown_component_and_status():
    svc, _, db = make_service()
    with pytest.raises(BackupServiceError) as e:
        await svc.ingest_component(db, run_uid="r2", server_role="alwyzon",
                                   component="nonsense", payload={"status": "succeeded"})
    assert e.value.status_code == 400

    with pytest.raises(BackupServiceError):
        await svc.ingest_component(db, run_uid="r2", server_role="alwyzon",
                                   component="db", payload={"status": "great"})


async def test_ingest_rejects_unknown_role():
    svc, _, db = make_service()
    with pytest.raises(BackupServiceError):
        await svc.ingest_component(db, run_uid="r3", server_role="laptop",
                                   component="db", payload={"status": "succeeded"})


async def test_finish_run_cannot_override_a_component_failure():
    """A wrapper that exits 0 must not be able to mark a night green."""
    svc, repo, db = make_service()
    await svc.ingest_component(db, run_uid="r4", server_role="alwyzon", component="db",
                               payload={"status": "failed", "error": "mysqldump died"})
    result = await svc.finish_run(db, run_uid="r4")
    assert result["status"] == "failed"
    assert "mysqldump died" in (result["error"] or "")


async def test_finish_run_on_unknown_uid_is_404():
    svc, _, db = make_service()
    with pytest.raises(BackupServiceError) as e:
        await svc.finish_run(db, run_uid="does-not-exist")
    assert e.value.status_code == 404


# --- triggers --------------------------------------------------------------- #

async def test_trigger_records_the_run_before_dispatch():
    svc, repo, db = make_service(FakeAgent(configured=True))
    result = await svc.trigger_run(db, server_role="media", user_id=7)
    assert result["dispatched"] is True
    assert len(repo.runs) == 1
    assert repo.runs[0].trigger == "manual"
    assert repo.runs[0].triggered_by_user_id == 7
    assert repo.runs[0].status == "running"


async def test_unconfigured_agent_records_a_failed_run_and_says_why():
    """The current state of the world: schema and UI are live, the agents are
    not deployed. Pressing the button must not look like a successful backup,
    and must not look like a mysterious failure either."""
    svc, repo, db = make_service(FakeAgent(configured=False))
    result = await svc.trigger_run(db, server_role="media", user_id=1)
    assert result["dispatched"] is False
    assert result["reason"] == "not_configured"
    assert repo.runs[0].status == "failed"
    assert "No backup agent is configured" in result["message"]


async def test_concurrent_trigger_is_refused():
    """restic locks the repository, so a second run would queue and then time
    out on the lock, surfacing as a failed backup. Refusing here is honest."""
    svc, repo, db = make_service(FakeAgent(configured=True))
    await svc.trigger_run(db, server_role="media", user_id=1)
    with pytest.raises(BackupServiceError) as e:
        await svc.trigger_run(db, server_role="media", user_id=1)
    assert e.value.status_code == 409
    assert len(repo.runs) == 1


async def test_trigger_rejects_unknown_role_and_component():
    svc, _, db = make_service()
    with pytest.raises(BackupServiceError):
        await svc.trigger_run(db, server_role="laptop", user_id=1)
    with pytest.raises(BackupServiceError):
        await svc.trigger_run(db, server_role="media", user_id=1, components=["nope"])


async def test_run_uids_are_unique_within_the_same_second():
    seen = {BackupService.generate_run_uid() for _ in range(50)}
    assert len(seen) == 50


async def test_verify_records_a_run_with_a_verify_component():
    svc, repo, db = make_service(FakeAgent(configured=True))
    result = await svc.trigger_verify(db, server_role="media", user_id=3, full=True)
    assert result["dispatched"] is True
    run_id = repo.runs[0].id
    assert [c.component for c in repo.components[run_id]] == ["verify"]
    assert ("verify", "media", repo.runs[0].run_uid, True) in svc.agent.calls


async def test_snapshots_surface_unavailability_as_503():
    svc, _, _ = make_service(FakeAgent(configured=False))
    with pytest.raises(BackupServiceError) as e:
        await svc.list_snapshots("media")
    assert e.value.status_code == 503


# --- status ----------------------------------------------------------------- #

async def test_status_reports_never_when_nothing_has_ever_succeeded():
    """`never` and `stale` must stay distinct: one is a setup problem, the other
    is an incident, and they need different responses."""
    svc, _, db = make_service()
    status = await svc.get_status(db)
    assert status["overall_health"] == "never"
    for role in status["roles"]:
        assert all(c["health"] == "never" for c in role["components"])


async def test_status_marks_an_old_success_stale():
    svc, repo, db = make_service()
    run = await repo.create_run(db, run_uid="s1", server_role="alwyzon", status="succeeded")
    old = datetime.utcnow() - timedelta(hours=100)
    for name in ("db", "secrets"):
        await repo.upsert_component(db, run_id=run.id, component=name,
                                    status="succeeded", finished_at=old)
    status = await svc.get_status(db)
    alwyzon = next(r for r in status["roles"] if r["server_role"] == "alwyzon")
    assert all(c["health"] == "stale" for c in alwyzon["components"])
    assert alwyzon["health"] == "degraded"


async def test_status_is_ok_for_a_fresh_success():
    svc, repo, db = make_service()
    run = await repo.create_run(db, run_uid="s2", server_role="alwyzon", status="succeeded")
    for name in ("db", "secrets"):
        await repo.upsert_component(db, run_id=run.id, component=name,
                                    status="succeeded", finished_at=datetime.utcnow())
    status = await svc.get_status(db)
    alwyzon = next(r for r in status["roles"] if r["server_role"] == "alwyzon")
    assert alwyzon["health"] == "ok"


# --- coercion --------------------------------------------------------------- #

def test_metric_numbers_never_raise():
    """Values arrive from shell, where unset is an empty string and a large byte
    count can arrive as a float. Losing a counter must not lose the record that
    the backup happened."""
    as_int = BackupService._as_int
    assert as_int(None) == 0
    assert as_int("") == 0
    assert as_int("garbage") == 0
    assert as_int("1024") == 1024
    assert as_int(1.9e3) == 1900
    assert as_int(-5) == 0


def test_timestamps_normalise_to_naive_utc():
    """The scripts stamp UTC on two boxes. Converting to the API server's local
    zone would silently shift every timestamp by the offset."""
    parse = BackupService._parse_dt
    assert parse(None) is None
    assert parse("") is None
    assert parse("not a date") is None
    parsed = parse("2026-08-29T02:04:00Z")
    assert parsed == datetime(2026, 8, 29, 2, 4, 0)
    assert parsed.tzinfo is None
    # +02:00 is 00:04 UTC, not 02:04.
    assert parse("2026-08-29T02:04:00+02:00") == datetime(2026, 8, 29, 0, 4, 0)
