"use client";

/**
 * Admin 评价审核相关 React Query hooks。
 *
 * 契约 §5.4：
 * - useAdminReviews  — GET /admin/reviews 列表（多筛选）
 * - useAdminReview   — GET /admin/reviews/{id} 详情
 *
 * 权限：admin:review:moderate
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { PaginatedData } from "@/types";
import type {
  AdminReviewDetail,
  AdminReviewListItem,
} from "@/types/review";
import {
  getAdminReview,
  listAdminReviews,
  type ListAdminReviewsQuery,
} from "@/lib/review-api";

/**
 * useAdminReviews — 全站评价列表。
 *
 * placeholderData 保留上一次结果，翻页 / 筛选切换时避免"闪空"。
 */
export function useAdminReviews(
  query: ListAdminReviewsQuery,
  options?: Omit<
    UseQueryOptions<
      PaginatedData<AdminReviewListItem>,
      Error,
      PaginatedData<AdminReviewListItem>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["admin", "reviews-list", query],
    queryFn: () => listAdminReviews(query),
    placeholderData: (prev) => prev,
    ...options,
  });
}

/**
 * useAdminReview — 单条评价详情（含 order 摘要 + reply）。
 */
export function useAdminReview(
  id: string | number | null | undefined,
  options?: Omit<
    UseQueryOptions<AdminReviewDetail, Error, AdminReviewDetail>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery({
    queryKey: ["admin", "review", String(id ?? "")],
    queryFn: () => getAdminReview(id as string | number),
    enabled: id !== null && id !== undefined && id !== "",
    ...options,
  });
}
