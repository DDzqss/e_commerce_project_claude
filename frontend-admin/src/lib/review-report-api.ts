/**
 * Admin 评价举报处理 API 封装。
 *
 * 契约 §5.5 Admin 举报队列：
 * - GET  /admin/review-reports?status=pending&page=&size=
 * - POST /admin/review-reports/{id}/uphold    { review_note }   举报成立，同事务隐藏对应评价
 * - POST /admin/review-reports/{id}/dismiss   { review_note }   驳回举报
 *
 * 权限：
 * - listReports          → admin:review_report:handle
 * - upholdReport / dismissReport → admin:review_report:handle
 *
 * uphold 副作用（后端事务内完成）：
 * - review.visible → false
 * - review.hidden_by_admin_id = 当前 admin.id
 * - review.hidden_reason = review_note
 * - review.hidden_at = now
 * - shops.rating_avg / rating_count 更新
 * - 通知 review.user "评价已被隐藏"
 */

import { apiGet, apiPost } from "@/lib/api";
import type { PaginatedData } from "@/types";
import type {
  AdminReviewReportListItem,
  DismissReportPayload,
  ReviewReportStatus,
  UpholdReportPayload,
} from "@/types/review";

/**
 * GET /admin/review-reports 查询参数。
 *
 * - status: 单值（pending / upheld / dismissed）
 * - reason_category: 举报类别（可选）
 * - review_id: 精确匹配（可选）
 */
export interface ListReportsQuery {
  status?: ReviewReportStatus;
  reason_category?: string;
  review_id?: number | string;
  page?: number;
  size?: number;
}

/**
 * GET /admin/review-reports
 * 权限：admin:review_report:handle
 * 默认按 created_at DESC（待处理优先）
 */
export function listReports(
  query: ListReportsQuery = {},
): Promise<PaginatedData<AdminReviewReportListItem>> {
  const searchParams: Record<string, string | number> = {};
  if (query.status) searchParams.status = query.status;
  if (query.reason_category) searchParams.reason_category = query.reason_category;
  if (query.review_id !== undefined && query.review_id !== "") {
    searchParams.review_id = query.review_id;
  }
  if (query.page) searchParams.page = query.page;
  if (query.size) searchParams.size = query.size;
  return apiGet<PaginatedData<AdminReviewReportListItem>>(
    "admin/review-reports",
    { searchParams },
  );
}

/**
 * POST /admin/review-reports/{id}/uphold
 * 权限：admin:review_report:handle
 *
 * 前端已校验 review_note ≥ 5 字；后端 5001 兜底。
 * 错误：21001 举报不存在 / 5001
 */
export function upholdReport(
  id: number | string,
  payload: UpholdReportPayload,
): Promise<AdminReviewReportListItem> {
  return apiPost<AdminReviewReportListItem, UpholdReportPayload>(
    `admin/review-reports/${id}/uphold`,
    payload,
  );
}

/**
 * POST /admin/review-reports/{id}/dismiss
 * 权限：admin:review_report:handle
 * 错误：21001 / 5001
 */
export function dismissReport(
  id: number | string,
  payload: DismissReportPayload,
): Promise<AdminReviewReportListItem> {
  return apiPost<AdminReviewReportListItem, DismissReportPayload>(
    `admin/review-reports/${id}/dismiss`,
    payload,
  );
}
