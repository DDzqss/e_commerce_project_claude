"use client";

/**
 * 订单状态徽章（Admin 端）。
 *
 * 契约 §4 状态机 6 态：pending_payment / paid / shipped / completed / cancelled / closed
 *
 * 与 merchant 端保持同风格：
 * - pending_payment 橙色 (等待支付)
 * - paid            蓝色 (已付款/待发货)
 * - shipped         主色 (已发货/在途)
 * - completed       绿色 (已完成)
 * - cancelled       红色 (已取消)
 * - closed          灰色 (售后关闭，Phase 3 未使用)
 */

import { Badge, type BadgeTone } from "./Badge";
import type { OrderStatus } from "@/types/order";

const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: BadgeTone }
> = {
  pending_payment: { label: "待支付", tone: "warning" },
  paid: { label: "待发货", tone: "info" },
  shipped: { label: "已发货", tone: "primary" },
  completed: { label: "已完成", tone: "success" },
  cancelled: { label: "已取消", tone: "danger" },
  closed: { label: "已关闭", tone: "default" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function getOrderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_META[status].label;
}

/**
 * 供大盘 tab 使用的状态选项（含"全部"）。
 */
export const ORDER_STATUS_OPTIONS: readonly {
  key: "all" | OrderStatus;
  label: string;
}[] = [
  { key: "all", label: "全部" },
  { key: "pending_payment", label: "待支付" },
  { key: "paid", label: "待发货" },
  { key: "shipped", label: "已发货" },
  { key: "completed", label: "已完成" },
  { key: "cancelled", label: "已取消" },
];
