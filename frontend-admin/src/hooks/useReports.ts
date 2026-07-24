"use client";

/**
 * Admin 举报队列相关 React Query hooks。
 *
 * 契约 §5.5：
 * - useReports — GET /admin/review-reports 列表（含 status 筛选）
 * - usePendingReportsCount — 便捷 hook，返回 pending 数量（用于 sidebar 红点 / 首页卡）
 *
 * 权限：admin:review_report:handle
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { PaginatedData } from "@/types";
import type { AdminReviewReportListItem } from "@/types/review";
import {
  listReports,
  type ListReportsQuery,
} from "@/lib/review-report-api";

/**
 * useReports — 举报队列列表。
 *
 * placeholderData 保留上一次结果，翻页 / 筛选切换时避免"闪空"。
 */
export function useReports(
  query: ListReportsQuery,
  options?: Omit<
    UseQueryOptions<
      PaginatedData<AdminReviewReportListItem>,
      Error,
      PaginatedData<AdminReviewReportListItem>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["admin", "review-reports", query],
    queryFn: () => listReports(query),
    placeholderData: (prev) => prev,
    ...options,
  });
}

/**
 * usePendingReportsCount — pending 状态举报数量。
 *
 * 首页 / Sidebar 红点用。staleTime 30s 与其他 dashboard 数据一致。
 */
export function usePendingReportsCount(
  options?: Omit<
    UseQueryOptions<
      PaginatedData<AdminReviewReportListItem>,
      Error,
      PaginatedData<AdminReviewReportListItem>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["admin", "review-reports", "pending-count"],
    queryFn: () => listReports({ status: "pending", page: 1, size: 1 }),
    staleTime: 30_000,
    ...options,
  });
}
