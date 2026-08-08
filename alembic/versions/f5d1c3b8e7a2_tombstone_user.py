"""seed the tombstone user — the owner that purged financial and audit rows are repointed to

WHY THIS ROW HAS TO EXIST

Purging an account destroys the person but must not destroy the accounting. Six tables hold rows we
are keeping (decision Q1) whose ``user_id`` is **NOT NULL**, so they cannot simply lose their owner:

    orders                .user_id          RESTRICT, NOT NULL   financial
    billing_invoices      .user_id          CASCADE,  NOT NULL   financial
    subscription_events   .user_id          CASCADE,  NOT NULL   revenue reporting
    billing_consents      .user_id          CASCADE,  NOT NULL   legal evidence
    admin_operation_logs  .admin_user_id    RESTRICT             audit trail
    manual_takedowns      .admin_user_id    RESTRICT, NOT NULL   audit trail

The three CASCADE ones are the dangerous half: left alone, deleting the user would take every
invoice and subscription event with it — silently, as a side effect of the DELETE. Repointing them
at this row first is what makes them survive.

Everything else needs nothing: 15 foreign keys are already ``SET NULL`` (they anonymise themselves)
and 18 are ``CASCADE`` over data we intend to delete anyway.

The row is deliberately a real ``users`` record rather than a magic id — foreign keys have to point
at something that exists. It is inactive and has no password, so it cannot be signed into, and the
purge endpoint refuses to delete it.

Revision ID: f5d1c3b8e7a2
Revises: e2c7b9d4a5f1
Create Date: 2026-08-08
"""

import uuid as uuid_lib

from alembic import op
from sqlalchemy import text

revision = "f5d1c3b8e7a2"
down_revision = "e2c7b9d4a5f1"
branch_labels = None
depends_on = None

TOMBSTONE_EMAIL = "deleted@resomix.internal"
TOMBSTONE_USERNAME = "deleted_user"


def upgrade() -> None:
    conn = op.get_bind()

    existing = conn.execute(
        text("SELECT id FROM users WHERE email = :email"), {"email": TOMBSTONE_EMAIL}
    ).first()
    if existing:
        return

    # partner_id is NOT NULL and defaults to 1 ("Resomix System"), which is the right home for a
    # system-owned row. Read it rather than hardcoding, in case the seed differs.
    partner = conn.execute(text("SELECT MIN(id) FROM partners")).scalar() or 1

    conn.execute(
        text(
            """
            INSERT INTO users (uuid, username, email, password_hash, name,
                               is_active, is_email_verified, partner_id, created_at)
            VALUES (:uuid, :username, :email, NULL, :name,
                    0, 0, :partner_id, CURRENT_TIMESTAMP)
            """
        ),
        {
            "uuid": str(uuid_lib.uuid4()),
            "username": TOMBSTONE_USERNAME,
            "email": TOMBSTONE_EMAIL,
            "name": "Deleted user",
            "partner_id": partner,
        },
    )


def downgrade() -> None:
    # Only removable while nothing points at it. Once a purge has run, this row is the owner of
    # real financial records and deleting it would take them with it.
    conn = op.get_bind()
    referencing = conn.execute(
        text(
            """
            SELECT
              (SELECT COUNT(*) FROM orders o JOIN users u ON o.user_id = u.id
                 WHERE u.email = :email)
            + (SELECT COUNT(*) FROM billing_invoices b JOIN users u ON b.user_id = u.id
                 WHERE u.email = :email)
            """
        ),
        {"email": TOMBSTONE_EMAIL},
    ).scalar()
    if referencing:
        raise RuntimeError(
            f"Refusing to drop the tombstone user: {referencing} financial row(s) belong to it."
        )
    conn.execute(text("DELETE FROM users WHERE email = :email"), {"email": TOMBSTONE_EMAIL})
