"""User review-report endpoints — Phase 5 contract §5.1."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_user_agent, require_user_permission
from app.core.database import get_db
from app.core.errors import envelope
from app.core.rbac import Permission
from app.models.user import User
from app.schemas.review import ReviewReportIn
from app.services import review_report_service

router = APIRouter()


@router.post(
    "/reviews/{review_id}/report",
    status_code=status.HTTP_201_CREATED,
    summary="Report a review",
)
async def create_report(
    review_id: int,
    payload: ReviewReportIn,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(require_user_permission(Permission.USER_REVIEW_REPORT)),
) -> dict[str, Any]:
    row = await review_report_service.user_create(
        session,
        user,
        review_id,
        payload,
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    return envelope(data=row.model_dump(mode="json"))
