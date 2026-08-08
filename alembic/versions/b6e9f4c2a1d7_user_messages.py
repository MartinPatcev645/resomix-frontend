"""user_messages — every message an admin sends a user

WHY IT IS AUDITED

"Did anyone reply to this?" is the first question on any support thread, and until now the answer
lived only in someone's sent folder. Two admins could answer the same contact twice without either
knowing, and a customer could reasonably claim we never responded.

Each row is one email actually sent, with the body as typed. `recipient_email` is denormalised so
the record survives the account being deleted — the audit trail must outlive the person it is
about, which is the same reason `user_id` is SET NULL rather than CASCADE.

`source_id` points at the contact or feedback being answered, so the reply can be shown alongside
the original. NULL for a direct message, which answers nothing.

Revision ID: b6e9f4c2a1d7
Revises: f5d1c3b8e7a2
Create Date: 2026-08-08
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import mysql

revision = "b6e9f4c2a1d7"
down_revision = "f5d1c3b8e7a2"
branch_labels = None
depends_on = None

_TABLE = "user_messages"


def _tables(conn) -> set:
    return {r[0] for r in conn.execute(text("SHOW TABLES")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()
    if _TABLE in _tables(conn):
        return

    op.create_table(
        _TABLE,
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, primary_key=True),
        # SET NULL, not CASCADE: the record that we replied must outlive the account.
        sa.Column("user_id", mysql.INTEGER(unsigned=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        # RESTRICT: who sent it is the point of the audit trail.
        sa.Column("admin_user_id", mysql.INTEGER(unsigned=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("channel", sa.String(length=20), nullable=False,
                  comment="contact | feedback | direct"),
        sa.Column("source_id", mysql.INTEGER(unsigned=True), nullable=True,
                  comment="contacts.id / feedbacks.id being answered; NULL for a direct message"),
        sa.Column("subject", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, comment="What the admin typed, verbatim"),
        sa.Column("recipient_email", sa.String(length=100), nullable=False,
                  comment="Denormalised so the trail survives account deletion"),
        sa.Column("status", sa.String(length=10), nullable=False, server_default="sent",
                  comment="sent | failed"),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Index("ix_user_messages_channel_source", "channel", "source_id"),
        mysql_engine="InnoDB", mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci",
    )


def downgrade() -> None:
    conn = op.get_bind()
    if _TABLE in _tables(conn):
        op.drop_table(_TABLE)
