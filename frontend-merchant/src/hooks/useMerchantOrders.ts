"use client";

/**
 * 商家 · 订单相关 React Query hooks。
 *
 * 提供：
 *   - useMerchantOrders(query)     订单列表
 *   - useMerchantOrder(id)         订单详情
 *   - useMerchantOrderStats()      看板 stats
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import {
  getMerchantOrder,
  getOrderStats,
  listMerchantOrders,
  type OrderIdOrNo,
} from "@/lib/order-api";
import type { PagedOut } from "@/types/api";
import type {
  MerchantOrderDetail,
  MerchantOrderListItem,
  MerchantOrderListQuery,
  MerchantOrderStats,
} from "@/types/order";

export const MERCHANT_ORDERS_QUERY_KEY = ["merchant", "orders", "list"] as const;
export const MERCHANT_ORDER_QUERY_KEY = ["merchant", "orders", "detail"] as const;
export const MERCHANT_ORDER_STATS_KEY = ["merchant", "orders", "stats"] as const;

export function useMerchantOrders(
  query: MerchantOrderListQuery,
  options?: Partial<UseQueryOptions<PagedOut<MerchantOrderListItem>>>,
) {
  return useQuery<PagedOut<MerchantOrderListItem>>({
    queryKey: [...MERCHANT_ORDERS_QUERY_KEY, query],
    queryFn: () => listMerchantOrders(query),
    staleTime: 10_000,
    ...options,
  });
}

export function useMerchantOrder(
  idOrNo: OrderIdOrNo | null | undefined,
  options?: Partial<UseQueryOptions<MerchantOrderDetail>>,
) {
  return useQuery<MerchantOrderDetail>({
    queryKey: [...MERCHANT_ORDER_QUERY_KEY, idOrNo],
    queryFn: () => getMerchantOrder(idOrNo!),
    enabled:
      idOrNo !== null &&
      idOrNo !== undefined &&
      idOrNo !== "" &&
      (options?.enabled ?? true),
    staleTime: 10_000,
    ...options,
  });
}

export function useMerchantOrderStats(
  options?: Partial<UseQueryOptions<MerchantOrderStats>>,
) {
  return useQuery<MerchantOrderStats>({
    queryKey: MERCHANT_ORDER_STATS_KEY,
    queryFn: () => getOrderStats(),
    // 看板数据较敏感，30s 刷一次 + 30s stale
    staleTime: 30_000,
    refetchInterval: 30_000,
    ...options,
  });
}
