"""phase 2: products, catalog, inventory, uploads

Revision ID: 0002_phase2_products_catalog
Revises: 0001_phase1_auth_rbac_onboarding
Create Date: 2026-07-23

Creates the six Phase 2 tables:

- categories (hierarchical, self-referential FK)
- brands
- spus
- skus
- inventory_logs

Adds native Postgres enum types for spu_status, inventory_reason,
inventory_operator_type. Adds a placeholder ``sku_status`` is *not*
created — SKU active/inactive is a plain boolean per contract.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0002_phase2_products_catalog"
down_revision: str | None = "0001_phase1_auth_rbac_onboarding"
branch_labels: tuple[str, ...] | None = None
depends_on: tuple[str, ...] | None = None


# ---------------------------------------------------------------------------
# Native enum declarations
# ---------------------------------------------------------------------------
_spu_status = sa.Enum(
    "draft",
    "pending_review",
    "approved",
    "rejected",
    "off_shelf",
    name="spu_status",
)
_inventory_reason = sa.Enum(
    "purchase",
    "sale",
    "refund_return",
    "adjust",
    "initial",
    name="inventory_reason",
)
_inventory_operator_type = sa.Enum(
    "merchant",
    "admin",
    "system",
    name="inventory_operator_type",
)


def upgrade() -> None:
    bind = op.get_bind()
    _spu_status.create(bind, checkfirst=True)
    _inventory_reason.create(bind, checkfirst=True)
    _inventory_operator_type.create(bind, checkfirst=True)

    # ------------------------------------------------------------ categories
    op.create_table(
        "categories",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("parent_id", sa.BigInteger(), nullable=True),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("slug", sa.String(length=60), nullable=False),
        sa.Column("level", sa.SmallInteger(), nullable=False),
        sa.Column("path", sa.String(length=120), nullable=False),
        sa.Column("icon_url", sa.String(length=255), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "is_visible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["categories.id"],
            name="fk_categories_parent",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("slug", name="uq_categories_slug"),
        sa.CheckConstraint("level BETWEEN 1 AND 3", name="ck_categories_level_range"),
        sa.CheckConstraint(
            "(parent_id IS NULL AND level = 1) OR (parent_id IS NOT NULL AND level > 1)",
            name="ck_categories_parent_level_consistent",
        ),
    )
    op.create_index("ix_categories_parent_id", "categories", ["parent_id"], unique=False)
    op.create_index("ix_categories_path", "categories", ["path"], unique=False)
    op.create_index(
        "ix_categories_parent_sort",
        "categories",
        ["parent_id", "sort_order"],
        unique=False,
    )

    # ---------------------------------------------------------------- brands
    op.create_table(
        "brands",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("logo_url", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "is_visible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("name", name="uq_brands_name"),
        sa.UniqueConstraint("slug", name="uq_brands_slug"),
    )

    # ------------------------------------------------------------------- spus
    op.create_table(
        "spus",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("shop_id", sa.BigInteger(), nullable=False),
        sa.Column("category_id", sa.BigInteger(), nullable=False),
        sa.Column("brand_id", sa.BigInteger(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("subtitle", sa.String(length=200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("main_image", sa.String(length=255), nullable=False),
        sa.Column(
            "images",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "spec_axes",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "status",
            _spu_status,
            nullable=False,
            server_default=sa.text("'draft'"),
        ),
        sa.Column("reviewer_admin_id", sa.BigInteger(), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sales_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "min_price_cents",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "max_price_cents",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["shop_id"], ["shops.id"], name="fk_spus_shop", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name="fk_spus_category",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["brand_id"],
            ["brands.id"],
            name="fk_spus_brand",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_admin_id"],
            ["admin_users.id"],
            name="fk_spus_reviewer_admin",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_spus_shop_id", "spus", ["shop_id"], unique=False)
    op.create_index("ix_spus_category_id", "spus", ["category_id"], unique=False)
    op.create_index("ix_spus_brand_id", "spus", ["brand_id"], unique=False)
    op.create_index("ix_spus_shop_status", "spus", ["shop_id", "status"], unique=False)
    op.create_index("ix_spus_category_status", "spus", ["category_id", "status"], unique=False)
    op.create_index("ix_spus_brand_status", "spus", ["brand_id", "status"], unique=False)
    op.create_index(
        "ix_spus_status_published",
        "spus",
        ["status", "published_at"],
        unique=False,
    )

    # ------------------------------------------------------------------- skus
    op.create_table(
        "skus",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("spu_id", sa.BigInteger(), nullable=False),
        sa.Column("sku_code", sa.String(length=60), nullable=False),
        sa.Column(
            "specs",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("original_price_cents", sa.Integer(), nullable=True),
        sa.Column("stock", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "locked_stock",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("sold_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("image", sa.String(length=255), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["spu_id"], ["spus.id"], name="fk_skus_spu", ondelete="RESTRICT"),
        sa.UniqueConstraint("spu_id", "sku_code", name="uq_skus_spu_code"),
        sa.CheckConstraint("price_cents > 0", name="ck_skus_price_positive"),
        sa.CheckConstraint("stock >= 0", name="ck_skus_stock_non_negative"),
        sa.CheckConstraint("locked_stock >= 0", name="ck_skus_locked_stock_non_negative"),
    )
    op.create_index("ix_skus_spu_id", "skus", ["spu_id"], unique=False)
    op.create_index("ix_skus_spu_active", "skus", ["spu_id", "is_active"], unique=False)

    # ---------------------------------------------------------- inventory_logs
    op.create_table(
        "inventory_logs",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=False),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("reason", _inventory_reason, nullable=False),
        sa.Column("operator_type", _inventory_operator_type, nullable=False),
        sa.Column("operator_id", sa.BigInteger(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("related_order_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["sku_id"],
            ["skus.id"],
            name="fk_inventory_logs_sku",
            ondelete="RESTRICT",
        ),
    )
    op.create_index("ix_inventory_logs_sku_id", "inventory_logs", ["sku_id"], unique=False)
    op.create_index(
        "ix_inventory_logs_sku_created",
        "inventory_logs",
        ["sku_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_inventory_logs_sku_created", table_name="inventory_logs")
    op.drop_index("ix_inventory_logs_sku_id", table_name="inventory_logs")
    op.drop_table("inventory_logs")

    op.drop_index("ix_skus_spu_active", table_name="skus")
    op.drop_index("ix_skus_spu_id", table_name="skus")
    op.drop_table("skus")

    op.drop_index("ix_spus_status_published", table_name="spus")
    op.drop_index("ix_spus_brand_status", table_name="spus")
    op.drop_index("ix_spus_category_status", table_name="spus")
    op.drop_index("ix_spus_shop_status", table_name="spus")
    op.drop_index("ix_spus_brand_id", table_name="spus")
    op.drop_index("ix_spus_category_id", table_name="spus")
    op.drop_index("ix_spus_shop_id", table_name="spus")
    op.drop_table("spus")

    op.drop_table("brands")

    op.drop_index("ix_categories_parent_sort", table_name="categories")
    op.drop_index("ix_categories_path", table_name="categories")
    op.drop_index("ix_categories_parent_id", table_name="categories")
    op.drop_table("categories")

    bind = op.get_bind()
    _inventory_operator_type.drop(bind, checkfirst=True)
    _inventory_reason.drop(bind, checkfirst=True)
    _spu_status.drop(bind, checkfirst=True)
