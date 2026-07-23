"use client";

import { cn } from "@/lib/cn";
import {
  ORDER_STATUS_LABEL,
  OrderStatus,
  type OrderStatus as OrderStatusType,
} from "@/types/order";

interface StatusMeta {
  className: string;
}

/**
 * 订单 6 态徽章样式映射。
 * 颜色语义与 SPU StatusBadge 保持一致（success=emerald / warning=amber / danger=red 等）。
 */
const ORDER_STATUS_META: Record<OrderStatusType, StatusMeta> = {
  [OrderStatus.PendingPayment]: {
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  [OrderStatus.Paid]: {
    className: "bg-blue-50 text-[var(--color-primary)] ring-blue-200",
  },
  [OrderStatus.Shipped]: {
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  [OrderStatus.Completed]: {
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  [OrderStatus.Cancelled]: {
    className: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  },
  [OrderStatus.Closed]: {
    className: "bg-slate-100 text-slate-500 ring-slate-200",
  },
};

export interface OrderStatusBadgeProps {
  status: OrderStatusType;
  className?: string;
  /** 尺寸：md（默认，列表用） / lg（详情页顶部用） */
  size?: "sm" | "md" | "lg";
}

/** 订单状态徽章：6 态，颜色语义清晰。 */
export function OrderStatusBadge({
  status,
  className,
  size = "md",
}: OrderStatusBadgeProps) {
  const meta = ORDER_STATUS_META[status];
  const sizeClass =
    size === "lg"
      ? "px-3 py-1 text-sm"
      : size === "sm"
        ? "px-1.5 py-0.5 text-[10px]"
        : "px-2 py-0.5 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-medium ring-1 ring-inset",
        meta.className,
        sizeClass,
        className,
      )}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
