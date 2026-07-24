/**
 * Phase 3 交易域强类型定义。
 *
 * 严格对齐 docs/API/phase-3-contracts.md：
 * - §3 数据模型（Address / CartItem / Order / OrderItem / OrderStatusHistory / PaymentSession / ShipmentEvent）
 * - §6 地址簿
 * - §7 购物车
 * - §8 下单与订单管理
 * - §9 支付模拟
 *
 * 命名与后端 snake_case 保持一致，避免手工映射错位。
 */

import type { ShopBrief, SKUOut } from "./catalog";

/** ---------- Address ---------- */

export interface UserAddress {
  id: number;
  user_id: number;
  receiver_name: string;
  receiver_phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  postal_code: string | null;
  is_default: boolean;
  /** Phase 5 追加：三级地区码，允许历史数据为 null。 */
  province_code?: string | null;
  city_code?: string | null;
  district_code?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressPayload {
  receiver_name: string;
  receiver_phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  postal_code?: string | null;
  is_default?: boolean;
  /** Phase 5 追加：三级 code，可选。 */
  province_code?: string | null;
  city_code?: string | null;
  district_code?: string | null;
}

export interface UpdateAddressPayload {
  receiver_name?: string;
  receiver_phone?: string;
  province?: string;
  city?: string;
  district?: string;
  detail?: string;
  postal_code?: string | null;
  is_default?: boolean;
  province_code?: string | null;
  city_code?: string | null;
  district_code?: string | null;
}

/** ---------- Cart ---------- */

/** 失效商品原因。 */
export type CartItemInvalidReason =
  | "spu_removed"
  | "spu_not_approved"
  | "sku_inactive"
  | "sku_removed"
  | "out_of_stock";

/** SPU 快照：购物车/结算/订单里都要展示的最少字段。 */
export interface CartSpuBrief {
  id: number;
  title: string;
  main_image: string;
  status?: string;
}

export interface CartItem {
  id: number;
  sku_id: number;
  quantity: number;
  selected: boolean;
  /** 后端读时计算：valid = 可下单；invalid = 已下架/库存不足等 */
  status: "valid" | "invalid";
  invalid_reason: CartItemInvalidReason | string | null;
  sku: SKUOut;
  spu: CartSpuBrief;
}

export interface CartShopGroup {
  shop: ShopBrief;
  items: CartItem[];
  /** 该店铺被选中项小计（分） */
  subtotal_cents_selected: number;
}

export interface CartResponse {
  groups: CartShopGroup[];
  total_cents_selected: number;
  total_selected_count: number;
  invalid_count: number;
}

export interface AddToCartPayload {
  sku_id: number;
  quantity: number;
}

export interface UpdateCartItemPayload {
  quantity?: number;
  selected?: boolean;
}

/** ---------- Order status ---------- */

export enum OrderStatus {
  PendingPayment = "pending_payment",
  Paid = "paid",
  Shipped = "shipped",
  Completed = "completed",
  Cancelled = "cancelled",
  Closed = "closed",
}

/** 后端订单状态的中文标签 —— 用户端友好展示。 */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PendingPayment]: "待支付",
  [OrderStatus.Paid]: "待发货",
  [OrderStatus.Shipped]: "待收货",
  [OrderStatus.Completed]: "已完成",
  [OrderStatus.Cancelled]: "已取消",
  [OrderStatus.Closed]: "已关闭",
};

export type CancelReason =
  | "user_cancel"
  | "payment_timeout"
  | "merchant_cancel"
  | "admin_intervene"
  | "out_of_stock";

/** ---------- OrderItem ---------- */

export interface OrderItem {
  id: number;
  order_id: number;
  sku_id: number;
  spu_id: number;
  shop_id: number;
  spu_title: string;
  sku_specs: Record<string, string>;
  sku_image: string | null;
  unit_price_cents: number;
  quantity: number;
  subtotal_cents: number;
  created_at: string;
}

/** ---------- Order status history ---------- */

export interface OrderStatusHistoryEntry {
  id: number;
  order_id: number;
  from_status: string | null;
  to_status: string;
  actor_type: "user" | "merchant" | "admin" | "system";
  actor_id: number | null;
  note: string | null;
  created_at: string;
}

/** ---------- Order（列表 / 详情） ---------- */

export interface OrderListItem {
  id: number;
  order_no: string;
  shop: ShopBrief;
  status: OrderStatus;
  subtotal_cents: number;
  shipping_fee_cents: number;
  discount_cents: number;
  total_cents: number;
  payment_deadline_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  /** 列表里冗余带前 N 件的快照 —— 前端做卡片式渲染 */
  items: OrderItem[];
  items_count: number;
}

export interface PaymentSessionBrief {
  id: number;
  channel: PaymentChannel;
  amount_cents: number;
  status: PaymentSessionStatus;
  external_txn_no: string | null;
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ShipmentEvent {
  id: number;
  order_id: number;
  event_type:
    | "picked_up"
    | "in_transit"
    | "arrived_city"
    | "out_for_delivery"
    | "delivered";
  description: string;
  event_time: string;
  created_at: string;
}

export interface OrderDetail extends OrderListItem {
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  user_note: string | null;
  merchant_note: string | null;
  cancel_reason: CancelReason | null;
  cancel_note: string | null;
  shipping_carrier: string | null;
  tracking_no: string | null;
  auto_complete_at: string | null;
  status_history: OrderStatusHistoryEntry[];
  payment_sessions: PaymentSessionBrief[];
  shipment_events: ShipmentEvent[];
}

/** ---------- Preview / Create ---------- */

export interface PreviewOrderPayload {
  cart_item_ids: number[];
  address_id: number;
}

export interface PreviewOrderGroup {
  shop: ShopBrief;
  items: CartItem[];
  subtotal_cents: number;
  shipping_fee_cents: number;
  total_cents: number;
}

export interface PreviewOrderWarning {
  type: "invalid_sku" | "stock_short" | string;
  message: string;
  cart_item_id: number;
}

export interface PreviewOut {
  address: UserAddress;
  groups_by_shop: PreviewOrderGroup[];
  grand_total_cents: number;
  warnings: PreviewOrderWarning[];
}

export interface CreateOrderPayload {
  cart_item_ids: number[];
  address_id: number;
  user_note?: string;
}

export interface CreateOrderResultItem {
  id: number;
  order_no: string;
  total_cents: number;
  shop: ShopBrief;
  payment_deadline_at: string;
}

export interface CreateOrderOut {
  orders: CreateOrderResultItem[];
}

/** ---------- Order 列表查询 ---------- */

export interface OrderListQuery {
  /** 多个用逗号拼：`pending_payment,paid` */
  status?: OrderStatus | string;
  keyword?: string;
  page?: number;
  size?: number;
}

/** ---------- Payment ---------- */

export type PaymentChannel = "mock_alipay" | "mock_wechat" | "mock_bank";

export const PAYMENT_CHANNEL_LABEL: Record<PaymentChannel, string> = {
  mock_alipay: "支付宝",
  mock_wechat: "微信支付",
  mock_bank: "银行卡",
};

export type PaymentSessionStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "expired";

export interface CreatePaymentSessionPayload {
  channel: PaymentChannel;
}

export interface PaymentSession {
  session_id: number;
  order_id: number;
  channel: PaymentChannel;
  amount_cents: number;
  status: PaymentSessionStatus;
  mock_pay_url: string;
  expires_at: string;
  external_txn_no: string | null;
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
}

/** ---------- Shipment ---------- */

export interface ShipmentInfo {
  carrier: string | null;
  tracking_no: string | null;
  events: ShipmentEvent[];
}

/** ---------- Cancel / Note payloads ---------- */

export interface CancelOrderPayload {
  cancel_note?: string;
}
