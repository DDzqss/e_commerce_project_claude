"use client";

/**
 * 售后类型 icon —— 用短符号 + 中文标签展示。
 *
 * Icon 选型（Unicode / geometric）：
 *   - refund_only     ¥（人民币符）
 *   - return_refund   ↩（回旋箭头 + ¥）
 *   - exchange        ⇄（左右箭头）
 */

import { cn } from "@/lib/cn";
import {
  AFTERSALES_TYPE_LABEL,
  AftersalesType,
  type AftersalesType as AftersalesTypeType,
} from "@/types/aftersales";

const TYPE_META: Record<
  AftersalesTypeType,
  { icon: string; className: string; short: string }
> = {
  [AftersalesType.RefundOnly]: {
    icon: "¥",
    short: "仅退款",
    className: "bg-emerald-50 text-emerald-700",
  },
  [AftersalesType.ReturnRefund]: {
    icon: "↩",
    short: "退货退款",
    className: "bg-blue-50 text-[var(--color-primary)]",
  },
  [AftersalesType.Exchange]: {
    icon: "⇄",
    short: "换货",
    className: "bg-amber-50 text-amber-700",
  },
};

export interface AftersalesTypeIconProps {
  type: AftersalesTypeType;
  className?: string;
  /** 是否显示文字标签；默认 true */
  withLabel?: boolean;
}

export function AftersalesTypeIcon({
  type,
  className,
  withLabel = true,
}: AftersalesTypeIconProps) {
  const meta = TYPE_META[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        meta.className,
        className,
      )}
      aria-label={AFTERSALES_TYPE_LABEL[type]}
    >
      <span aria-hidden className="font-semibold">
        {meta.icon}
      </span>
      {withLabel ? <span>{meta.short}</span> : null}
    </span>
  );
}
