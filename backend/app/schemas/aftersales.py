"""Aftersales schemas — Phase 4 contract §7 / §8 / §9."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.aftersales import (
    AftersalesArbitrationOutcome,
    AftersalesCloseReason,
    AftersalesEscalationReason,
    AftersalesReasonCategory,
    AftersalesStatus,
    AftersalesType,
)
from app.models.aftersales_evidence import (
    AftersalesEvidenceStage,
    AftersalesEvidenceUploaderType,
)
from app.models.aftersales_message import (
    AftersalesMessageKind,
    AftersalesMessageSenderType,
)


# ---------------------------------------------------------------------------
# Item / evidence / history / message projections
# ---------------------------------------------------------------------------
class AftersalesItemIn(BaseModel):
    """One line the user wants to include in the aftersales case."""

    order_item_id: int = Field(ge=1)
    quantity: int = Field(ge=1)


class AftersalesItemOut(BaseModel):
    """Projection of one ``aftersales_items`` row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    aftersales_id: int
    order_item_id: int
    quantity: int
    refund_amount_cents: int


class AftersalesEvidenceIn(BaseModel):
    """Add-evidence payload."""

    stage: AftersalesEvidenceStage
    image_key: str = Field(min_length=1, max_length=255)
    note: str | None = Field(default=None, max_length=200)


class AftersalesEvidenceOut(BaseModel):
    """Projection of one ``aftersales_evidences`` row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    aftersales_id: int
    uploader_type: AftersalesEvidenceUploaderType
    uploader_id: int
    stage: AftersalesEvidenceStage
    image_url: str
    note: str | None = None
    created_at: datetime


class AftersalesStatusHistoryOut(BaseModel):
    """Projection of one ``aftersales_status_history`` row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    aftersales_id: int
    from_status: str | None = None
    to_status: str
    actor_type: str
    actor_id: int | None = None
    note: str | None = None
    created_at: datetime


class AftersalesMessageOut(BaseModel):
    """Projection of one ``aftersales_messages`` row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    aftersales_id: int
    sender_type: AftersalesMessageSenderType
    sender_id: int | None = None
    kind: AftersalesMessageKind
    content: str
    created_at: datetime


# ---------------------------------------------------------------------------
# User payloads
# ---------------------------------------------------------------------------
class AftersalesCreateIn(BaseModel):
    """User creates a new aftersales case."""

    type: AftersalesType
    reason_category: AftersalesReasonCategory
    reason_note: str = Field(min_length=10, max_length=500)
    items: list[AftersalesItemIn] = Field(min_length=1)
    refund_amount_cents: int = Field(ge=0)
    evidence_image_keys: list[str] = Field(default_factory=list, max_length=8)


class AftersalesCancelIn(BaseModel):
    """User cancels an in-flight aftersales case."""

    cancel_note: str | None = Field(default=None, max_length=500)


class AftersalesSubmitTrackingIn(BaseModel):
    """User submits return-shipment tracking info."""

    carrier: str = Field(min_length=1, max_length=60)
    tracking_no: str = Field(min_length=4, max_length=60)


class AftersalesAppealIn(BaseModel):
    """User appeals after a merchant rejection."""

    reason: str = Field(min_length=20, max_length=500)
    evidence_image_keys: list[str] = Field(default_factory=list, max_length=8)


class AftersalesNudgeOut(BaseModel):
    """Result of a user nudge."""

    nudge_count: int
    last_nudged_at: datetime


# ---------------------------------------------------------------------------
# Merchant payloads
# ---------------------------------------------------------------------------
class AftersalesMerchantApproveIn(BaseModel):
    """Merchant approves the case."""

    actual_refund_cents: int = Field(ge=0)
    return_address: str | None = Field(default=None, max_length=400)
    review_note: str | None = Field(default=None, max_length=500)


class AftersalesMerchantRejectIn(BaseModel):
    """Merchant rejects the case (≥ 5 chars)."""

    review_note: str = Field(min_length=5, max_length=500)


class AftersalesConfirmReceiveIn(BaseModel):
    """Merchant confirms return package received."""

    note: str | None = Field(default=None, max_length=500)
    evidence_image_keys: list[str] = Field(default_factory=list, max_length=8)


class AftersalesRefuseReceiveIn(BaseModel):
    """Merchant refuses the returned package (auto-escalates)."""

    refuse_note: str = Field(min_length=10, max_length=500)
    evidence_image_keys: list[str] = Field(default_factory=list, max_length=8)


class AftersalesShipExchangeIn(BaseModel):
    """Merchant re-ships (EXCHANGE)."""

    carrier: str = Field(min_length=1, max_length=60)
    tracking_no: str = Field(min_length=4, max_length=60)


class AftersalesNoteIn(BaseModel):
    """Merchant / admin note update."""

    note: str = Field(min_length=1, max_length=500)


# ---------------------------------------------------------------------------
# Admin payloads
# ---------------------------------------------------------------------------
class AftersalesResolveIn(BaseModel):
    """Admin arbitration verdict."""

    outcome: AftersalesArbitrationOutcome
    conclusion: str = Field(min_length=20, max_length=1000)
    actual_refund_cents: int | None = Field(default=None, ge=0)
    evidence_image_keys: list[str] = Field(default_factory=list, max_length=8)


class AftersalesForceRefundIn(BaseModel):
    """Admin force-refund override."""

    amount_cents: int = Field(ge=1)
    note: str = Field(min_length=1, max_length=500)


# ---------------------------------------------------------------------------
# Detail / list output
# ---------------------------------------------------------------------------
class AftersalesListItemOut(BaseModel):
    """Projection for list responses (no nested items detail)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    aftersales_no: str
    order_id: int
    user_id: int
    shop_id: int
    type: AftersalesType
    status: AftersalesStatus
    reason_category: AftersalesReasonCategory
    reason_note: str
    refund_amount_cents: int
    actual_refund_cents: int | None = None
    merchant_review_deadline: datetime
    escalated_at: datetime | None = None
    escalation_reason: AftersalesEscalationReason | None = None
    arbitrator_admin_id: int | None = None
    nudge_count: int
    appeal_count: int
    created_at: datetime
    updated_at: datetime


class AftersalesDetailOut(AftersalesListItemOut):
    """Full case detail including items + history + evidences + messages."""

    merchant_reviewed_at: datetime | None = None
    merchant_review_note: str | None = None
    return_address: str | None = None
    return_carrier: str | None = None
    return_tracking_no: str | None = None
    return_shipped_at: datetime | None = None
    return_ship_deadline: datetime | None = None
    merchant_received_at: datetime | None = None
    merchant_receive_deadline: datetime | None = None
    merchant_refuse_receive: bool = False
    merchant_refuse_note: str | None = None
    exchange_carrier: str | None = None
    exchange_tracking_no: str | None = None
    exchange_shipped_at: datetime | None = None
    exchange_confirm_deadline: datetime | None = None
    exchange_confirmed_at: datetime | None = None
    arbitrated_at: datetime | None = None
    arbitration_conclusion: str | None = None
    arbitration_outcome: AftersalesArbitrationOutcome | None = None
    refunded_at: datetime | None = None
    refund_txn_no: str | None = None
    closed_at: datetime | None = None
    close_reason: AftersalesCloseReason | None = None
    last_nudged_at: datetime | None = None
    items: list[AftersalesItemOut] = Field(default_factory=list)
    status_history: list[AftersalesStatusHistoryOut] = Field(default_factory=list)
    evidences: list[AftersalesEvidenceOut] = Field(default_factory=list)
    messages: list[AftersalesMessageOut] = Field(default_factory=list)


class AftersalesStatsOverviewOut(BaseModel):
    """Admin work-station overview (contract §9.6)."""

    pending_review_count: int
    escalated_pending_count: int
    in_progress_count: int
    resolved_today_count: int
    avg_resolution_hours: float


class MerchantAftersalesStatsOut(BaseModel):
    """Merchant dashboard summary for the current shop."""

    pending_review_count: int
    overdue_soon_count: int
    waiting_receive_count: int
    waiting_ship_count: int
    completed_this_month_count: int


__all__ = [
    "AftersalesAppealIn",
    "AftersalesCancelIn",
    "AftersalesConfirmReceiveIn",
    "AftersalesCreateIn",
    "AftersalesDetailOut",
    "AftersalesEvidenceIn",
    "AftersalesEvidenceOut",
    "AftersalesForceRefundIn",
    "AftersalesItemIn",
    "AftersalesItemOut",
    "AftersalesListItemOut",
    "AftersalesMerchantApproveIn",
    "AftersalesMerchantRejectIn",
    "AftersalesMessageOut",
    "AftersalesNoteIn",
    "AftersalesNudgeOut",
    "AftersalesRefuseReceiveIn",
    "AftersalesResolveIn",
    "AftersalesShipExchangeIn",
    "AftersalesStatsOverviewOut",
    "AftersalesStatusHistoryOut",
    "AftersalesSubmitTrackingIn",
    "MerchantAftersalesStatsOut",
]
