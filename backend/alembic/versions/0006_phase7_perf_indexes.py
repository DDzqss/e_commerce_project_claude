"""phase 7: performance composite indexes

Revision ID: 0006_phase7_perf_indexes
Revises: 0005_phase5_reviews_notifications_regions
Create Date: 2026-07-24

Adds composite indexes covering the hot-path list queries surfaced by the
Phase 7 audit. Every index is created with ``if_not_exists=True`` so the
migration is safe to re-run against a DB that already has partial coverage
from earlier phases or from an ad-hoc DBA session.

Rationale (query → index):

* ``catalog_service.list_spus`` filtering by category with newest sort —
  ``SELECT ... WHERE status='approved' AND category_id=? ORDER BY published_at DESC``
  → ``ix_spus_status_category_published`` (status, category_id, published_at)
* Same query with brand filter → ``ix_spus_status_brand_published``
* ``catalog_service.list_spus?sort=sales`` and ``list_related`` (which does
  ``ORDER BY sales_count DESC`` on approved rows) → ``ix_spus_status_sales``
* ``catalog_service.list_spus?sort=price_asc|price_desc`` → ``ix_spus_status_min_price``
* ``order_service.list_by_user`` with status filter (existing
  ``ix_orders_user_created`` only covers (user_id, created_at), not the
  common status filter) → ``ix_orders_user_status_created``
* ``notification_service.list_by_recipient`` with category filter — the
  existing ``ix_notifications_inbox`` only helps when ``is_read`` is the
  primary predicate; when the caller filters by ``category`` instead we
  need a dedicated composite → ``ix_notifications_recipient_category_created``

None of the indexes overlap with an existing definition in migrations
0001-0005 (verified by grepping ``op.create_index`` in the prior files).
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "0006_phase7_perf_indexes"
down_revision: str | None = "0005_phase5_reviews_notifications_regions"
branch_labels: tuple[str, ...] | None = None
depends_on: tuple[str, ...] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------- spus (4)
    op.create_index(
        "ix_spus_status_category_published",
        "spus",
        ["status", "category_id", "published_at"],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        "ix_spus_status_brand_published",
        "spus",
        ["status", "brand_id", "published_at"],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        "ix_spus_status_sales",
        "spus",
        ["status", "sales_count"],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        "ix_spus_status_min_price",
        "spus",
        ["status", "min_price_cents"],
        unique=False,
        if_not_exists=True,
    )

    # ----------------------------------------------------------- orders (1)
    op.create_index(
        "ix_orders_user_status_created",
        "orders",
        ["user_id", "status", "created_at"],
        unique=False,
        if_not_exists=True,
    )

    # ---------------------------------------------------- notifications (1)
    op.create_index(
        "ix_notifications_recipient_category_created",
        "notifications",
        ["recipient_type", "recipient_id", "category", "created_at"],
        unique=False,
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_notifications_recipient_category_created",
        table_name="notifications",
        if_exists=True,
    )
    op.drop_index("ix_orders_user_status_created", table_name="orders", if_exists=True)
    op.drop_index("ix_spus_status_min_price", table_name="spus", if_exists=True)
    op.drop_index("ix_spus_status_sales", table_name="spus", if_exists=True)
    op.drop_index("ix_spus_status_brand_published", table_name="spus", if_exists=True)
    op.drop_index("ix_spus_status_category_published", table_name="spus", if_exists=True)
