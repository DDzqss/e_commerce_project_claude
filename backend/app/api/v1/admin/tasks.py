"""Admin tasks endpoints — contract §12.

Currently only exposes a manual trigger for the timeout scanner so QA /
admins can smoke-test the pending-payment expiry and shipped→completed
flows without waiting for the cron.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.admin_user import AdminUser
from app.services import aftersales_service, order_service

router = APIRouter()


@router.post("/process-timeouts", summary="Run the timeout scanner once")
async def process_timeouts(
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_admin_permission(Permission.ADMIN_TASK_RUN)),
) -> dict[str, Any]:
    expired = await order_service.scan_and_expire_payments(session)
    completed = await order_service.scan_and_auto_complete(session)
    as_merchant_timeout = await aftersales_service.scan_merchant_review_timeouts(session)
    as_user_return_timeout = await aftersales_service.scan_user_return_timeouts(session)
    as_merchant_receive_timeout = await aftersales_service.scan_merchant_receive_timeouts(session)
    as_exchange_timeout = await aftersales_service.scan_exchange_confirm_timeouts(session)
    return envelope(
        data={
            "expired_pending_payments": expired,
            "auto_completed": completed,
            "aftersales_merchant_review_timeouts": as_merchant_timeout,
            "aftersales_user_return_timeouts": as_user_return_timeout,
            "aftersales_merchant_receive_timeouts": as_merchant_receive_timeout,
            "aftersales_exchange_confirm_timeouts": as_exchange_timeout,
        }
    )
