"use client";

import { cn } from "@/lib/cn";
import { AFTERSALES_TYPE_LABEL, AftersalesType } from "@/types/aftersales";

interface AftersalesTypeIconProps {
  type: AftersalesType | string;
  size?: number;
  showLabel?: boolean;
  className?: string;
}

/**
 * 售后类型图标：refund_only（钞票）/ return_refund（回流）/ exchange（互换）。
 * SVG 内联，无依赖；showLabel=true 时旁边跟中文文字。
 */
export function AftersalesTypeIcon({
  type,
  size = 16,
  showLabel = false,
  className,
}: AftersalesTypeIconProps) {
  const label =
    AFTERSALES_TYPE_LABEL[type as AftersalesType] ?? String(type);
  const color =
    type === AftersalesType.RefundOnly
      ? "text-emerald-600"
      : type === AftersalesType.ReturnRefund
        ? "text-sky-600"
        : type === AftersalesType.Exchange
          ? "text-violet-600"
          : "text-neutral-500";

  return (
    <span
      data-testid={`aftersales-type-${type}`}
      className={cn(
        "inline-flex items-center gap-1 align-middle",
        color,
        className,
      )}
    >
      {renderIcon(type as AftersalesType, size)}
      {showLabel && <span className="text-xs font-medium">{label}</span>}
    </span>
  );
}

function renderIcon(type: AftersalesType, size: number) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (type) {
    case AftersalesType.RefundOnly:
      // 钞票 + 环形箭头
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="1.5" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M7 9v.01M17 15v.01" />
        </svg>
      );
    case AftersalesType.ReturnRefund:
      // 箱子 + 回流箭头
      return (
        <svg {...common}>
          <path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" />
          <path d="M9 14l-2 2 2 2" />
          <path d="M7 16h8a3 3 0 003-3v-1" />
        </svg>
      );
    case AftersalesType.Exchange:
      // 上下双箭头
      return (
        <svg {...common}>
          <path d="M7 3v14M7 3l-3 3M7 3l3 3" />
          <path d="M17 21V7M17 21l-3-3M17 21l3-3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
