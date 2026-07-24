/**
 * 商家端 · 售后管理 API 客户端（Phase 4 §8）。
 *
 * 端点覆盖：
 *   - listMerchantAftersales   · GET  /api/v1/merchant/aftersales
 *   - getMerchantAftersales    · GET  /api/v1/merchant/aftersales/{id}
 *   - approveAftersales        · POST /api/v1/merchant/aftersales/{id}/approve
 *   - rejectAftersales         · POST /api/v1/merchant/aftersales/{id}/reject
 *   - confirmReceived          · POST /api/v1/merchant/aftersales/{id}/confirm-received
 *   - refuseReceive            · POST /api/v1/merchant/aftersales/{id}/refuse-receive
 *   - shipExchange             · POST /api/v1/merchant/aftersales/{id}/ship-exchange
 *   - addMerchantNote          · POST /api/v1/merchant/aftersales/{id}/note
 *   - getAftersalesStats       · GET  /api/v1/merchant/aftersales/stats/summary
 *
 * 契约要点：
 *   - `{id}` 支持 numeric id 或 `aftersales_no` 字符串（后端两者兼容）。
 *   - 金额一律分（integer cents）。
 *   - `overdue_soon=true` 过滤审核 deadline < 24h。
 *   - 未登录 / 权限不足 / 状态非法均通过 `afterResponse` 统一抛 ApiError。
 */

import { api, unwrap } from "./api";
import type { PagedOut } from "@/types/api";
import type {
  AddAftersalesNotePayload,
  ApproveAftersalesPayload,
  ConfirmReceivedPayload,
  MerchantAftersalesDetail,
  MerchantAftersalesListItem,
  MerchantAftersalesListQuery,
  MerchantAftersalesStats,
  RefuseReceivePayload,
  RejectAftersalesPayload,
  ShipExchangePayload,
} from "@/types/aftersales";

/** 允许 numeric id 或 aftersales_no。 */
export type AftersalesIdOrNo = number | string;

/** `GET /api/v1/merchant/aftersales` */
export function listMerchantAftersales(
  query: MerchantAftersalesListQuery = {},
): Promise<PagedOut<MerchantAftersalesListItem>> {
  const searchParams = new URLSearchParams();
  if (query.status) searchParams.set("status", String(query.status));
  if (query.type) searchParams.set("type", query.type);
  if (query.keyword) searchParams.set("keyword", query.keyword);
  if (query.overdue_soon) searchParams.set("overdue_soon", "true");
  searchParams.set("page", String(query.page ?? 1));
  searchParams.set("size", String(query.size ?? 20));
  return unwrap<PagedOut<MerchantAftersalesListItem>>(
    api.get("v1/merchant/aftersales", { searchParams }),
  );
}

/** `GET /api/v1/merchant/aftersales/{id}` */
export function getMerchantAftersales(
  idOrNo: AftersalesIdOrNo,
): Promise<MerchantAftersalesDetail> {
  return unwrap<MerchantAftersalesDetail>(
    api.get(`v1/merchant/aftersales/${idOrNo}`),
  );
}

/**
 * `POST /api/v1/merchant/aftersales/{id}/approve`
 *
 * 服务端校验（前端亦已本地拦截）：
 *   - 状态必须为 `pending_merchant_review`
 *   - `actual_refund_cents` ≤ 用户申请金额
 *   - RETURN_REFUND / EXCHANGE 需附 `return_address`
 */
export function approveAftersales(
  idOrNo: AftersalesIdOrNo,
  payload: ApproveAftersalesPayload,
): Promise<MerchantAftersalesDetail> {
  return unwrap<MerchantAftersalesDetail>(
    api.post(`v1/merchant/aftersales/${idOrNo}/approve`, { json: payload }),
  );
}

/**
 * `POST /api/v1/merchant/aftersales/{id}/reject`
 *
 * 服务端校验：
 *   - 状态必须为 `pending_merchant_review`
 *   - `review_note` 长度 ≥ 5
 */
export function rejectAftersales(
  idOrNo: AftersalesIdOrNo,
  payload: RejectAftersalesPayload,
): Promise<MerchantAftersalesDetail> {
  return unwrap<MerchantAftersalesDetail>(
    api.post(`v1/merchant/aftersales/${idOrNo}/reject`, { json: payload }),
  );
}

/**
 * `POST /api/v1/merchant/aftersales/{id}/confirm-received`
 *
 * 状态必须为 `return_shipped_waiting_receive`；
 * RETURN_REFUND → refunding，EXCHANGE → merchant_agreed_waiting_ship。
 */
export function confirmReceived(
  idOrNo: AftersalesIdOrNo,
  payload: ConfirmReceivedPayload = {},
): Promise<MerchantAftersalesDetail> {
  return unwrap<MerchantAftersalesDetail>(
    api.post(`v1/merchant/aftersales/${idOrNo}/confirm-received`, {
      json: payload,
    }),
  );
}

/**
 * `POST /api/v1/merchant/aftersales/{id}/refuse-receive`
 *
 * 状态必须为 `return_shipped_waiting_receive`；
 * `refuse_note` ≥ 10；成功后状态 → admin_arbitrating。
 */
export function refuseReceive(
  idOrNo: AftersalesIdOrNo,
  payload: RefuseReceivePayload,
): Promise<MerchantAftersalesDetail> {
  return unwrap<MerchantAftersalesDetail>(
    api.post(`v1/merchant/aftersales/${idOrNo}/refuse-receive`, {
      json: payload,
    }),
  );
}

/**
 * `POST /api/v1/merchant/aftersales/{id}/ship-exchange`
 *
 * 状态必须为 `merchant_agreed_waiting_ship`；`tracking_no` 6-30 alphanumeric。
 */
export function shipExchange(
  idOrNo: AftersalesIdOrNo,
  payload: ShipExchangePayload,
): Promise<MerchantAftersalesDetail> {
  return unwrap<MerchantAftersalesDetail>(
    api.post(`v1/merchant/aftersales/${idOrNo}/ship-exchange`, {
      json: payload,
    }),
  );
}

/**
 * `POST /api/v1/merchant/aftersales/{id}/note`
 * 覆盖式更新 `merchant_review_note`，任意状态均可写。
 */
export function addMerchantNote(
  idOrNo: AftersalesIdOrNo,
  payload: AddAftersalesNotePayload,
): Promise<MerchantAftersalesDetail> {
  return unwrap<MerchantAftersalesDetail>(
    api.post(`v1/merchant/aftersales/${idOrNo}/note`, { json: payload }),
  );
}

/** `GET /api/v1/merchant/aftersales/stats/summary` */
export function getAftersalesStats(): Promise<MerchantAftersalesStats> {
  return unwrap<MerchantAftersalesStats>(
    api.get("v1/merchant/aftersales/stats/summary"),
  );
}
