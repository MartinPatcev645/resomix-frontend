"""users — account lifecycle: deactivation, scheduled deletion, last seen

FIVE COLUMNS, THREE PURPOSES

**Deactivation** (``deactivated_at``, ``deactivation_reason``). ``is_active`` already exists but
carries no *why* and no *when*, and both matter: support needs to tell "this person asked to leave"
apart from "we suspended them", and the 30-day clock has to start somewhere. ``is_active`` stays
the boolean everything checks; these describe it.

**Scheduled deletion** (``deletion_requested_at``, ``purge_due_at``). Deleting an account is
irreversible and people change their minds, so a request starts a 30-day grace period in which
nothing is touched and reactivation is a single flag flip. ``purge_due_at`` is stored rather than
computed so the window can be extended for one account (a support hold, a dispute) without a code
change. No automatic deletion — an admin acts, and this is only what tells them it is due.

**Activity** (``last_seen_at``). "When did this user last do anything?" is currently unanswerable:
``system_logs`` has ``client_ip`` and endpoints but **no user_id**, so requests cannot be attributed
to a person, and ``user_sessions.created_at`` only records logins. Written by a throttled touch, so
it costs one cheap UPDATE per session rather than one per request.

All additive and nullable. NULL reads as "never deactivated / no deletion requested / never seen",
which is the correct answer for every existing row, so there is nothing to backfill.

Revision ID: e2c7b9d4a5f1
Revises: d8b4f2a6c1e3
Create Date: 2026-08-08
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "e2c7b9d4a5f1"
down_revision = "d8b4f2a6c1e3"
branch_labels = None
depends_on = None

_TABLE = "users"
_INDEX = "ix_users_purge_due_at"

_COLUMNS = (
    ("deactivated_at", sa.DateTime(), "When the account was deactivated"),
    ("deactivation_reason", sa.String(length=40),
     "user_requested | admin | abuse — why access was withdrawn"),
    ("deletion_requested_at", sa.DateTime(), "When the user asked for deletion"),
    ("purge_due_at", sa.DateTime(),
     "deletion_requested_at + 30 days; an admin purges after this, never automatically"),
    ("last_seen_at", sa.DateTime(), "Last authenticated activity (throttled)"),
)


def _columns(conn, table: str) -> set:
    return {r[0] for r in conn.execute(text(f"SHOW COLUMNS FROM `{table}`")).fetchall()}


def _indexes(conn, table: str) -> set:
    return {r[2] for r in conn.execute(text(f"SHOW INDEX FROM `{table}`")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()
    existing = _columns(conn, _TABLE)

    for name, type_, comment in _COLUMNS:
        if name not in existing:
            op.add_column(_TABLE, sa.Column(name, type_, nullable=True, comment=comment))

    # The purge-due job asks "which accounts are due?" on a daily timer. Without this it is a full
    # table scan of every user to find the handful that are.
    if _INDEX not in _indexes(conn, _TABLE):
        op.create_index(_INDEX, _TABLE, ["purge_due_at"])


def downgrade() -> None:
    conn = op.get_bind()
    if _INDEX in _indexes(conn, _TABLE):
        op.drop_index(_INDEX, table_name=_TABLE)
    existing = _columns(conn, _TABLE)
    for name, _type, _comment in reversed(_COLUMNS):
        if name in existing:
            op.drop_column(_TABLE, name)
