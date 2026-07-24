/**
 * Phase 4 · 售后 API 客户端。
 *
 * 契约：docs/API/phase-4-contracts.md §7
 *   POST   /user/orders/{order_id}/aftersales     Idempotency-Key 必带
 *   GET    /user/aftersales?status=&type=&keyword=&page=&size=
 *   GET    /user/aftersales/{id}
 *   POST   /user/aftersales/{id}/cancel
 *   POST   /user/aftersales/{id}/submit-tracking
 *   POST   /user/aftersales/{id}/confirm-exchange
 *   POST   /user/aftersales/{id}/nudge
 *   POST   /user/aftersales/{id}/appeal
 *   POST   /user/aftersales/{id}/evidences
 *
 * 幂等：createAftersales 与 createOrder 用同一套 idempotency helper；
 * apply page 用 sessionStorage 保 key 直到用户离开页面 or 请求成功。
 */

import { apiGet, apiPost } from "./api";
import type { PaginatedData } from "@/types";
import type {
  AftersalesAddEvidencePayload,
  AftersalesAppealPayload,
  AftersalesCancelPayload,
  AftersalesCreatePayload,
  AftersalesDetail,
  AftersalesListItem,
  AftersalesListQuery,
  AftersalesSubmitTrackingPayload,
} from "@/types/aftersales";

function toSearchParams<T extends object>(
  q: T | undefined,
): Record<string, string> | undefined {
  if (!q) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * POST /user/orders/{order_id}/aftersales — 发起售后。
 * **必带** Idempotency-Key。
 */
export function createAftersales(
  orderIdOrNo: number | string,
  payload: AftersalesCreatePayload,
  idempotencyKey: string,
): Promise<AftersalesDetail> {
  return apiPost<AftersalesDetail, AftersalesCreatePayload>(
    `user/orders/${orderIdOrNo}/aftersales`,
    payload,
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

/** GET /user/aftersales — 我的售后单列表。 */
export function listAftersales(
  query?: AftersalesListQuery,
): Promise<PaginatedData<AftersalesListItem>> {
  return apiGet<PaginatedData<AftersalesListItem>>("user/aftersales", {
    searchParams: toSearchParams(query),
  });
}

/** GET /user/aftersales/{id} */
export function getAftersales(
  idOrNo: number | string,
): Promise<AftersalesDetail> {
  return apiGet<AftersalesDetail>(`user/aftersales/${idOrNo}`);
}

/** POST /user/aftersales/{id}/cancel — 撤销。 */
export function cancelAftersales(
  idOrNo: number | string,
  payload?: AftersalesCancelPayload,
): Promise<AftersalesDetail> {
  return apiPost<AftersalesDetail, AftersalesCancelPayload>(
    `user/aftersales/${idOrNo}/cancel`,
    payload ?? {},
  );
}

/** POST /user/aftersales/{id}/submit-tracking — 回填快递单号。 */
export function submitTracking(
  idOrNo: number | string,
  payload: AftersalesSubmitTrackingPayload,
): Promise<AftersalesDetail> {
  return apiPost<AftersalesDetail, AftersalesSubmitTrackingPayload>(
    `user/aftersales/${idOrNo}/submit-tracking`,
    payload,
  );
}

/** POST /user/aftersales/{id}/confirm-exchange — 用户确认换货完成。 */
export function confirmExchange(
  idOrNo: number | string,
): Promise<AftersalesDetail> {
  return apiPost<AftersalesDetail>(
    `user/aftersales/${idOrNo}/confirm-exchange`,
  );
}

/** POST /user/aftersales/{id}/nudge — 催办。 */
export function nudgeAftersales(
  idOrNo: number | string,
): Promise<AftersalesDetail> {
  return apiPost<AftersalesDetail>(`user/aftersales/${idOrNo}/nudge`);
}

/** POST /user/aftersales/{id}/appeal — 申诉（1 次）。 */
export function appealAftersales(
  idOrNo: number | string,
  payload: AftersalesAppealPayload,
): Promise<AftersalesDetail> {
  return apiPost<AftersalesDetail, AftersalesAppealPayload>(
    `user/aftersales/${idOrNo}/appeal`,
    payload,
  );
}

/** POST /user/aftersales/{id}/evidences — 追加凭证。 */
export function addAftersalesEvidence(
  idOrNo: number | string,
  payload: AftersalesAddEvidencePayload,
): Promise<AftersalesDetail> {
  return apiPost<AftersalesDetail, AftersalesAddEvidencePayload>(
    `user/aftersales/${idOrNo}/evidences`,
    payload,
  );
}
