"""Shipment schemas — contract §10.3 / §11."""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator

from app.models.shipment_event import ShipmentEventType

_TRACKING_NO_RE = re.compile(r"^[A-Za-z0-9]{6,30}$")


class ShipIn(BaseModel):
    """Merchant ship-order payload."""

    carrier: str = Field(min_length=1, max_length=60)
    tracking_no: str = Field(min_length=6, max_length=30)

    @field_validator("tracking_no")
    @classmethod
    def _check_tracking_no(cls, v: str) -> str:
        stripped = v.strip()
        if not _TRACKING_NO_RE.match(stripped):
            raise ValueError("tracking_no must be 6-30 alphanumeric chars")
        return stripped


class LogisticsSimulateIn(BaseModel):
    """Admin simulate-logistics payload."""

    event_type: ShipmentEventType
    description: str = Field(min_length=1, max_length=200)


__all__ = ["LogisticsSimulateIn", "ShipIn"]
