"""user_plan_grants — complimentary, time-boxed plan access granted by an admin

WHY A NEW TABLE RATHER THAN REUSING SOMETHING

*Not* ``users.plan_id``: that column exists to record the DEFAULT (free) plan, and a paid plan sat
there grants access **nothing can revoke** — cancellation, refund and chargeback all act on
``user_subscriptions``, and none of them would touch it. `EntitlementService` already logs a warning
when it finds one.

*Not* ``user_subscriptions``: its primary key is ``user_id`` (one row per user) and
``stripe_subscription_id`` is ``NOT NULL UNIQUE``. A comped grant has no Stripe subscription, and a
user must be able to hold a grant now and buy a real subscription later — or during — without one
displacing the other.

SHAPE

Third normal form. ``plan_id`` is a foreign key rather than a plan *code*, so when there are more
plans than Pro this table needs no change at all — granting "Max for 14 days" is already expressible.
``granted_by``/``revoked_by`` point at the admin, so "who comped this account?" is answerable a year
later.

Duration is stored as ``starts_at``/``ends_at`` rather than a number of days, because the boundary
is what enforcement reads. A ``days`` column would have to be re-derived on every request, and would
silently disagree with itself if anyone ever edited one and not the other.

NO EXPIRY JOB

Nothing sweeps expired grants. ``ends_at`` is compared at read time, so a grant simply stops
matching the moment it lapses — no cron, no drift, and no window where the database says one thing
and enforcement does another. ``revoked_at`` is for an admin ending one early.

Revision ID: c1a4e8b3f6d2
Revises: b6e9f4c2a1d7
Create Date: 2026-08-08
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import mysql

revision = "c1a4e8b3f6d2"
down_revision = "b6e9f4c2a1d7"
branch_labels = None
depends_on = None

_TABLE = "user_plan_grants"


def _tables(conn) -> set:
    return {r[0] for r in conn.execute(text("SHOW TABLES")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()
    if _TABLE in _tables(conn):
        return

    op.create_table(
        _TABLE,
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, primary_key=True),
        sa.Column(
            "user_id",
            mysql.INTEGER(unsigned=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            comment="Who the grant is for",
        ),
        sa.Column(
            "plan_id",
            mysql.INTEGER(unsigned=True),
            sa.ForeignKey("plans.id", ondelete="RESTRICT"),
            nullable=False,
            comment="Which plan — a key, not a code, so more plans need no schema change",
        ),
        sa.Column(
            "granted_by",
            mysql.INTEGER(unsigned=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            comment="The admin who granted it",
        ),
        sa.Column(
            "reason",
            sa.String(length=40),
            nullable=False,
            server_default="trial",
            comment="trial | goodwill | partner | support | compensation",
        ),
        sa.Column("note", sa.String(length=255), nullable=True, comment="Free-text admin note"),
        sa.Column("starts_at", sa.DateTime(), nullable=False),
        sa.Column(
            "ends_at",
            sa.DateTime(),
            nullable=False,
            comment="Compared at read time — no expiry job, so this cannot drift",
        ),
        sa.Column("revoked_at", sa.DateTime(), nullable=True, comment="Ended early by an admin"),
        sa.Column(
            "revoked_by",
            mysql.INTEGER(unsigned=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        # The hot path: "does this user have a live grant right now?" on every entitlement check.
        sa.Index("ix_grant_user_active", "user_id", "revoked_at", "ends_at"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


def downgrade() -> None:
    conn = op.get_bind()
    if _TABLE in _tables(conn):
        op.drop_table(_TABLE)
