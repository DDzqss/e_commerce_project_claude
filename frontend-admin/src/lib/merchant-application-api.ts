/**
 * 商家入驻申请审核 API 封装。
 *
 * 契约 §9 Admin 商家审核端点：
 * - GET  /admin/merchant-applications           查询列表（分页 + status + keyword）
 * - GET  /admin/merchant-applications/{id}      查询详情
 * - POST /admin/merchant-applications/{id}/approve  { review_note? }
 * - POST /admin/merchant-applications/{id}/reject   { review_note }  必填
 *
 * 权限：admin:merchant_application:read / :review
 */

import { apiGet, apiPost } from "@/lib/api";
import type { PaginatedData } from "@/types";
import type {
  ApproveMerchantApplicationResponse,
  MerchantApplicationOut,
  MerchantApplicationStatus,
  RejectMerchantApplicationResponse,
} from "@/types/api";

export interface ListMerchantApplicationsQuery {
  /** 不传或传 undefined 表示"全部"（Phase 1 后端支持 status 缺省为 all） */
  status?: MerchantApplicationStatus;
  keyword?: string;
  page?: number;
  size?: number;
}

/**
 * GET /admin/merchant-applications
 * 权限：admin:merchant_application:read
 */
export function listMerchantApplications(
  query: ListMerchantApplicationsQuery = {},
): Promise<PaginatedData<MerchantApplicationOut>> {
  const searchParams: Record<string, string | number> = {};
  if (query.status) searchParams.status = query.status;
  if (query.keyword) searchParams.keyword = query.keyword;
  if (query.page) searchParams.page = query.page;
  if (query.size) searchParams.size = query.size;

  return apiGet<PaginatedData<MerchantApplicationOut>>(
    "admin/merchant-applications",
    { searchParams },
  );
}

/**
 * GET /admin/merchant-applications/{id}
 * 权限：admin:merchant_application:read
 * 错误：3003 申请不存在
 */
export function getMerchantApplication(
  id: number | string,
): Promise<MerchantApplicationOut> {
  return apiGet<MerchantApplicationOut>(`admin/merchant-applications/${id}`);
}

export interface ApprovePayload {
  /** 审核备注，可选；后端会存入 review_note 字段 */
  review_note?: string;
}

/**
 * POST /admin/merchant-applications/{id}/approve
 * 权限：admin:merchant_application:review
 * 错误：3003 / 3004（状态非 pending）
 *
 * ⚠ 响应 data.merchant_account.initial_password 是明文密码，
 *   前端必须在 UI 上一次性展示并提示抄送申请人（下次不再返回）。
 */
export function approveMerchantApplication(
  id: number | string,
  payload: ApprovePayload = {},
): Promise<ApproveMerchantApplicationResponse> {
  return apiPost<ApproveMerchantApplicationResponse, ApprovePayload>(
    `admin/merchant-applications/${id}/approve`,
    payload,
  );
}

export interface RejectPayload {
  /** 拒绝理由，5-500 字，必填 */
  review_note: string;
}

/**
 * POST /admin/merchant-applications/{id}/reject
 * 权限：admin:merchant_application:review
 * 错误：3003 / 3004 / 5001（review_note 长度校验）
 */
export function rejectMerchantApplication(
  id: number | string,
  payload: RejectPayload,
): Promise<RejectMerchantApplicationResponse> {
  return apiPost<RejectMerchantApplicationResponse, RejectPayload>(
    `admin/merchant-applications/${id}/reject`,
    payload,
  );
}
