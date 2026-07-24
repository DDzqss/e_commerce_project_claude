"use client";

/**
 * 售后状态徽章（12 态）。
 *
 * 与 OrderStatusBadge 保持样式一致：
 *   - success（emerald）— 完成态
 *   - warning（amber）— 待处理
 *   - info（sky/blue）— 进行中
 *   - danger（red）— 仲裁/驳回
 *   - neutral（slate）— 关闭 / 撤销
 */

import { cn } from "@/lib/cn";
import {
  AFTERSALES_STATUS_LABEL,
  AftersalesStatus,
  type AftersalesStatus as AftersalesStatusType,
} from "@/types/aftersales";

interface StatusMeta {
  className: string;
}

const STATUS_META: Record<AftersalesStatusType, StatusMeta> = {
  [AftersalesStatus.PendingMerchantReview]: {
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  [AftersalesStatus.MerchantRejected]: {
    className: "bg-red-50 text-red-700 ring-red-200",
  },
  [AftersalesStatus.MerchantAgreedWaitingReturn]: {
    className: "bg-blue-50 text-[var(--color-primary)] ring-blue-200",
  },
  [AftersalesStatus.ReturnShippedWaitingReceive]: {
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  [AftersalesStatus.MerchantAgreedWaitingShip]: {
    className: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  },
  [AftersalesStatus.ExchangeShippedWaitingReceive]: {
    className: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  },
  [AftersalesStatus.Refunding]: {
    className: "bg-purple-50 text-purple-700 ring-purple-200",
  },
  [AftersalesStatus.AdminArbitrating]: {
    className: "bg-red-50 text-red-700 ring-red-200",
  },
  [AftersalesStatus.CompletedRefunded]: {
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  [AftersalesStatus.CompletedExchanged]: {
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  [AftersalesStatus.UserCancelled]: {
    className: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  },
  [AftersalesStatus.SystemClosed]: {
    className: "bg-slate-100 text-slate-500 ring-slate-200",
  },
};

export interface AftersalesStatusBadgeProps {
  status: AftersalesStatusType;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function AftersalesStatusBadge({
  status,
  className,
  size = "md",
}: AftersalesStatusBadgeProps) {
  const meta = STATUS_META[status];
  const sizeClass =
    size === "lg"
      ? "px-3 py-1 text-sm"
      : size === "sm"
        ? "px-1.5 py-0.5 text-[10px]"
        : "px-2 py-0.5 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-medium ring-1 ring-inset whitespace-nowrap",
        meta.className,
        sizeClass,
        className,
      )}
    >
      {AFTERSALES_STATUS_LABEL[status]}
    </span>
  );
}
