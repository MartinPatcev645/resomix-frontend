"""create plans, features, plan_entitlements, entitlement_overrides

The data-driven entitlement backbone for frontend consumer users + guests. Additive and
guarded (safe to re-run). No data is seeded here — seeding is a separate idempotent script
(scripts/seed_entitlements.py) so limits can be re-tuned without new migrations.

Revision ID: e0a1b2c3d4e5
Revises: d9e0f1a2b3c4
Create Date: 2026-07-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision: str = "e0a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "d9e0f1a2b3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = DATABASE() AND table_name = :t"
            ),
            {"t": name},
        ).first()
    )


def upgrade() -> None:
    if not _table_exists("features"):
        op.create_table(
            "features",
            sa.Column("id", mysql.INTEGER(unsigned=True), autoincrement=True, primary_key=True),
            sa.Column("key", sa.String(64), nullable=False),
            sa.Column("name", sa.String(150), nullable=False),
            sa.Column("value_type", sa.String(20), nullable=False, server_default="int"),
            sa.Column("window", sa.String(20), nullable=False, server_default="none"),
            sa.Column("default_value", sa.String(255), nullable=False, server_default="0"),
            sa.Column("description", sa.String(512), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
            sa.UniqueConstraint("key", name="uq_features_key"),
            mysql_engine="InnoDB", mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci",
        )

    if not _table_exists("plans"):
        op.create_table(
            "plans",
            sa.Column("id", mysql.INTEGER(unsigned=True), autoincrement=True, primary_key=True),
            sa.Column("code", sa.String(50), nullable=False),
            sa.Column("name", sa.String(150), nullable=False),
            sa.Column("price_cents", mysql.INTEGER(unsigned=True), nullable=False, server_default="0"),
            sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
            sa.Column("billing_interval", sa.String(10), nullable=False, server_default="none"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("is_default", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("is_assignable", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("sort_order", mysql.SMALLINT(unsigned=True), nullable=False, server_default="0"),
            sa.Column("entitlements_version", mysql.INTEGER(unsigned=True), nullable=False, server_default="1"),
            sa.Column("updated_by", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
            sa.UniqueConstraint("code", name="uq_plans_code"),
            sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
            sa.Index("ix_plans_is_active", "is_active"),
            mysql_engine="InnoDB", mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci",
        )

    if not _table_exists("plan_entitlements"):
        op.create_table(
            "plan_entitlements",
            sa.Column("id", mysql.INTEGER(unsigned=True), autoincrement=True, primary_key=True),
            sa.Column("plan_id", mysql.INTEGER(unsigned=True), nullable=False),
            sa.Column("feature_id", mysql.INTEGER(unsigned=True), nullable=False),
            sa.Column("int_value", sa.Integer(), nullable=True),
            sa.Column("bool_value", sa.Boolean(), nullable=True),
            sa.Column("string_value", sa.String(255), nullable=True),
            sa.Column("updated_by", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
            sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["feature_id"], ["features.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
            sa.UniqueConstraint("plan_id", "feature_id", name="uq_plan_feature"),
            sa.Index("ix_plan_entitlements_plan", "plan_id"),
            sa.Index("ix_plan_entitlements_feature", "feature_id"),
            mysql_engine="InnoDB", mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci",
        )

    if not _table_exists("entitlement_overrides"):
        op.create_table(
            "entitlement_overrides",
            sa.Column("id", mysql.INTEGER(unsigned=True), autoincrement=True, primary_key=True),
            sa.Column("subject_type", sa.String(10), nullable=False),
            sa.Column("subject_id", sa.String(64), nullable=False),
            sa.Column("feature_id", mysql.INTEGER(unsigned=True), nullable=False),
            sa.Column("int_value", sa.Integer(), nullable=True),
            sa.Column("bool_value", sa.Boolean(), nullable=True),
            sa.Column("string_value", sa.String(255), nullable=True),
            sa.Column("reason", sa.String(255), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("created_by", mysql.INTEGER(unsigned=True), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
            sa.ForeignKeyConstraint(["feature_id"], ["features.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
            sa.Index("ix_entl_override_subject", "subject_type", "subject_id"),
            sa.Index("ix_entl_override_feature", "feature_id"),
            sa.Index("ix_entl_override_expires", "expires_at"),
            mysql_engine="InnoDB", mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci",
        )


def downgrade() -> None:
    # Drop in FK-safe order (children first).
    for tbl in ("entitlement_overrides", "plan_entitlements", "plans", "features"):
        if _table_exists(tbl):
            op.drop_table(tbl)
