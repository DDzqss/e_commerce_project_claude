"use client";

/**
 * Admin 订单相关 React Query hooks。
 *
 * 契约 §11：
 * - useAdminOrders — GET /admin/orders 列表（含多筛选）
 * - useAdminOrder  — GET /admin/orders/{id} 详情
 * - useOrderOverview — GET /admin/orders/stats/overview 平台看板
 *
 * 权限：admin:order:read_all
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { PaginatedData } from "@/types";
import type {
  AdminOrderDetail,
  AdminOrderListItem,
  AdminOrderOverview,
} from "@/types/order";
import {
  getAdminOrder,
  getOrderOverview,
  listAdminOrders,
  type ListAdminOrdersQuery,
} from "@/lib/order-api";

// ---------------------------------------------------------------------------
// 订单列表
// ---------------------------------------------------------------------------

/**
 * useAdminOrders — 跨店订单列表。
 *
 * placeholderData 保留上一次结果，翻页 / 筛选切换时避免"闪空"。
 */
export function useAdminOrders(
  query: ListAdminOrdersQuery,
  options?: Omit<
    UseQueryOptions<
      PaginatedData<AdminOrderListItem>,
      Error,
      PaginatedData<AdminOrderListItem>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["admin", "orders", query],
    queryFn: () => listAdminOrders(query),
    placeholderData: (prev) => prev,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// 订单详情
// ---------------------------------------------------------------------------

/**
 * useAdminOrder — 单个订单详情（含 items / history / payment_sessions / shipment_events）。
 */
export function useAdminOrder(
  id: string | number | null | undefined,
  options?: Omit<
    UseQueryOptions<AdminOrderDetail, Error, AdminOrderDetail>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery({
    queryKey: ["admin", "order", String(id ?? "")],
    queryFn: () => getAdminOrder(id as string | number),
    enabled: id !== null && id !== undefined && id !== "",
    ...options,
  });
}

// ---------------------------------------------------------------------------
// 平台看板
// ---------------------------------------------------------------------------

/**
 * useOrderOverview — 平台大盘数字（首页卡片用）。
 *
 * staleTime 30s，与其他 dashboard 卡片保持一致。
 */
export function useOrderOverview(
  options?: Omit<
    UseQueryOptions<AdminOrderOverview, Error, AdminOrderOverview>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["admin", "order-overview"],
    queryFn: getOrderOverview,
    staleTime: 30_000,
    ...options,
  });
}
