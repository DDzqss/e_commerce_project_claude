"""Shipment event ORM model — contract §3.7.

Phase 3 is fully simulated: on merchant-ship the service inserts three
rows (picked_up / in_transit / delivered) offset a few hours apart.
Admins may append additional events via the "simulate logistics"
endpoint (contract §11).
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntId, IdMixin, TimestampMixin


class ShipmentEventType(enum.StrEnum):
    """Shipment event types (contract §3.7)."""

    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    ARRIVED_CITY = "arrived_city"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"


class ShipmentEvent(IdMixin, TimestampMixin, Base):
    """One point on a simulated shipment timeline."""

    __tablename__ = "shipment_events"

    order_id: Mapped[int] = mapped_column(
        BigIntId,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[ShipmentEventType] = mapped_column(
        Enum(
            ShipmentEventType,
            name="shipment_event_type",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (Index("ix_shipment_events_order_time", "order_id", "event_time"),)
