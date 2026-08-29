"""backup_runs / backup_components — the control plane for server backups

WHY

The backup scripts on the two servers already record what they did, but only
into JSON files on the machine that ran them. That is fine until the day it
matters, when the question is asked from the admin panel and not from an SSH
session, and answering it requires knowing which box to log into.

These two tables are where those per-component metrics files land, so the state
of the backups is a normal query against the same database as everything else.

WHY TWO TABLES

A run is not one operation. It is the database dump, the encrypted secrets, the
embeddings, the consumer uploads and the analysis results, each of which can
succeed or fail on its own. A single status column would flatten "everything
worked except the analysis results" into "failed", which is the difference
between a real gap and a full night's work being ignored.

Idempotent, like the migrations either side of it.

Revision ID: f1c3d5a90b27
Revises: e4a9b2c7d135
Create Date: 2026-08-29
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import mysql

revision = "f1c3d5a90b27"
down_revision = "e4a9b2c7d135"
branch_labels = None
depends_on = None

RUNS = "backup_runs"
COMPONENTS = "backup_components"


def _tables(conn) -> set:
    return {r[0] for r in conn.execute(text("SHOW TABLES")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()
    existing = _tables(conn)

    if RUNS not in existing:
        op.create_table(
            RUNS,
            sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
            # The identifier the backup scripts generate (UTC, e.g. 20260829T022000Z).
            # Unique because it is the key an agent posting metrics uses to find
            # its own run: a retried POST must update, never insert a twin.
            sa.Column("run_uid", sa.String(40), nullable=False),
            sa.Column("server_role", sa.String(20), nullable=False),
            sa.Column("hostname", sa.String(255), nullable=True),
            sa.Column("trigger", sa.String(20), nullable=False, server_default="scheduled"),
            sa.Column("triggered_by_user_id", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("started_at", sa.DateTime, nullable=True),
            sa.Column("finished_at", sa.DateTime, nullable=True),
            sa.Column("duration_s", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("bytes_stored", mysql.BIGINT(unsigned=True), nullable=False, server_default="0"),
            sa.Column("files_processed", mysql.BIGINT(unsigned=True), nullable=False, server_default="0"),
            sa.Column("error", mysql.TEXT, nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.PrimaryKeyConstraint("id"),
            # SET NULL, not CASCADE: deleting the admin who pressed the button
            # must not delete the evidence that a backup happened.
            sa.ForeignKeyConstraint(["triggered_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.UniqueConstraint("run_uid", name="uq_backup_runs_uid"),
            mysql_engine="InnoDB",
            mysql_charset="utf8mb4",
            mysql_collate="utf8mb4_unicode_ci",
        )
        op.create_index("ix_backup_runs_role", RUNS, ["server_role"])
        op.create_index("ix_backup_runs_status", RUNS, ["status"])
        op.create_index("ix_backup_runs_trigger", RUNS, ["trigger"])
        op.create_index("ix_backup_runs_user", RUNS, ["triggered_by_user_id"])
        # The one query the status card runs on every page load: newest run for
        # a given server. Composite so it is answered from the index alone.
        op.create_index("ix_backup_runs_role_started", RUNS, ["server_role", "started_at"])

    if COMPONENTS not in existing:
        op.create_table(
            COMPONENTS,
            sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
            sa.Column("run_id", mysql.BIGINT(unsigned=True), nullable=False),
            sa.Column("component", sa.String(32), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("started_at", sa.DateTime, nullable=True),
            sa.Column("finished_at", sa.DateTime, nullable=True),
            sa.Column("duration_s", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("snapshot_id", sa.String(255), nullable=True),
            sa.Column("files_new", mysql.BIGINT(unsigned=True), nullable=False, server_default="0"),
            sa.Column("files_changed", mysql.BIGINT(unsigned=True), nullable=False, server_default="0"),
            sa.Column("files_processed", mysql.BIGINT(unsigned=True), nullable=False, server_default="0"),
            sa.Column("bytes_processed", mysql.BIGINT(unsigned=True), nullable=False, server_default="0"),
            # bytes_added is restic's logical figure (pre-compression);
            # bytes_stored is what actually reached the Storage Box. Reporting
            # the first as growth overstates it several times over, so both are
            # kept rather than picking one and being wrong in the UI.
            sa.Column("bytes_added", mysql.BIGINT(unsigned=True), nullable=False, server_default="0"),
            sa.Column("bytes_stored", mysql.BIGINT(unsigned=True), nullable=False, server_default="0"),
            sa.Column("error", mysql.TEXT, nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.current_timestamp()),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["run_id"], ["backup_runs.id"], ondelete="CASCADE"),
            # One row per component per run. Makes the metrics POST an upsert,
            # so a script that retries after a transient network failure cannot
            # leave two contradictory records of the same component.
            sa.UniqueConstraint("run_id", "component", name="uq_backup_components_run_component"),
            mysql_engine="InnoDB",
            mysql_charset="utf8mb4",
            mysql_collate="utf8mb4_unicode_ci",
        )
        op.create_index("ix_backup_components_component", COMPONENTS, ["component"])
        op.create_index("ix_backup_components_status", COMPONENTS, ["status"])

    # --- permissions -------------------------------------------------------
    # Permissions live in the DATABASE. Adding a key to app/core/rbac.py changes
    # what the endpoint CHECKS for and grants nobody anything, so without this
    # the new admin pages answer "Insufficient permissions" to an actual admin.
    # Same pattern as e4a8d2f6b9c3; literal, because a migration is a snapshot.
    for name, description in (
        ("backup:read", "View backup run history, status, and snapshot inventory"),
        ("backup:manage", "Trigger backup runs and verification, and manage retention"),
    ):
        conn.execute(
            text(
                "INSERT INTO permissions (name, description) "
                "SELECT :name, :description FROM DUAL "
                "WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = :name)"
            ),
            {"name": name, "description": description},
        )

    conn.execute(
        text(
            """
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            CROSS JOIN permissions p
            WHERE r.name = 'admin'
              AND p.name IN ('backup:read', 'backup:manage')
              AND NOT EXISTS (
                  SELECT 1 FROM role_permissions rp
                  WHERE rp.role_id = r.id AND rp.permission_id = p.id
              )
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    existing = _tables(conn)
    # Children first: the FK would refuse the other order.
    if COMPONENTS in existing:
        op.drop_table(COMPONENTS)
    if RUNS in existing:
        op.drop_table(RUNS)
