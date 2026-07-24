/**
 * Phase 5 · 评价 API 客户端。
 *
 * 契约：docs/API/phase-5-contracts.md §4 - §5
 *   POST   /user/orders/{order_id}/reviews    Idempotency-Key 必带（批量发起）
 *   PATCH  /user/reviews/{id}                  编辑
 *   DELETE /user/reviews/{id}                  软删
 *   GET    /user/reviews?page&size             我的评价列表
 *   GET    /catalog/spus/{spu_id}/reviews?rating&with_images&page&size
 *   GET    /catalog/shops/{shop_id}/reviews?page&size
 *   POST   /user/reviews/{id}/report           举报
 */

import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import type { PaginatedData } from "@/types";
import type {
  CreateReviewsOut,
  CreateReviewsPayload,
  EditReviewPayload,
  MyReviewsQuery,
  PublicReviewList,
  ReviewOut,
  ReviewReportPayload,
  ShopReviewsQuery,
  SpuReviewsQuery,
} from "@/types/review";

function toSearchParams<T extends object>(
  q: T | undefined,
): Record<string, string> | undefined {
  if (!q) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = typeof v === "boolean" ? String(v) : String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * POST /user/orders/{order_id}/reviews — 批量发起评价。
 * 必带 Idempotency-Key（同一订单可能包含多个 order_item，一次批量提交）。
 */
export function createReviews(
  orderIdOrNo: number | string,
  payload: CreateReviewsPayload,
  idempotencyKey: string,
): Promise<CreateReviewsOut> {
  return apiPost<CreateReviewsOut, CreateReviewsPayload>(
    `user/orders/${orderIdOrNo}/reviews`,
    payload,
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

/** PATCH /user/reviews/{id} — 编辑（15 天窗口，1 次）。 */
export function editReview(
  id: number | string,
  payload: EditReviewPayload,
): Promise<ReviewOut> {
  return apiPatch<ReviewOut, EditReviewPayload>(`user/reviews/${id}`, payload);
}

/** DELETE /user/reviews/{id} — 软删。 */
export function deleteReview(id: number | string): Promise<void> {
  return apiDelete<void>(`user/reviews/${id}`);
}

/** GET /user/reviews — 我的评价列表。 */
export function listMyReviews(
  query?: MyReviewsQuery,
): Promise<PaginatedData<ReviewOut>> {
  return apiGet<PaginatedData<ReviewOut>>("user/reviews", {
    searchParams: toSearchParams(query),
  });
}

/** GET /catalog/spus/{spu_id}/reviews — 商品评价（公开）。 */
export function listSpuReviews(
  spuId: number | string,
  query?: SpuReviewsQuery,
): Promise<PublicReviewList> {
  return apiGet<PublicReviewList>(`catalog/spus/${spuId}/reviews`, {
    searchParams: toSearchParams(query),
  });
}

/** GET /catalog/shops/{shop_id}/reviews — 店铺评价（公开）。 */
export function listShopReviews(
  shopId: number | string,
  query?: ShopReviewsQuery,
): Promise<PublicReviewList> {
  return apiGet<PublicReviewList>(`catalog/shops/${shopId}/reviews`, {
    searchParams: toSearchParams(query),
  });
}

/** POST /user/reviews/{id}/report — 举报评价。 */
export function reportReview(
  id: number | string,
  payload: ReviewReportPayload,
): Promise<void> {
  return apiPost<void, ReviewReportPayload>(`user/reviews/${id}/report`, payload);
}
