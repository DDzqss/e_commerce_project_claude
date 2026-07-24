"""Aftersales evidence ORM model — contract §4.4.

Image evidence attached to a specific stage of an aftersales case
(apply / merchant_review / user_return / merchant_receive / exchange_ship
/ appeal / arbitration). ``image_url`` stores the MinIO object_key.
"""

from __future__ import annotations

import enum

from sqlalchemy import Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class AftersalesEvidenceStage(enum.StrEnum):
    """Which lifecycle stage the evidence attaches to (contract §4.4)."""

    APPLY = "apply"
    MERCHANT_REVIEW = "merchant_review"
    USER_RETURN = "user_return"
    MERCHANT_RECEIVE = "merchant_receive"
    EXCHANGE_SHIP = "exchange_ship"
    APPEAL = "appeal"
    ARBITRATION = "arbitration"


class AftersalesEvidenceUploaderType(enum.StrEnum):
    """Who uploaded the evidence."""

    USER = "user"
    MERCHANT = "merchant"
    ADMIN = "admin"


class AftersalesEvidence(IdMixin, TimestampMixin, Base):
    """A single image piece of evidence attached to an aftersales case."""

    __tablename__ = "aftersales_evidences"

    aftersales_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("aftersales.id", ondelete="CASCADE"),
        nullable=False,
    )
    uploader_type: Mapped[AftersalesEvidenceUploaderType] = mapped_column(
        Enum(
            AftersalesEvidenceUploaderType,
            name="aftersales_evidence_uploader_type",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    uploader_id: Mapped[int] = mapped_column(BigIntId, nullable=False)
    stage: Mapped[AftersalesEvidenceStage] = mapped_column(
        Enum(
            AftersalesEvidenceStage,
            name="aftersales_evidence_stage",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    image_url: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)

    __table_args__ = (Index("ix_aftersales_evidences_case_stage", "aftersales_id", "stage"),)
