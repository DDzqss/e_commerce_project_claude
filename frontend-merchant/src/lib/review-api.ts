/**
 * Phase 5 · 商家端评价管理 API 客户端（§5.2 / §5.3）。
 *
 * 端点覆盖：
 *   - listMerchantReviews   · GET    /api/v1/merchant/reviews
 *   - getMerchantReview     · GET    /api/v1/merchant/reviews/{id}
 *   - createReply           · POST   /api/v1/merchant/reviews/{id}/reply
 *   - updateReply           · PATCH  /api/v1/merchant/reviews/{id}/reply
 *   - deleteReply           · DELETE /api/v1/merchant/reviews/{id}/reply
 *
 * 契约要点：
 *   - 回复内容 5-500 字（前端与后端各自校验）
 *   - 一条评价一条回复；重复 POST 命中 20002
 *   - 修改 / 删除回复无编辑窗口
 *   - visible=false 的评价商家仍可查看（打灰展示）
 */

import { api, unwrap } from "./api";
import type { PagedOut } from "@/types/api";
import type {
  CreateReplyPayload,
  MerchantReviewListQuery,
  MerchantReviewOut,
  MerchantReviewReplyOut,
  UpdateReplyPayload,
} from "@/types/review";

/** `GET /api/v1/merchant/reviews` */
export function listMerchantReviews(
  query: MerchantReviewListQuery = {},
): Promise<PagedOut<MerchantReviewOut>> {
  const searchParams = new URLSearchParams();
  if (typeof query.rating === "number" && query.rating > 0) {
    searchParams.set("rating", String(query.rating));
  }
  if (typeof query.has_reply === "boolean") {
    searchParams.set("has_reply", query.has_reply ? "true" : "false");
  }
  if (query.keyword) searchParams.set("keyword", query.keyword);
  searchParams.set("page", String(query.page ?? 1));
  searchParams.set("size", String(query.size ?? 20));
  return unwrap<PagedOut<MerchantReviewOut>>(
    api.get("v1/merchant/reviews", { searchParams }),
  );
}

/** `GET /api/v1/merchant/reviews/{id}` —— 详情（可选，若后端未实现列表已够用）。 */
export function getMerchantReview(id: number): Promise<MerchantReviewOut> {
  return unwrap<MerchantReviewOut>(api.get(`v1/merchant/reviews/${id}`));
}

/** `POST /api/v1/merchant/reviews/{id}/reply` */
export function createReply(
  reviewId: number,
  payload: CreateReplyPayload,
): Promise<MerchantReviewReplyOut> {
  return unwrap<MerchantReviewReplyOut>(
    api.post(`v1/merchant/reviews/${reviewId}/reply`, { json: payload }),
  );
}

/** `PATCH /api/v1/merchant/reviews/{id}/reply` */
export function updateReply(
  reviewId: number,
  payload: UpdateReplyPayload,
): Promise<MerchantReviewReplyOut> {
  return unwrap<MerchantReviewReplyOut>(
    api.patch(`v1/merchant/reviews/${reviewId}/reply`, { json: payload }),
  );
}

/** `DELETE /api/v1/merchant/reviews/{id}/reply` —— 无响应体。 */
export async function deleteReply(reviewId: number): Promise<void> {
  await api.delete(`v1/merchant/reviews/${reviewId}/reply`);
}
