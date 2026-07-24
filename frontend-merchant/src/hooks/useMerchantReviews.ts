"use client";

/**
 * 商家 · 评价相关 React Query hooks（Phase 5 §5.3）。
 *
 * 提供：
 *   - useMerchantReviews(query)         · 评价列表（未回复优先）
 *   - useMerchantReviewStats()          · 前端本地聚合：总数 / 未回复 / 平均 / 差评
 *
 * 说明：
 *   - stats 通过一次拉取近 100 条 + 未回复 count 组合而成（Phase 5 简化）；
 *     后端未提供专用 stats 端点，避免额外契约耦合。
 *   - 列表 queryKey 包含 query 对象便于按参数缓存。
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { listMerchantReviews } from "@/lib/review-api";
import type { PagedOut } from "@/types/api";
import type {
  MerchantReviewListQuery,
  MerchantReviewOut,
  MerchantReviewStats,
} from "@/types/review";

export const MERCHANT_REVIEWS_QUERY_KEY = [
  "merchant",
  "reviews",
  "list",
] as const;

export const MERCHANT_REVIEW_STATS_KEY = [
  "merchant",
  "reviews",
  "stats",
] as const;

export function useMerchantReviews(
  query: MerchantReviewListQuery,
  options?: Partial<UseQueryOptions<PagedOut<MerchantReviewOut>>>,
) {
  return useQuery<PagedOut<MerchantReviewOut>>({
    queryKey: [...MERCHANT_REVIEWS_QUERY_KEY, query],
    queryFn: () => listMerchantReviews(query),
    staleTime: 15_000,
    ...options,
  });
}

/**
 * 评价看板 stats（前端聚合）。
 *
 * 拉最新 100 条评价 + 一次未回复 count 组装：
 *   - total_count 用 shop.rating_count / 或 fallback
 *   - unreplied_count 用 `has_reply=false` 端点的 total
 *   - avg / distribution / low_rating 用 100 条快照本地聚合（够看板展示）
 */
export function useMerchantReviewStats(
  options?: Partial<UseQueryOptions<MerchantReviewStats>>,
) {
  return useQuery<MerchantReviewStats>({
    queryKey: MERCHANT_REVIEW_STATS_KEY,
    queryFn: async () => {
      const [recentSnapshot, unreplied] = await Promise.all([
        listMerchantReviews({ page: 1, size: 100 }),
        listMerchantReviews({ page: 1, size: 1, has_reply: false }),
      ]);
      const items = recentSnapshot.items;
      const total = recentSnapshot.total;
      const unrepliedCount = unreplied.total;
      const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;
      let lowCount = 0;
      for (const r of items) {
        const clamped = Math.max(1, Math.min(5, Math.round(r.rating)));
        distribution[clamped] = (distribution[clamped] ?? 0) + 1;
        sum += r.rating;
        if (r.rating <= 3) lowCount += 1;
      }
      const avg = items.length > 0 ? sum / items.length : 0;
      return {
        total_count: total,
        unreplied_count: unrepliedCount,
        avg_rating: Math.round(avg * 100) / 100,
        low_rating_count: lowCount,
        rating_distribution: distribution,
      } satisfies MerchantReviewStats;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    ...options,
  });
}
