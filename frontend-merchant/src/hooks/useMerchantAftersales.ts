"use client";

/**
 * 商家 · 售后相关 React Query hooks（Phase 4 §8）。
 *
 * 提供：
 *   - useMerchantAftersales(query)       售后单列表
 *   - useMerchantAftersalesDetail(id)    售后单详情
 *   - useAftersalesStats()               看板 stats
 *
 * 与 useMerchantOrders 保持相同风格：
 *   - staleTime 10s、stats 30s + 30s refetchInterval
 *   - 列表 queryKey 包含 query 对象便于按参数缓存
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import {
  getAftersalesStats,
  getMerchantAftersales,
  listMerchantAftersales,
  type AftersalesIdOrNo,
} from "@/lib/aftersales-api";
import type { PagedOut } from "@/types/api";
import type {
  MerchantAftersalesDetail,
  MerchantAftersalesListItem,
  MerchantAftersalesListQuery,
  MerchantAftersalesStats,
} from "@/types/aftersales";

export const MERCHANT_AFTERSALES_QUERY_KEY = [
  "merchant",
  "aftersales",
  "list",
] as const;
export const MERCHANT_AFTERSALES_DETAIL_KEY = [
  "merchant",
  "aftersales",
  "detail",
] as const;
export const MERCHANT_AFTERSALES_STATS_KEY = [
  "merchant",
  "aftersales",
  "stats",
] as const;

export function useMerchantAftersales(
  query: MerchantAftersalesListQuery,
  options?: Partial<UseQueryOptions<PagedOut<MerchantAftersalesListItem>>>,
) {
  return useQuery<PagedOut<MerchantAftersalesListItem>>({
    queryKey: [...MERCHANT_AFTERSALES_QUERY_KEY, query],
    queryFn: () => listMerchantAftersales(query),
    staleTime: 10_000,
    ...options,
  });
}

export function useMerchantAftersalesDetail(
  idOrNo: AftersalesIdOrNo | null | undefined,
  options?: Partial<UseQueryOptions<MerchantAftersalesDetail>>,
) {
  return useQuery<MerchantAftersalesDetail>({
    queryKey: [...MERCHANT_AFTERSALES_DETAIL_KEY, idOrNo],
    queryFn: () => getMerchantAftersales(idOrNo!),
    enabled:
      idOrNo !== null &&
      idOrNo !== undefined &&
      idOrNo !== "" &&
      (options?.enabled ?? true),
    staleTime: 10_000,
    ...options,
  });
}

export function useAftersalesStats(
  options?: Partial<UseQueryOptions<MerchantAftersalesStats>>,
) {
  return useQuery<MerchantAftersalesStats>({
    queryKey: MERCHANT_AFTERSALES_STATS_KEY,
    queryFn: () => getAftersalesStats(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    ...options,
  });
}
