/**
 * Phase 3 · 订单 API。
 *
 * 契约：docs/API/phase-3-contracts.md §8 + §14（幂等）
 *   POST   /user/orders/preview
 *   POST   /user/orders                     (Idempotency-Key 必须)
 *   GET    /user/orders?status=&keyword=&page&size
 *   GET    /user/orders/{id}
 *   POST   /user/orders/{id}/cancel
 *   POST   /user/orders/{id}/confirm-receipt
 *   GET    /user/orders/{id}/shipment
 *
 * 注意：契约中 URL 参数使用订单主键（数字 id）；后端返回的 order_no 才是展示用的字符串。
 * 由于用户端从"我的订单"点进去往往拿的是 order_no，本层同时提供 order_no 版的封装
 * （由后端接受两种形式的路由约定；若后端仅接受数字 id，前端 hook 会在点击时用 id 传入）。
 */

import { apiGet, apiPost } from "./api";
import type { PaginatedData } from "@/types";
import type {
  CancelOrderPayload,
  CreateOrderOut,
  CreateOrderPayload,
  OrderDetail,
  OrderListItem,
  OrderListQuery,
  PreviewOrderPayload,
  PreviewOut,
  ShipmentInfo,
} from "@/types/order";

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

/** POST /user/orders/preview */
export function previewOrder(
  payload: PreviewOrderPayload,
): Promise<PreviewOut> {
  return apiPost<PreviewOut, PreviewOrderPayload>(
    "user/orders/preview",
    payload,
  );
}

/**
 * POST /user/orders — 创建订单。**必带** `Idempotency-Key` header。
 * 调用方从 `@/lib/idempotency` 生成/复用 key，然后传进来。
 */
export function createOrder(
  payload: CreateOrderPayload,
  idempotencyKey: string,
): Promise<CreateOrderOut> {
  return apiPost<CreateOrderOut, CreateOrderPayload>(
    "user/orders",
    payload,
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

/** GET /user/orders */
export function listOrders(
  query?: OrderListQuery,
): Promise<PaginatedData<OrderListItem>> {
  return apiGet<PaginatedData<OrderListItem>>("user/orders", {
    searchParams: toSearchParams(query),
  });
}

/** GET /user/orders/{id} — 支持传数字 id 或字符串 order_no。 */
export function getOrder(idOrNo: number | string): Promise<OrderDetail> {
  return apiGet<OrderDetail>(`user/orders/${idOrNo}`);
}

/** POST /user/orders/{id}/cancel */
export function cancelOrder(
  idOrNo: number | string,
  payload?: CancelOrderPayload,
): Promise<OrderDetail> {
  return apiPost<OrderDetail, CancelOrderPayload>(
    `user/orders/${idOrNo}/cancel`,
    payload ?? {},
  );
}

/** POST /user/orders/{id}/confirm-receipt */
export function confirmReceipt(
  idOrNo: number | string,
): Promise<OrderDetail> {
  return apiPost<OrderDetail>(`user/orders/${idOrNo}/confirm-receipt`);
}

/** GET /user/orders/{id}/shipment */
export function getShipment(
  idOrNo: number | string,
): Promise<ShipmentInfo> {
  return apiGet<ShipmentInfo>(`user/orders/${idOrNo}/shipment`);
}
