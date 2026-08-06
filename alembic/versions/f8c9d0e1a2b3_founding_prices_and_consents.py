"""pricing v2.1 — founding prices, subscription schedules, billing consents

Schema for Phase F. Three independent pieces:

1. ``plan_prices.price_kind`` — ``founding`` | ``list``.

   The unique key was ``(plan_id, interval, currency)``, so Pro could hold **one** monthly EUR
   price. The founding offer needs two at once: the €7.99 a buyer pays today, and the €9.99 the
   subscription schedule rolls onto in phase 2. The schedule cannot be created without the phase-2
   price already existing, so "add it later" is not available — both must coexist.

   The key becomes ``(plan_id, interval, currency, price_kind)``. Every existing row is ``list``,
   which is what they are: the prices on sale before a founding offer existed.

2. ``user_subscriptions`` — ``is_founding``, ``founding_lock_ends_at``, ``stripe_schedule_id``.

   Which rate someone signed up at, when their lock ends, and the schedule that enforces it. Kept
   locally because "am I still on the founding rate?" must be answerable without a Stripe round-trip
   — support asks it, and the profile screen shows it.

3. ``billing_consents`` — the EU immediate-access / 14-day-withdrawal waiver.

   An audit row, so it records what was agreed and when. **Never a boolean on the user**: consent is
   to a specific document version at a specific moment, and a flag cannot answer "which version did
   they accept?" a year later when someone asks.

Guarded and reversible: each step checks for its own presence, so a partial re-run cannot fail on
an object that is already there. Reserved words are backticked; every value is bound.

Revision ID: f8c9d0e1a2b3
Revises: e7b8c9d0f1a2
Create Date: 2026-08-06
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "f8c9d0e1a2b3"
down_revision = "e7b8c9d0f1a2"
branch_labels = None
depends_on = None

_OLD_UQ = "uq_plan_price_cycle_ccy"
_NEW_UQ = "uq_plan_price_cycle_ccy_kind"


def _columns(conn, table: str) -> set:
    rows = conn.execute(text(f"SHOW COLUMNS FROM `{table}`")).fetchall()
    return {r[0] for r in rows}


def _indexes(conn, table: str) -> set:
    rows = conn.execute(text(f"SHOW INDEX FROM `{table}`")).fetchall()
    return {r[2] for r in rows}


def _tables(conn) -> set:
    return {r[0] for r in conn.execute(text("SHOW TABLES")).fetchall()}


def upgrade() -> None:
    conn = op.get_bind()

    # ---------------------------------------------------------------- 1. price_kind
    if "price_kind" not in _columns(conn, "plan_prices"):
        op.add_column(
            "plan_prices",
            sa.Column(
                "price_kind",
                sa.String(length=10),
                nullable=False,
                server_default="list",
                comment="founding | list — which offer this price belongs to",
            ),
        )
    # Swap the unique key so a plan can hold a founding AND a list price for the same
    # interval+currency. Dropped first: the old key would reject the second row.
    indexes = _indexes(conn, "plan_prices")
    if _OLD_UQ in indexes:
        op.drop_constraint(_OLD_UQ, "plan_prices", type_="unique")
    if _NEW_UQ not in _indexes(conn, "plan_prices"):
        op.create_unique_constraint(
            _NEW_UQ, "plan_prices", ["plan_id", "interval", "currency", "price_kind"]
        )

    # ---------------------------------------------------------------- 2. subscription lock
    subscription_columns = _columns(conn, "user_subscriptions")
    if "is_founding" not in subscription_columns:
        op.add_column(
            "user_subscriptions",
            sa.Column(
                "is_founding",
                sa.Boolean(),
                nullable=False,
                server_default="0",
                comment="Signed up at the founding rate",
            ),
        )
    if "founding_lock_ends_at" not in subscription_columns:
        op.add_column(
            "user_subscriptions",
            sa.Column(
                "founding_lock_ends_at",
                sa.DateTime(),
                nullable=True,
                comment="When the founding rate rolls onto the list price",
            ),
        )
    if "stripe_schedule_id" not in subscription_columns:
        op.add_column(
            "user_subscriptions",
            sa.Column(
                "stripe_schedule_id",
                sa.String(length=255),
                nullable=True,
                comment="Stripe Subscription Schedule enforcing the founding lock",
            ),
        )

    # ---------------------------------------------------------------- 3. consents
    if "billing_consents" not in _tables(conn):
        op.create_table(
            "billing_consents",
            sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False, index=True),
            # 'withdrawal_waiver' today; a column rather than an enum so a new consent type is a
            # data change, not a migration.
            sa.Column("consent_type", sa.String(length=40), nullable=False),
            # WHICH documents were agreed to. A bare "they consented" is worthless in a dispute a
            # year later, when the terms have been revised twice.
            sa.Column("doc_versions", sa.String(length=60), nullable=False),
            sa.Column("ip", sa.String(length=45), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Index("idx_user_type", "user_id", "consent_type"),
            mysql_engine="InnoDB",
            mysql_charset="utf8mb4",
            mysql_collate="utf8mb4_unicode_ci",
        )


def downgrade() -> None:
    conn = op.get_bind()

    if "billing_consents" in _tables(conn):
        op.drop_table("billing_consents")

    subscription_columns = _columns(conn, "user_subscriptions")
    for column in ("stripe_schedule_id", "founding_lock_ends_at", "is_founding"):
        if column in subscription_columns:
            op.drop_column("user_subscriptions", column)

    indexes = _indexes(conn, "plan_prices")
    if _NEW_UQ in indexes:
        op.drop_constraint(_NEW_UQ, "plan_prices", type_="unique")
    # Only restorable if no plan actually holds two kinds for one interval+currency — which is the
    # state this migration exists to allow. Delete the founding rows first if you need to go back.
    if _OLD_UQ not in _indexes(conn, "plan_prices"):
        op.create_unique_constraint(_OLD_UQ, "plan_prices", ["plan_id", "interval", "currency"])
    if "price_kind" in _columns(conn, "plan_prices"):
        op.drop_column("plan_prices", "price_kind")
