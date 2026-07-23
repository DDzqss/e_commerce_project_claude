/**
 * 商家端 · 订单管理 API 客户端（Phase 3 §10）。
 *
 * 端点覆盖：
 *   - listMerchantOrders    · GET  /api/v1/merchant/orders
 *   - getMerchantOrder      · GET  /api/v1/merchant/orders/{id}
 *   - shipOrder             · POST /api/v1/merchant/orders/{id}/ship
 *   - cancelOrder           · POST /api/v1/merchant/orders/{id}/cancel
 *   - addMerchantNote       · POST /api/v1/merchant/orders/{id}/note
 *   - getOrderStats         · GET  /api/v1/merchant/orders/stats/summary
 *
 * 契约要点：
 *   - `{id}` 路径参数：契约标注为数值 PK；由于展示 URL 使用 `order_no`（18 位字符串），
 *     本客户端约定后端同时接受两种形式（与 user-web 保持一致）。若后端仅支持数字 id，
 *     调用方应先通过列表/搜索拿到 numeric id 再传入。
 *   - 支持多值 status（"paid,shipped"）
 *   - 未登录 / 权限不足会由 ky afterResponse 统一抛 ApiError
 */

import { api, unwrap } from "./api";
import type { PagedOut } from "@/types/api";
import type {
  AddMerchantNotePayload,
  CancelOrderPayload,
  MerchantOrderDetail,
  MerchantOrderListItem,
  MerchantOrderListQuery,
  MerchantOrderStats,
  ShipOrderPayload,
} from "@/types/order";

/** 允许 numeric id 或 order_no 字符串。 */
export type OrderIdOrNo = number | string;

/**
 * 将 status（单值 / 数组 / 逗号串）标准化为后端所需字符串。
 */
function normalizeStatus(
  status: MerchantOrderListQuery["status"] | undefined,
): string | undefined {
  if (!status) return undefined;
  if (Array.isArray(status)) return status.join(",");
  return String(status);
}

/**
 * `GET /api/v1/merchant/orders`
 *
 * @param query 支持 status（可多值）/ keyword / 日期区间 / 分页
 */
export function listMerchantOrders(
  query: MerchantOrderListQuery = {},
): Promise<PagedOut<MerchantOrderListItem>> {
  const searchParams = new URLSearchParams();
  const status = normalizeStatus(query.status);
  if (status) searchParams.set("status", status);
  if (query.keyword) searchParams.set("keyword", query.keyword);
  if (query.start_date) searchParams.set("start_date", query.start_date);
  if (query.end_date) searchParams.set("end_date", query.end_date);
  searchParams.set("page", String(query.page ?? 1));
  searchParams.set("size", String(query.size ?? 20));
  return unwrap<PagedOut<MerchantOrderListItem>>(
    api.get("v1/merchant/orders", { searchParams }),
  );
}

/** `GET /api/v1/merchant/orders/{id}` —— 接受 id 或 order_no。 */
export function getMerchantOrder(
  idOrNo: OrderIdOrNo,
): Promise<MerchantOrderDetail> {
  return unwrap<MerchantOrderDetail>(
    api.get(`v1/merchant/orders/${idOrNo}`),
  );
}

/**
 * `POST /api/v1/merchant/orders/{id}/ship`
 *
 * 校验：
 *   - 状态必须为 paid
 *   - carrier 与 tracking_no 均必填
 *   - tracking_no 长度 6-30 且仅 [A-Za-z0-9]（前端也需拦截，命中即 13010）
 */
export function shipOrder(
  idOrNo: OrderIdOrNo,
  payload: ShipOrderPayload,
): Promise<MerchantOrderDetail> {
  return unwrap<MerchantOrderDetail>(
    api.post(`v1/merchant/orders/${idOrNo}/ship`, { json: payload }),
  );
}

/**
 * `POST /api/v1/merchant/orders/{id}/cancel`
 *
 * 商家取消（仅限 paid → cancelled，用于缺货等场景）。
 * cancel_note 必填，本 Phase 不做退款，用户需走 Phase 4 售后流程。
 */
export function cancelOrder(
  idOrNo: OrderIdOrNo,
  payload: CancelOrderPayload,
): Promise<MerchantOrderDetail> {
  return unwrap<MerchantOrderDetail>(
    api.post(`v1/merchant/orders/${idOrNo}/cancel`, { json: payload }),
  );
}

/**
 * `POST /api/v1/merchant/orders/{id}/note`
 * 商家备注（对用户可见），覆盖式更新。
 */
export function addMerchantNote(
  idOrNo: OrderIdOrNo,
  payload: AddMerchantNotePayload,
): Promise<MerchantOrderDetail> {
  return unwrap<MerchantOrderDetail>(
    api.post(`v1/merchant/orders/${idOrNo}/note`, { json: payload }),
  );
}

/** `GET /api/v1/merchant/orders/stats/summary` —— 看板数字。 */
export function getOrderStats(): Promise<MerchantOrderStats> {
  return unwrap<MerchantOrderStats>(
    api.get("v1/merchant/orders/stats/summary"),
  );
}
