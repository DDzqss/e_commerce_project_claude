"use client";

import type { SPUStatus } from "@/types/api";
import { cn } from "@/lib/cn";

interface StatusMeta {
  text: string;
  className: string;
}

/** SPU 状态 → 中文文案 + 颜色映射（§4）。 */
export const SPU_STATUS_META: Record<SPUStatus, StatusMeta> = {
  draft: {
    text: "草稿",
    className: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  },
  pending_review: {
    text: "审核中",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  approved: {
    text: "已上架",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  rejected: {
    text: "已驳回",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
  off_shelf: {
    text: "已下架",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
};

export interface StatusBadgeProps {
  status: SPUStatus;
  className?: string;
}

/**
 * 商品状态徽章（列表 / 详情通用）。
 * 尺寸紧凑，颜色对应状态语义。
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = SPU_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        meta.className,
        className,
      )}
    >
      {meta.text}
    </span>
  );
}
