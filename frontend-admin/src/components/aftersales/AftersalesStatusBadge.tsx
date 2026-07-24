"use client";

/**
 * 售后状态徽章（12 态）。
 *
 * 契约 §5 状态机 12 态。色调分组：
 * - 待处理（橙）：pending_merchant_review / merchant_agreed_waiting_return / return_shipped_waiting_receive /
 *                 merchant_agreed_waiting_ship / exchange_shipped_waiting_receive
 * - 处理中（蓝）：refunding
 * - 待仲裁（红-warn）：admin_arbitrating
 * - 已完成（绿）：completed_refunded / completed_exchanged
 * - 已关闭（灰）：user_cancelled / system_closed / merchant_rejected
 */

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { AftersalesStatus } from "@/types/aftersales";

const AFTERSALES_STATUS_META: Record<
  AftersalesStatus,
  { label: string; tone: BadgeTone }
> = {
  pending_merchant_review: { label: "待商家审核", tone: "warning" },
  merchant_rejected: { label: "商家已驳回", tone: "default" },
  merchant_agreed_waiting_return: {
    label: "同意 · 待用户寄回",
    tone: "info",
  },
  return_shipped_waiting_receive: {
    label: "已寄回 · 待商家收货",
    tone: "info",
  },
  merchant_agreed_waiting_ship: {
    label: "已收货 · 待商家再发货",
    tone: "info",
  },
  exchange_shipped_waiting_receive: {
    label: "换货 · 待用户收货",
    tone: "info",
  },
  refunding: { label: "退款中", tone: "primary" },
  admin_arbitrating: { label: "平台仲裁中", tone: "danger" },
  completed_refunded: { label: "已完成 · 已退款", tone: "success" },
  completed_exchanged: { label: "已完成 · 已换货", tone: "success" },
  user_cancelled: { label: "用户已撤销", tone: "default" },
  system_closed: { label: "系统已关闭", tone: "default" },
};

export function AftersalesStatusBadge({
  status,
}: {
  status: AftersalesStatus;
}) {
  const meta = AFTERSALES_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function getAftersalesStatusLabel(status: AftersalesStatus): string {
  return AFTERSALES_STATUS_META[status].label;
}

/**
 * 供大盘 tab 使用的状态选项（含"全部"与虚拟 tab "待仲裁"）。
 *
 * "待仲裁"是 admin_arbitrating 状态的语义化名称，作为单独 tab 便于客服快速定位。
 * "arbitrated" 是虚拟聚合，不作为 tab（客服可通过筛选 arbitrator_admin_id 达到）。
 */
export const AFTERSALES_STATUS_OPTIONS: readonly {
  key: "all" | AftersalesStatus;
  label: string;
}[] = [
  { key: "all", label: "全部" },
  { key: "admin_arbitrating", label: "待仲裁" },
  { key: "pending_merchant_review", label: "待商家审核" },
  { key: "merchant_agreed_waiting_return", label: "待用户寄回" },
  { key: "return_shipped_waiting_receive", label: "待商家收货" },
  { key: "merchant_agreed_waiting_ship", label: "待商家再发货" },
  { key: "exchange_shipped_waiting_receive", label: "换货 · 待用户收货" },
  { key: "refunding", label: "退款中" },
  { key: "completed_refunded", label: "已退款" },
  { key: "completed_exchanged", label: "已换货" },
  { key: "merchant_rejected", label: "已驳回" },
  { key: "user_cancelled", label: "已撤销" },
  { key: "system_closed", label: "已关闭" },
];

/** 最终态判断（用于强制退款按钮 gating）。 */
export const TERMINAL_AFTERSALES_STATUSES: readonly AftersalesStatus[] = [
  "completed_refunded",
  "completed_exchanged",
  "user_cancelled",
  "system_closed",
];

export function isTerminal(status: AftersalesStatus): boolean {
  return TERMINAL_AFTERSALES_STATUSES.includes(status);
}
