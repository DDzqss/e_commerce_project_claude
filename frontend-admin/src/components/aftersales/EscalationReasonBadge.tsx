"use client";

/**
 * 升级原因徽章（5 种）。
 *
 * 契约 §4.1 + §8.3：`escalation_reason` 共 5 种值：
 * - merchant_timeout        商家 72h 未审核（系统升级）— 灰
 * - user_appeal             用户申诉（商家驳回后）— 蓝
 * - risk_flagged            风控命中（跳过商家审核）— 红
 * - manual                  客服手动升级 — 紫
 * - merchant_refuse_receive 商家拒收 — 橙
 */

import clsx from "clsx";
import type { EscalationReason } from "@/types/aftersales";

const REASON_META: Record<
  EscalationReason,
  { label: string; className: string }
> = {
  merchant_timeout: {
    label: "商家超时未审核",
    className:
      "bg-neutral-100 text-neutral-700 border-neutral-200",
  },
  user_appeal: {
    label: "用户申诉",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  risk_flagged: {
    label: "风控命中",
    className:
      "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] border-red-200",
  },
  manual: {
    label: "客服手动升级",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  merchant_refuse_receive: {
    label: "商家拒收",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

export function EscalationReasonBadge({
  reason,
  className,
}: {
  reason: EscalationReason;
  className?: string;
}) {
  const meta = REASON_META[reason];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
        meta.className,
        className,
      )}
      title={`升级原因：${meta.label}`}
    >
      {meta.label}
    </span>
  );
}

export function getEscalationReasonLabel(reason: EscalationReason): string {
  return REASON_META[reason].label;
}

/** 供筛选器使用的枚举 options。 */
export const ESCALATION_REASON_OPTIONS: readonly {
  value: EscalationReason;
  label: string;
}[] = (
  Object.entries(REASON_META) as ReadonlyArray<
    [EscalationReason, { label: string }]
  >
).map(([value, meta]) => ({ value, label: meta.label }));
