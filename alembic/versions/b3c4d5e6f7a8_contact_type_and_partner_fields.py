"""add contact_type + partner request fields to contacts

Adds a consumer/partner category plus the B2B partner-request fields (company name, estimated
catalog size, estimated monthly calls) so the /partners developer form can submit to the backend
(instead of a mailto:) and land in the same `contacts` table the consumer form uses. Idempotent:
each column is only added if missing, so re-running is safe.

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa


revision = "b3c4d5e6f7a8"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


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

    if not _has_column(bind, "contacts", "contact_type"):
        op.add_column(
            "contacts",
            sa.Column(
                "contact_type",
                sa.Enum("consumer", "partner", name="contact_type"),
                nullable=False,
                server_default="consumer",
            ),
        )
        op.create_index("ix_contacts_contact_type", "contacts", ["contact_type"])

    if not _has_column(bind, "contacts", "company_name"):
        op.add_column("contacts", sa.Column("company_name", sa.String(length=150), nullable=True))

    if not _has_column(bind, "contacts", "catalog_size"):
        op.add_column("contacts", sa.Column("catalog_size", sa.String(length=60), nullable=True))

    if not _has_column(bind, "contacts", "estimated_calls"):
        op.add_column("contacts", sa.Column("estimated_calls", sa.String(length=120), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()

    if _has_column(bind, "contacts", "estimated_calls"):
        op.drop_column("contacts", "estimated_calls")
    if _has_column(bind, "contacts", "catalog_size"):
        op.drop_column("contacts", "catalog_size")
    if _has_column(bind, "contacts", "company_name"):
        op.drop_column("contacts", "company_name")
    if _has_column(bind, "contacts", "contact_type"):
        try:
            op.drop_index("ix_contacts_contact_type", table_name="contacts")
        except Exception:
            pass
        op.drop_column("contacts", "contact_type")
