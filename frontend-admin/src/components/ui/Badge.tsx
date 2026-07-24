"use client";

/**
 * 状态徽章。
 *
 * 商家入驻申请 4 状态色：
 * - pending    橙色  = 待处理
 * - approved   绿色  = 已通过
 * - rejected   红色  = 已驳回
 * - withdrawn  灰色  = 已撤回
 *
 * 也支持 tone prop 直接指定色调，用于其他场景（如 admin/user/shop 状态）。
 */

import type { ReactNode } from "react";
import clsx from "clsx";
import type { MerchantApplicationStatus } from "@/types/api";

export type BadgeTone =
  | "default"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  default: "bg-neutral-100 text-neutral-700 border-neutral-200",
  primary:
    "bg-[color:var(--color-primary-100)] text-[color:var(--color-primary-800)] border-[color:var(--color-primary-200)]",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger:
    "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] border-red-200",
};

export function Badge({ tone = "default", children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 商家入驻申请状态徽章
// ---------------------------------------------------------------------------

const APPLICATION_STATUS_META: Record<
  MerchantApplicationStatus,
  { label: string; tone: BadgeTone }
> = {
  pending: { label: "待审核", tone: "warning" },
  approved: { label: "已通过", tone: "success" },
  rejected: { label: "已驳回", tone: "danger" },
  withdrawn: { label: "已撤回", tone: "default" },
};

export function ApplicationStatusBadge({
  status,
}: {
  status: MerchantApplicationStatus;
}) {
  const meta = APPLICATION_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function getApplicationStatusLabel(
  status: MerchantApplicationStatus,
): string {
  return APPLICATION_STATUS_META[status].label;
}
