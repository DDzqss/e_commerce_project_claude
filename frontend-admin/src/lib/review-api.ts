/**
 * Admin 评价审核 API 封装。
 *
 * 契约 §5.4 Admin 评价审核：
 * - GET  /admin/reviews?visible=&shop_id=&spu_id=&keyword=&page=&size=
 * - GET  /admin/reviews/{id}                                     详情（含 order 摘要 + reply）
 * - POST /admin/reviews/{id}/hide           { hidden_reason }    隐藏；hidden_reason ≥ 5 字
 * - POST /admin/reviews/{id}/restore                             恢复隐藏
 *
 * 权限：
 * - listAdminReviews / getAdminReview → admin:review:moderate（只读也需要 moderate；无独立 read 权限）
 * - hideReview / restoreReview        → admin:review:moderate
 *
 * 同事务副作用：
 * - hide / restore 会更新 shops.rating_avg / rating_count（后端处理，前端只需刷新详情）
 */

import { apiGet, apiPost } from "@/lib/api";
import type { PaginatedData } from "@/types";
import type {
  AdminReviewDetail,
  AdminReviewListItem,
  HideReviewPayload,
  RestoreReviewPayload,
} from "@/types/review";

/**
 * GET /admin/reviews 查询参数。
 *
 * - visible: 'true' | 'false' | undefined（不传即全部）
 * - shop_id / spu_id / user_id / rating: 数字 ID / 星级；空串等价 undefined
 * - keyword: 匹配 content 关键字（后端按 ILIKE 或全文索引）
 */
export interface ListAdminReviewsQuery {
  visible?: boolean;
  shop_id?: number | string;
  spu_id?: number | string;
  user_id?: number | string;
  rating?: number | string;
  keyword?: string;
  page?: number;
  size?: number;
}

/**
 * GET /admin/reviews
 * 权限：admin:review:moderate
 */
export function listAdminReviews(
  query: ListAdminReviewsQuery = {},
): Promise<PaginatedData<AdminReviewListItem>> {
  const searchParams: Record<string, string | number> = {};
  if (query.visible !== undefined) {
    searchParams.visible = query.visible ? "true" : "false";
  }
  if (query.shop_id !== undefined && query.shop_id !== "") {
    searchParams.shop_id = query.shop_id;
  }
  if (query.spu_id !== undefined && query.spu_id !== "") {
    searchParams.spu_id = query.spu_id;
  }
  if (query.user_id !== undefined && query.user_id !== "") {
    searchParams.user_id = query.user_id;
  }
  if (query.rating !== undefined && query.rating !== "") {
    searchParams.rating = query.rating;
  }
  if (query.keyword) searchParams.keyword = query.keyword;
  if (query.page) searchParams.page = query.page;
  if (query.size) searchParams.size = query.size;
  return apiGet<PaginatedData<AdminReviewListItem>>("admin/reviews", {
    searchParams,
  });
}

/**
 * GET /admin/reviews/{id}
 * 权限：admin:review:moderate
 * 错误：19001 评价不存在 / 19002 无权访问
 */
export function getAdminReview(
  id: number | string,
): Promise<AdminReviewDetail> {
  return apiGet<AdminReviewDetail>(`admin/reviews/${id}`);
}

/**
 * POST /admin/reviews/{id}/hide
 * 权限：admin:review:moderate
 *
 * 前端已校验 hidden_reason ≥ 5 字（HideReviewModal）；后端 5001 兜底。
 * 副作用：同事务 shops.rating_avg / rating_count 减少；触发通知 review.user
 * 错误：19001 / 5001
 */
export function hideReview(
  id: number | string,
  payload: HideReviewPayload,
): Promise<AdminReviewDetail> {
  return apiPost<AdminReviewDetail, HideReviewPayload>(
    `admin/reviews/${id}/hide`,
    payload,
  );
}

/**
 * POST /admin/reviews/{id}/restore
 * 权限：admin:review:moderate
 *
 * 恢复隐藏；同事务清空 hidden_* 字段并 shops.rating_avg / rating_count 增加。
 * 错误：19001
 */
export function restoreReview(
  id: number | string,
): Promise<AdminReviewDetail> {
  return apiPost<AdminReviewDetail, RestoreReviewPayload>(
    `admin/reviews/${id}/restore`,
    {},
  );
}
