"""Review / review-reply / review-report schemas — Phase 5 contract §4-§5."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.review_report import ReviewReportReasonCategory, ReviewReportStatus

_MIN_CONTENT = 5
_MAX_CONTENT = 2000
_MAX_IMAGES = 6
_MIN_RATING = 1
_MAX_RATING = 5
_MIN_REPLY = 5
_MAX_REPLY = 500
_MAX_HIDE_REASON = 500
_MAX_REPORT_NOTE = 500


# ---------------------------------------------------------------------------
# Review
# ---------------------------------------------------------------------------
class ReviewItemIn(BaseModel):
    """Single order-item review payload inside the batch."""

    order_item_id: int = Field(ge=1)
    rating: int = Field(ge=_MIN_RATING, le=_MAX_RATING)
    content: str = Field(min_length=_MIN_CONTENT, max_length=_MAX_CONTENT)
    images: list[str] = Field(default_factory=list, max_length=_MAX_IMAGES)
    is_anonymous: bool = False


class ReviewCreateBatchIn(BaseModel):
    """Batch-create: one API call may cover multiple items of the same order."""

    reviews: list[ReviewItemIn] = Field(min_length=1, max_length=20)


class ReviewUpdateIn(BaseModel):
    """Edit an existing review inside the 15-day window (once)."""

    rating: int | None = Field(default=None, ge=_MIN_RATING, le=_MAX_RATING)
    content: str | None = Field(default=None, min_length=_MIN_CONTENT, max_length=_MAX_CONTENT)
    images: list[str] | None = Field(default=None, max_length=_MAX_IMAGES)

    @model_validator(mode="after")
    def _at_least_one(self) -> ReviewUpdateIn:
        if self.rating is None and self.content is None and self.images is None:
            raise ValueError("at least one of rating/content/images required")
        return self


class ReviewReplyBrief(BaseModel):
    """Merchant reply projection embedded in a Review row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    shop_id: int
    merchant_account_id: int
    created_at: datetime
    updated_at: datetime


class ReviewOut(BaseModel):
    """A single review projection."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    order_item_id: int
    user_id: int
    user_display_name: str | None = None  # "匿***名" when anonymous
    spu_id: int
    sku_id: int
    shop_id: int
    rating: int
    content: str
    images: list[str] = Field(default_factory=list)
    is_anonymous: bool
    visible: bool
    hidden_reason: str | None = None
    edit_count: int
    edit_deadline_at: datetime
    created_at: datetime
    updated_at: datetime
    reply: ReviewReplyBrief | None = None


class ReviewRatingSummary(BaseModel):
    """Aggregation over a list of visible reviews."""

    avg: float
    count: int
    distribution: dict[int, int] = Field(default_factory=dict)


class ReviewListOut(BaseModel):
    items: list[ReviewOut]
    total: int
    page: int
    size: int
    summary: ReviewRatingSummary | None = None


class AdminReviewHideIn(BaseModel):
    hidden_reason: str = Field(min_length=5, max_length=_MAX_HIDE_REASON)


# ---------------------------------------------------------------------------
# Review reply
# ---------------------------------------------------------------------------
class ReviewReplyIn(BaseModel):
    content: str = Field(min_length=_MIN_REPLY, max_length=_MAX_REPLY)


class ReviewReplyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    review_id: int
    merchant_account_id: int
    shop_id: int
    content: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Review report
# ---------------------------------------------------------------------------
class ReviewReportIn(BaseModel):
    reason_category: ReviewReportReasonCategory
    reason_note: str | None = Field(default=None, max_length=_MAX_REPORT_NOTE)


class ReviewReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    review_id: int
    reporter_user_id: int
    reason_category: ReviewReportReasonCategory
    reason_note: str | None = None
    status: ReviewReportStatus
    reviewer_admin_id: int | None = None
    review_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AdminReportHandleIn(BaseModel):
    review_note: str | None = Field(default=None, max_length=1000)


__all__ = [
    "AdminReportHandleIn",
    "AdminReviewHideIn",
    "ReviewCreateBatchIn",
    "ReviewItemIn",
    "ReviewListOut",
    "ReviewOut",
    "ReviewRatingSummary",
    "ReviewReplyBrief",
    "ReviewReplyIn",
    "ReviewReplyOut",
    "ReviewReportIn",
    "ReviewReportOut",
    "ReviewUpdateIn",
]
