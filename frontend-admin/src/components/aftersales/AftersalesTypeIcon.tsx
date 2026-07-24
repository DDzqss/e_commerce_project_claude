"use client";

/**
 * 售后类型图标（3 种）。
 *
 * 契约 §2 三种类型：
 * - refund_only    仅退款   💴  (蓝)
 * - return_refund  退货退款  ↩️  (橙)
 * - exchange       换货     🔁  (紫)
 *
 * 使用纯 emoji + 中文标签，避免额外图标依赖；同时兼容 aria-label。
 */

import clsx from "clsx";
import type { AftersalesType } from "@/types/aftersales";

const TYPE_META: Record<
  AftersalesType,
  { label: string; icon: string; className: string }
> = {
  refund_only: {
    label: "仅退款",
    icon: "¥",
    className:
      "bg-blue-50 text-blue-700 border-blue-200",
  },
  return_refund: {
    label: "退货退款",
    icon: "⟲",
    className:
      "bg-amber-50 text-amber-700 border-amber-200",
  },
  exchange: {
    label: "换货",
    icon: "⇄",
    className:
      "bg-purple-50 text-purple-700 border-purple-200",
  },
};

export function AftersalesTypeIcon({
  type,
  showLabel = true,
  className,
}: {
  type: AftersalesType;
  showLabel?: boolean;
  className?: string;
}) {
  const meta = TYPE_META[type];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium",
        meta.className,
        className,
      )}
      aria-label={`售后类型：${meta.label}`}
      title={meta.label}
    >
      <span aria-hidden className="text-sm leading-none">
        {meta.icon}
      </span>
      {showLabel ? <span>{meta.label}</span> : null}
    </span>
  );
}

export function getAftersalesTypeLabel(type: AftersalesType): string {
  return TYPE_META[type].label;
}
