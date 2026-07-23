/**
 * Phase 3 · 商家端订单域类型定义。
 *
 * 严格对齐 docs/API/phase-3-contracts.md：
 * - §3.3 / §3.4 / §3.5 / §3.7 数据模型
 * - §4 状态机
 * - §10 商家订单端点
 *
 * 命名保持后端 snake_case，避免手工映射错位；仅在展示层做局部转换。
 */

/** ---------- 订单状态 ---------- */

export const OrderStatus = {
  PendingPayment: "pending_payment",
  Paid: "paid",
  Shipped: "shipped",
  Completed: "completed",
  Cancelled: "cancelled",
  Closed: "closed",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** 商家侧订单状态的中文标签。 */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PendingPayment]: "待付款",
  [OrderStatus.Paid]: "待发货",
  [OrderStatus.Shipped]: "已发货",
  [OrderStatus.Completed]: "已完成",
  [OrderStatus.Cancelled]: "已取消",
  [OrderStatus.Closed]: "已关闭",
};

/** 订单被取消时的原因（对齐 backend `CancelReason`）。 */
export type CancelReason =
  | "user_cancel"
  | "payment_timeout"
  | "merchant_cancel"
  | "admin_intervene"
  | "out_of_stock";

export const CANCEL_REASON_LABEL: Record<CancelReason, string> = {
  user_cancel: "用户主动取消",
  payment_timeout: "支付超时",
  merchant_cancel: "商家取消（缺货等）",
  admin_intervene: "平台干预",
  out_of_stock: "库存不足",
};

/** ---------- 订单商品项 ---------- */

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

/** ---------- 订单状态历史 ---------- */

export interface OrderStatusHistoryItem {
  id: number;
  order_id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_type: "user" | "merchant" | "admin" | "system";
  actor_id: number | null;
  note: string | null;
  created_at: string;
}

/** ---------- 物流事件（模拟） ---------- */

export type ShipmentEventType =
  | "picked_up"
  | "in_transit"
  | "arrived_city"
  | "out_for_delivery"
  | "delivered";

export const SHIPMENT_EVENT_LABEL: Record<ShipmentEventType, string> = {
  picked_up: "已揽收",
  in_transit: "运输中",
  arrived_city: "到达城市",
  out_for_delivery: "派送中",
  delivered: "已签收",
};

export interface ShipmentEvent {
  id: number;
  order_id: number;
  event_type: ShipmentEventType;
  description: string;
  event_time: string;
  created_at: string;
}

/** ---------- 商家订单列表项 ---------- */

/**
 * 商家订单列表的一项 —— 与后端 §10.1 返回结构对齐。
 * 列表接口冗余带前若干件 items 快照，便于卡片渲染。
 */
export interface MerchantOrderListItem {
  id: number;
  order_no: string;
  user_id: number;
  status: OrderStatus;
  subtotal_cents: number;
  shipping_fee_cents: number;
  discount_cents: number;
  total_cents: number;
  receiver_name: string;
  receiver_phone: string;
  payment_deadline_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  /** 前 N 件 items 快照 —— 用于列表页 "iPhone x2 + 2件" 展示 */
  items: OrderItem[];
  items_count: number;
}

/** ---------- 商家订单详情 ---------- */

export interface MerchantOrderDetail extends MerchantOrderListItem {
  receiver_address: string;
  user_note: string | null;
  merchant_note: string | null;
  cancel_reason: CancelReason | null;
  cancel_note: string | null;
  shipping_carrier: string | null;
  tracking_no: string | null;
  auto_complete_at: string | null;
  status_history: OrderStatusHistoryItem[];
  shipment_events: ShipmentEvent[];
}

/** ---------- 列表查询 ---------- */

export interface MerchantOrderListQuery {
  /** 单值或多值（后者以逗号分隔："paid,shipped"） */
  status?: OrderStatus | string;
  keyword?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  size?: number;
}

/** ---------- 操作 payload ---------- */

export interface ShipOrderPayload {
  /** 快递公司代码（"SF" / "YTO" / ...） */
  carrier: string;
  /** 快递单号（6-30 字符 alphanumeric，§10.3） */
  tracking_no: string;
}

export interface CancelOrderPayload {
  cancel_note: string;
}

export interface AddMerchantNotePayload {
  merchant_note: string;
}

/** ---------- 商家看板 stats（§10.3 stats/summary） ---------- */

export interface MerchantOrderStats {
  pending_payment_count: number;
  /** 待发货（paid 但未 shipped） */
  paid_pending_ship_count: number;
  shipped_count: number;
  completed_today_count: number;
  revenue_today_cents: number;
}
