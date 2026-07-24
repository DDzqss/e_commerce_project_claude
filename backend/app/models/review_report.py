"""Review report ORM model — Phase 5 contract §3.3.

Users can report a review; admin then uphold / dismiss. Same user cannot
report the same review twice (UNIQUE(review_id, reporter_user_id)).
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class ReviewReportReasonCategory(enum.StrEnum):
    """Why the user is reporting the review."""

    AD_SPAM = "ad_spam"
    INAPPROPRIATE = "inappropriate"
    FAKE_REVIEW = "fake_review"
    OFFENSIVE = "offensive"
    IRRELEVANT = "irrelevant"
    OTHER = "other"


class ReviewReportStatus(enum.StrEnum):
    """Review-report lifecycle status."""

    PENDING = "pending"
    UPHELD = "upheld"
    DISMISSED = "dismissed"


class ReviewReport(IdMixin, TimestampMixin, Base):
    """A single "user reports one review" case."""

    __tablename__ = "review_reports"

    review_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("reviews.id", ondelete="CASCADE"),
        nullable=False,
    )
    reporter_user_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reason_category: Mapped[ReviewReportReasonCategory] = mapped_column(
        Enum(
            ReviewReportReasonCategory,
            name="review_report_reason_category",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    reason_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ReviewReportStatus] = mapped_column(
        Enum(
            ReviewReportStatus,
            name="review_report_status",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
        default=ReviewReportStatus.PENDING,
    )
    reviewer_admin_id: Mapped[int | None] = mapped_column(
        BigIntId,
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "review_id",
            "reporter_user_id",
            name="uq_review_reports_review_reporter",
        ),
        Index("ix_review_reports_status_created", "status", "created_at"),
    )
