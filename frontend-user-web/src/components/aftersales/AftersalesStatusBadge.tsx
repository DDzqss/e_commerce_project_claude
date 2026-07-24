"use client";

import { cn } from "@/lib/cn";
import {
  AFTERSALES_STATUS_LABEL,
  AftersalesStatus,
} from "@/types/aftersales";

/** 状态徽章色（Phase 4 状态 12 态）。 */
const STATUS_COLOR: Record<AftersalesStatus, string> = {
  [AftersalesStatus.PendingMerchantReview]:
    "text-amber-700 bg-amber-50 border-amber-200",
  [AftersalesStatus.MerchantRejected]:
    "text-neutral-700 bg-neutral-100 border-neutral-200",
  [AftersalesStatus.MerchantAgreedWaitingReturn]:
    "text-blue-700 bg-blue-50 border-blue-200",
  [AftersalesStatus.ReturnShippedWaitingReceive]:
    "text-blue-700 bg-blue-50 border-blue-200",
  [AftersalesStatus.MerchantAgreedWaitingShip]:
    "text-blue-700 bg-blue-50 border-blue-200",
  [AftersalesStatus.ExchangeShippedWaitingReceive]:
    "text-blue-700 bg-blue-50 border-blue-200",
  [AftersalesStatus.Refunding]:
    "text-indigo-700 bg-indigo-50 border-indigo-200",
  [AftersalesStatus.AdminArbitrating]:
    "text-[color:var(--color-primary-700)] bg-[color:var(--color-primary-50)] border-[color:var(--color-primary-200)]",
  [AftersalesStatus.CompletedRefunded]:
    "text-green-700 bg-green-50 border-green-200",
  [AftersalesStatus.CompletedExchanged]:
    "text-green-700 bg-green-50 border-green-200",
  [AftersalesStatus.UserCancelled]:
    "text-neutral-500 bg-neutral-100 border-neutral-200",
  [AftersalesStatus.SystemClosed]:
    "text-neutral-500 bg-neutral-100 border-neutral-200",
};

export interface AftersalesStatusBadgeProps {
  status: AftersalesStatus | string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** 12 态徽章：小(列表)、中(卡片)、大(详情头部)。 */
export function AftersalesStatusBadge({
  status,
  size = "sm",
  className,
}: AftersalesStatusBadgeProps) {
  const label =
    AFTERSALES_STATUS_LABEL[status as AftersalesStatus] ?? String(status);
  const color =
    STATUS_COLOR[status as AftersalesStatus] ??
    "text-neutral-600 bg-neutral-100 border-neutral-200";
  return (
    <span
      data-testid={`aftersales-status-${status}`}
      className={cn(
        "inline-flex items-center rounded border font-medium",
        color,
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        size === "lg" && "px-3 py-1.5 text-base",
        className,
      )}
    >
      {label}
    </span>
  );
}
