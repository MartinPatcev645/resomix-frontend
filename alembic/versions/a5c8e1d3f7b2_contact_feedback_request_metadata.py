"""contacts / feedbacks — capture the IP and user agent of the submission

WHY

Neither table recorded anything about WHERE a submission came from. An admin looking at a contact
form saw the message and, for a signed-in user, an account — and for a guest, nothing beyond
whatever they typed into the form. That is thin for support and useless for abuse: two dozen
identical submissions were indistinguishable from two dozen different people.

Both columns are nullable and stay NULL for everything submitted before this. That is the honest
representation — we genuinely do not know, and backfilling from `system_logs` by timestamp would
be a guess presented as a fact.

`client_ip` is 45 characters to fit an IPv6 address; `user_agent` matches the width used by
`user_sessions`.

Revision ID: a5c8e1d3f7b2
Revises: e4a8d2f6b9c3
Create Date: 2026-08-08
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "a5c8e1d3f7b2"
down_revision = "e4a8d2f6b9c3"
branch_labels = None
depends_on = None

_COLUMNS = (
    ("client_ip", sa.String(length=45), "Originating IP, resolved through proxy headers"),
    ("user_agent", sa.String(length=500), "Browser string at submission"),
)


def _columns(conn, table: str) -> set:
    return {r[0] for r in conn.execute(text(f"SHOW COLUMNS FROM `{table}`")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()
    for table in ("contacts", "feedbacks"):
        existing = _columns(conn, table)
        for name, type_, comment in _COLUMNS:
            if name not in existing:
                op.add_column(table, sa.Column(name, type_, nullable=True, comment=comment))


def downgrade() -> None:
    conn = op.get_bind()
    for table in ("contacts", "feedbacks"):
        existing = _columns(conn, table)
        for name, _t, _c in reversed(_COLUMNS):
            if name in existing:
                op.drop_column(table, name)
