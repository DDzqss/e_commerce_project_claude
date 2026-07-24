"""Review reply ORM model — Phase 5 contract §3.2.

One merchant reply per review (enforced by UNIQUE(review_id)).
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class ReviewReply(IdMixin, TimestampMixin, Base):
    """A merchant's reply to a review."""

    __tablename__ = "review_replies"

    review_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("reviews.id", ondelete="CASCADE"),
        nullable=False,
    )
    merchant_account_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("merchant_accounts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    shop_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("shops.id", ondelete="RESTRICT"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(String(500), nullable=False)

    __table_args__ = (UniqueConstraint("review_id", name="uq_review_replies_review"),)
