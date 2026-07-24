/**
 * Admin 订单管理 API 封装。
 *
 * 契约 §11 Admin 订单大盘与干预：
 * - GET  /admin/orders?status=&shop_id=&user_id=&keyword=&start_date=&end_date=&page=&size=
 * - GET  /admin/orders/{id}                                完整字段（含 admin_note、payment_sessions.external_txn_no）
 * - POST /admin/orders/{id}/cancel        { cancel_note }  强制取消（pending_payment/paid）
 * - POST /admin/orders/{id}/note          { admin_note }   内部备注（用户/商家不可见）
 * - POST /admin/orders/{id}/logistics/simulate  { event_type, description }  手动追加物流事件
 * - GET  /admin/orders/stats/overview                      平台大盘数字
 *
 * 权限：
 * - listAdminOrders / getAdminOrder / getOrderOverview → admin:order:read_all
 * - adminCancelOrder / simulateLogistics               → admin:order:intervene
 * - addAdminNote                                       → admin:order:add_note
 */

import { apiGet, apiPost } from "@/lib/api";
import type { PaginatedData } from "@/types";
import type {
  AdminAddNotePayload,
  AdminCancelOrderPayload,
  AdminOrderDetail,
  AdminOrderListItem,
  AdminOrderOverview,
  OrderStatus,
  SimulateLogisticsPayload,
} from "@/types/order";

/**
 * GET /admin/orders 查询参数。
 *
 * - status: 单值或多值以逗号分隔（后端支持 `status=pending_payment,paid` 语法）
 * - shop_id / user_id: 数字 ID；空串等价 undefined
 * - keyword: 匹配 order_no / receiver_name / receiver_phone / user email/phone
 * - start_date / end_date: ISO 日期字符串（yyyy-MM-dd），后端解释为 UTC 天区间
 */
export interface ListAdminOrdersQuery {
  status?: OrderStatus | string;
  shop_id?: number | string;
  user_id?: number | string;
  keyword?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  size?: number;
}

/**
 * GET /admin/orders
 * 权限：admin:order:read_all
 */
export function listAdminOrders(
  query: ListAdminOrdersQuery = {},
): Promise<PaginatedData<AdminOrderListItem>> {
  const searchParams: Record<string, string | number> = {};
  if (query.status) searchParams.status = query.status;
  if (query.shop_id !== undefined && query.shop_id !== "") {
    searchParams.shop_id = query.shop_id;
  }
  if (query.user_id !== undefined && query.user_id !== "") {
    searchParams.user_id = query.user_id;
  }
  if (query.keyword) searchParams.keyword = query.keyword;
  if (query.start_date) searchParams.start_date = query.start_date;
  if (query.end_date) searchParams.end_date = query.end_date;
  if (query.page) searchParams.page = query.page;
  if (query.size) searchParams.size = query.size;
  return apiGet<PaginatedData<AdminOrderListItem>>("admin/orders", {
    searchParams,
  });
}

/**
 * GET /admin/orders/{id}
 * 错误：13001 订单不存在
 */
export function getAdminOrder(
  id: number | string,
): Promise<AdminOrderDetail> {
  return apiGet<AdminOrderDetail>(`admin/orders/${id}`);
}

/**
 * POST /admin/orders/{id}/cancel
 * 权限：admin:order:intervene
 * 仅 pending_payment / paid 可强制取消（已发货订单需走售后）。
 *
 * 前端已校验 cancel_note ≥ 10 字符；此处依赖后端 5001 兜底。
 * 错误：13001 / 13003 / 13011 / 5001
 */
export function adminCancelOrder(
  id: number | string,
  payload: AdminCancelOrderPayload,
): Promise<AdminOrderDetail> {
  return apiPost<AdminOrderDetail, AdminCancelOrderPayload>(
    `admin/orders/${id}/cancel`,
    payload,
  );
}

/**
 * POST /admin/orders/{id}/note
 * 权限：admin:order:add_note
 * 覆盖式写入内部备注；对用户/商家不可见。
 */
export function addAdminNote(
  id: number | string,
  payload: AdminAddNotePayload,
): Promise<AdminOrderDetail> {
  return apiPost<AdminOrderDetail, AdminAddNotePayload>(
    `admin/orders/${id}/note`,
    payload,
  );
}

/**
 * POST /admin/orders/{id}/logistics/simulate
 * 权限：admin:order:intervene
 * 仅 shipped 状态可用；追加一条 shipment_event（不改订单状态）。
 * 错误：13001 / 13003
 */
export function simulateLogistics(
  id: number | string,
  payload: SimulateLogisticsPayload,
): Promise<AdminOrderDetail> {
  return apiPost<AdminOrderDetail, SimulateLogisticsPayload>(
    `admin/orders/${id}/logistics/simulate`,
    payload,
  );
}

/**
 * GET /admin/orders/stats/overview
 * 权限：admin:order:read_all
 * 平台大盘：今日订单量 / GMV / 待付款 / 待发货 / 在途 / 今日取消
 */
export function getOrderOverview(): Promise<AdminOrderOverview> {
  return apiGet<AdminOrderOverview>("admin/orders/stats/overview");
}
