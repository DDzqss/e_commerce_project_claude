/**
 * 商品（SPU）审核 API 封装（Admin 端）。
 *
 * 契约 §7：
 * - GET  /admin/spus?status=&shop_id=&keyword=&page=&size=   跨店 + 状态筛选
 * - GET  /admin/spus/{id}                                     详情（含所有 SKU）
 * - POST /admin/spus/{id}/approve         { review_note? }    通过；首次通过写 published_at
 * - POST /admin/spus/{id}/reject          { review_note }     驳回（review_note 必填 5-500）
 * - POST /admin/spus/{id}/force-offshelf  { review_note }     强制下架
 *
 * 权限：审核 admin:spu:review；强制下架 admin:spu:force_offshelf；读取 admin:spu:read_all
 */

import { apiGet, apiPost } from "@/lib/api";
import type { PaginatedData } from "@/types";
import type {
  AdminReviewPayload,
  AdminSPUDetail,
  AdminSPUListItem,
  SPUStatus,
} from "@/types/api";

export interface ListAllSPUsQuery {
  /** 不传或传 undefined 表示"全部" */
  status?: SPUStatus;
  shop_id?: number | string;
  keyword?: string;
  page?: number;
  size?: number;
}

/**
 * GET /admin/spus
 * 权限：admin:spu:read_all
 */
export function listAllSPUs(
  query: ListAllSPUsQuery = {},
): Promise<PaginatedData<AdminSPUListItem>> {
  const searchParams: Record<string, string | number> = {};
  if (query.status) searchParams.status = query.status;
  if (query.shop_id !== undefined && query.shop_id !== "") {
    searchParams.shop_id = query.shop_id;
  }
  if (query.keyword) searchParams.keyword = query.keyword;
  if (query.page) searchParams.page = query.page;
  if (query.size) searchParams.size = query.size;
  return apiGet<PaginatedData<AdminSPUListItem>>("admin/spus", {
    searchParams,
  });
}

/**
 * GET /admin/spus/{id}
 * 错误：7001 不存在
 */
export function getSPUDetail(id: number | string): Promise<AdminSPUDetail> {
  return apiGet<AdminSPUDetail>(`admin/spus/${id}`);
}

/**
 * POST /admin/spus/{id}/approve
 * 权限：admin:spu:review
 * 错误：7001 / 7003（状态非 pending_review）
 */
export function approveSPU(
  id: number | string,
  payload: AdminReviewPayload = {},
): Promise<AdminSPUDetail> {
  return apiPost<AdminSPUDetail, AdminReviewPayload>(
    `admin/spus/${id}/approve`,
    payload,
  );
}

/**
 * POST /admin/spus/{id}/reject
 * 权限：admin:spu:review
 * review_note 必填 5-500 字（前端已做长度校验）
 * 错误：7001 / 7003 / 5001
 */
export function rejectSPU(
  id: number | string,
  payload: Required<Pick<AdminReviewPayload, "review_note">>,
): Promise<AdminSPUDetail> {
  return apiPost<AdminSPUDetail, AdminReviewPayload>(
    `admin/spus/${id}/reject`,
    payload,
  );
}

/**
 * POST /admin/spus/{id}/force-offshelf
 * 权限：admin:spu:force_offshelf
 * 仅 approved 可强制下架；review_note 必填。
 * 错误：7001 / 7003 / 7005
 */
export function forceOffshelfSPU(
  id: number | string,
  payload: Required<Pick<AdminReviewPayload, "review_note">>,
): Promise<AdminSPUDetail> {
  return apiPost<AdminSPUDetail, AdminReviewPayload>(
    `admin/spus/${id}/force-offshelf`,
    payload,
  );
}
