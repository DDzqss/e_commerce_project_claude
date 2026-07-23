"use client";

/**
 * 商品状态徽章（SPU 5 态）。
 *
 * 与 merchant 端保持同风格：draft(灰) / pending_review(橙) / approved(绿) /
 * rejected(红) / off_shelf(灰蓝)。
 *
 * 复用 Badge 基础组件，仅做状态 → tone/label 映射。
 */

import { Badge, type BadgeTone } from "./Badge";
import type { SPUStatus } from "@/types/api";

const SPU_STATUS_META: Record<SPUStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "草稿", tone: "default" },
  pending_review: { label: "待审核", tone: "warning" },
  approved: { label: "已上架", tone: "success" },
  rejected: { label: "已驳回", tone: "danger" },
  off_shelf: { label: "已下架", tone: "primary" },
};

export function StatusBadge({ status }: { status: SPUStatus }) {
  const meta = SPU_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function getSPUStatusLabel(status: SPUStatus): string {
  return SPU_STATUS_META[status].label;
}
