"""add partner qualification fields to contacts

The /partners contact form was reworked: it now asks for role, partner type, preferred path and a
free-text catalogue/product context. Those used to be flattened into the `message` blob (as a
"PARTNER INQUIRY" preamble), which meant admin could not filter, sort or read them as data.

This adds one column per question so the submission is stored structurally, the same way
`company_name` / `catalog_size` already are. All nullable — consumer contacts (/contact) never set
them, and the /partners-pilot form fills only the subset it asks for.

Nothing is dropped: `catalog_size` is still collected by the pilot form, and `estimated_calls` is
kept for historical rows even though no current form collects it.

Idempotent: each column is only added if missing, so re-running is safe.

Revision ID: a2d3f4b5c6e7
Revises: c3e4f5a6b7d8
Create Date: 2026-07-30
"""
from alembic import op
import sqlalchemy as sa


revision = "a2d3f4b5c6e7"
down_revision = "c3e4f5a6b7d8"
branch_labels = None
depends_on = None


# column name -> type, in the order they should sit on the table
NEW_COLUMNS = (
    ("role", sa.String(length=120)),
    ("partner_type", sa.String(length=80)),
    ("preferred_path", sa.String(length=80)),
    ("catalog_context", sa.String(length=255)),
)


def _has_column(bind, table: str, column: str) -> bool:
    row = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).scalar()
    return bool(row)


def upgrade() -> None:
    bind = op.get_bind()

    for name, type_ in NEW_COLUMNS:
        if not _has_column(bind, "contacts", name):
            op.add_column("contacts", sa.Column(name, type_, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()

    for name, _type in reversed(NEW_COLUMNS):
        if _has_column(bind, "contacts", name):
            op.drop_column("contacts", name)
