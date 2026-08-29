"""
Backup control plane: schema, migration and wiring.

No database. These check the things that are cheap to get wrong and expensive to
discover on a deploy:

* the migration actually creates what the models declare, column for column
* the constraints the idempotent writes rely on exist in the migration, not only
  in the model (the model is not what runs against production)
* the permissions the router checks for are inserted AND granted to admin.
  Adding a key to ``app/core/rbac.py`` alone changes what the endpoint checks
  and grants nobody anything, so the new page would answer "Insufficient
  permissions" to an actual admin
* every route the router declares maps to a controller method that exists.
  Router-to-controller name drift produces a 500 at request time, and
  mock-based tests do not catch it
"""

from __future__ import annotations

import inspect
import pathlib
import re

from app.controllers.admin_backup_controller import AdminBackupController
from app.core.rbac import PERMISSIONS, ROLE_PERMISSIONS
from app.models.backup_run import BackupComponent, BackupRun

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATION = REPO_ROOT / "alembic" / "versions" / "f1c3d5a90b27_backup_runs.py"


def _migration_text() -> str:
    return MIGRATION.read_text()


# --- models ----------------------------------------------------------------- #

def test_table_names():
    assert BackupRun.__tablename__ == "backup_runs"
    assert BackupComponent.__tablename__ == "backup_components"


def test_tables_are_innodb_utf8mb4():
    """MyISAM would silently drop the foreign key the cascade delete depends on."""
    for model in (BackupRun, BackupComponent):
        args = model.__table_args__[-1]
        assert args["mysql_engine"] == "InnoDB"
        assert args["mysql_charset"] == "utf8mb4"
        assert args["mysql_collate"] == "utf8mb4_unicode_ci"


def test_no_partner_id_column():
    """Backups are infrastructure, not tenant data. A partner_id here would drag
    both tables into the global tenancy failsafe and make an admin-context read
    depend on which partner happened to be active."""
    assert not hasattr(BackupRun, "partner_id")
    assert not hasattr(BackupComponent, "partner_id")


def test_model_columns_match_the_migration():
    """The model is not what runs against production. A column added to one and
    not the other fails at the first query, on the deploy."""
    text = _migration_text()
    for model in (BackupRun, BackupComponent):
        for column in model.__table__.columns:
            assert f'"{column.name}"' in text, f"{model.__tablename__}.{column.name} missing from the migration"


def test_migration_declares_the_constraints_the_upserts_rely_on():
    text = _migration_text()
    # run_uid is how an agent finds its own run: a retried POST must update it,
    # never insert a twin.
    assert 'sa.UniqueConstraint("run_uid"' in text
    # One row per component per run, which is what makes the metrics POST an upsert.
    assert 'sa.UniqueConstraint("run_id", "component"' in text
    # Components must go when their run goes.
    assert 'ondelete="CASCADE"' in text
    # Deleting the admin who pressed the button must not delete the evidence.
    assert 'ondelete="SET NULL"' in text


def test_migration_chains_from_the_previous_head():
    text = _migration_text()
    assert re.search(r'^revision\s*=\s*"f1c3d5a90b27"', text, re.M)
    assert re.search(r'^down_revision\s*=\s*"e4a9b2c7d135"', text, re.M)


def test_migration_is_idempotent_and_reversible():
    text = _migration_text()
    assert "SHOW TABLES" in text          # guarded: re-running must be a no-op
    assert "def downgrade()" in text
    # Children before parents, or the foreign key refuses the drop.
    down = text.split("def downgrade()", 1)[1]
    assert down.index("COMPONENTS") < down.index("RUNS")


# --- permissions ------------------------------------------------------------ #

def test_permissions_registered_in_code():
    assert "backup:read" in PERMISSIONS
    assert "backup:manage" in PERMISSIONS
    assert "backup:read" in ROLE_PERMISSIONS["admin"]
    assert "backup:manage" in ROLE_PERMISSIONS["admin"]


def test_permissions_are_not_granted_to_non_admin_roles():
    for role in ("user", "partner_admin"):
        assert "backup:read" not in ROLE_PERMISSIONS[role]
        assert "backup:manage" not in ROLE_PERMISSIONS[role]


def test_migration_inserts_and_grants_the_permissions():
    """Permissions live in the DATABASE. Without this the new page answers
    "Insufficient permissions" to an actual admin."""
    text = _migration_text()
    assert "INSERT INTO permissions" in text
    assert "INSERT INTO role_permissions" in text
    assert "backup:read" in text
    assert "backup:manage" in text


# --- wiring ----------------------------------------------------------------- #

def test_routers_are_registered():
    from app.api.routers import admin_routers, v1_routers
    from app.api.routers.admin.backups import router as admin_router
    from app.api.routers.internal.backups import router as internal_router

    registered = [r for r, _ in v1_routers]
    assert any(r is admin_router for r in registered)
    assert any(r is internal_router for r in registered)
    # Must be in admin_routers, or the Cloudflare Access edge-identity check is
    # never attached to these routes.
    assert any(r is admin_router for r in admin_routers)


def _route_permissions(route) -> set:
    """The permission names a route's dependencies actually check for.

    ``require_permission("x")`` returns a closure, so the name is in its closure
    cells and not in its repr. Matching on the repr would pass for any route
    that merely has *a* permission dependency, which is exactly the mistake this
    file is meant to catch.
    """
    names = set()
    for dep in route.dependencies:
        call = getattr(dep, "dependency", None)
        for cell in getattr(call, "__closure__", None) or ():
            value = cell.cell_contents
            if isinstance(value, str) and ":" in value:
                names.add(value)
    return names


def test_every_admin_route_is_permission_gated():
    """A read that forgot its dependency would be reachable by any authenticated
    admin-session holder regardless of role."""
    from app.api.routers.admin.backups import router

    for route in router.routes:
        assert _route_permissions(route) & {"backup:read", "backup:manage"}, route.path


def test_write_routes_require_manage_not_read():
    from app.api.routers.admin.backups import router

    for route in router.routes:
        if route.methods & {"POST", "DELETE", "PUT", "PATCH"}:
            assert "backup:manage" in _route_permissions(route), route.path


def test_internal_routes_require_the_agent_token():
    """An unset token must close the hook, not open it."""
    from app.api.routers.internal.backups import router, verify_backup_agent_key

    for route in router.routes:
        rendered = " ".join(str(d) for d in route.dependencies)
        assert "verify_backup_agent_key" in rendered, route.path

    source = inspect.getsource(verify_backup_agent_key)
    assert "not expected" in source


def test_controller_methods_the_routers_call_exist():
    """Router-to-controller name drift is a 500 at request time that mock-based
    tests do not catch."""
    router_source = (
        (REPO_ROOT / "app/api/routers/admin/backups.py").read_text()
        + (REPO_ROOT / "app/api/routers/internal/backups.py").read_text()
    )
    called = set(re.findall(r"controller\.(\w+)\(", router_source))
    assert called, "no controller calls found; the check would pass vacuously"
    for name in called:
        assert hasattr(AdminBackupController, name), f"controller has no method {name}"


def test_controller_methods_the_service_must_provide_exist():
    from app.services.backup_service import BackupService

    source = inspect.getsource(AdminBackupController)
    for name in set(re.findall(r"self\.service\.(\w+)\(", source)):
        assert hasattr(BackupService, name), f"service has no method {name}"


def test_service_methods_the_repository_must_provide_exist():
    from app.repositories.backup_repository import BackupRepository
    from app.services.backup_service import BackupService

    source = inspect.getsource(BackupService)
    for name in set(re.findall(r"self\.repo\.(\w+)\(", source)):
        assert hasattr(BackupRepository, name), f"repository has no method {name}"


def test_agent_methods_the_service_calls_exist():
    from app.services.backup_agent_client import BackupAgentClient
    from app.services.backup_service import BackupService

    source = inspect.getsource(BackupService)
    for name in set(re.findall(r"self\.agent\.(\w+)\(", source)):
        assert hasattr(BackupAgentClient, name), f"agent client has no method {name}"


def test_agent_settings_are_registered_as_env_vars():
    """A Settings field without an entry in the mapping table is a constant, not
    a setting: the environment variable is read by nothing."""
    config = (REPO_ROOT / "app/core/config.py").read_text()
    for env, field in (
        ("BACKUP_AGENT_TOKEN", "backup_agent_token"),
        ("BACKUP_AGENT_ALWYZON_URL", "backup_agent_alwyzon_url"),
        ("BACKUP_AGENT_MEDIA_URL", "backup_agent_media_url"),
        ("BACKUP_STALE_AFTER_HOURS", "backup_stale_after_hours"),
        ("BACKUP_HISTORY_RETENTION_DAYS", "backup_history_retention_days"),
    ):
        assert f'"{env}": "{field}"' in config, f"{env} is not mapped to {field}"

    # The two integers must also be in the int-coercion list, or they arrive as
    # strings and every comparison against them is wrong.
    ints = config.split("# Handle integer conversion", 1)[1].split("]", 1)[0]
    assert '"backup_stale_after_hours"' in ints
    assert '"backup_history_retention_days"' in ints


def test_agent_client_is_disabled_until_configured():
    """The agents are not deployed yet. Everything else must work regardless,
    and a dispatch attempt must report that plainly rather than pretend."""
    from app.core.config import settings
    from app.services.backup_agent_client import BackupAgentClient

    original = (settings.backup_agent_media_url, settings.backup_agent_token)
    try:
        settings.backup_agent_media_url = None
        settings.backup_agent_token = None
        assert BackupAgentClient().is_configured("media") is False
    finally:
        settings.backup_agent_media_url, settings.backup_agent_token = original
