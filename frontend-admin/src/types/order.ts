/**
 * Phase 3 订单相关类型（Admin 视角）。
 *
 * 与 docs/API/phase-3-contracts.md §3、§11、§12 严格对齐：
 * - §3 数据模型：Order / OrderItem / OrderStatusHistory / PaymentSession / ShipmentEvent
 * - §11 Admin 订单端点
 * - §12 超时任务扫描
 *
 * 命名约定：字段全部 snake_case，与后端 JSON 一致。金额字段一律为整数分
 * （`_cents` 后缀）；前端展示时除以 100 得到元。
 */

// ---------------------------------------------------------------------------
// 枚举 & 基础
// ---------------------------------------------------------------------------

/**
 * 契约 §3.3 / §4 订单状态机 6 态。
 * `closed` 仅 Phase 3 保留字段，Phase 4 售后完成后订单转此。
 */
export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "shipped"
  | "completed"
  | "cancelled"
  | "closed";

/**
 * 契约 §3.3 取消原因。
 */
export type OrderCancelReason =
  | "user_cancel"
  | "payment_timeout"
  | "merchant_cancel"
  | "admin_intervene"
  | "out_of_stock";

/**
 * 契约 §3.5 订单状态历史 actor 类型。
 * - user: 用户主动操作
 * - merchant: 商家操作
 * - admin: 管理员干预
 * - system: 超时扫描 / 自动流转
 */
export type OrderActorType = "user" | "merchant" | "admin" | "system";

/**
 * 契约 §3.6 支付会话状态。
 */
export type PaymentSessionStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "expired";

/**
 * 契约 §3.6 支付渠道（Phase 3 全部为 mock）。
 */
export type PaymentChannel = "mock_alipay" | "mock_wechat" | "mock_bank";

/**
 * 契约 §3.7 物流事件类型。
 */
export type ShipmentEventType =
  | "picked_up"
  | "in_transit"
  | "arrived_city"
  | "out_for_delivery"
  | "delivered";

// ---------------------------------------------------------------------------
// 关联摘要
// ---------------------------------------------------------------------------

/**
 * 店铺摘要（Admin 列表 join 展示）。
 */
export interface OrderShopBrief {
  id: number;
  name: string;
  contact_name?: string | null;
  contact_phone?: string | null;
}

/**
 * 用户摘要（Admin 列表 join 展示）。
 *
 * Admin 端有权看用户手机 / 邮箱明文（业务需要），但仍不应在日志中输出。
 */
export interface OrderUserBrief {
  id: number;
  nickname: string | null;
  phone: string | null;
  email: string | null;
}

// ---------------------------------------------------------------------------
// 明细 & 事件
// ---------------------------------------------------------------------------

/**
 * 订单商品明细（快照）。契约 §3.4。
 */
export interface OrderItemOut {
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

/**
 * 订单状态历史。契约 §3.5。
 * 用于 Admin 详情页时间轴：actor_type 决定徽章颜色（system 灰 / user 蓝 /
 * merchant 绿 / admin 红）。
 */
export interface OrderStatusHistoryOut {
  id: number;
  order_id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_type: OrderActorType;
  actor_id: number | null;
  /** actor 显示名（后端 join 可选返回；无则前端展示 `<actor_type> #<actor_id>`） */
  actor_display_name?: string | null;
  note: string | null;
  created_at: string;
}

/**
 * 支付会话。契约 §3.6。
 * Admin 视角可看 external_txn_no。
 */
export interface PaymentSessionOut {
  id: number;
  order_id: number;
  channel: PaymentChannel;
  amount_cents: number;
  status: PaymentSessionStatus;
  external_txn_no: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/**
 * 物流事件（模拟）。契约 §3.7。
 */
export interface OrderShipmentEvent {
  id: number;
  order_id: number;
  event_type: ShipmentEventType;
  description: string;
  event_time: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Admin 订单列表 & 详情
// ---------------------------------------------------------------------------

/**
 * Admin 跨店订单列表元素（契约 §11 GET /admin/orders）。
 */
export interface AdminOrderListItem {
  id: number;
  order_no: string;
  user_id: number;
  user?: OrderUserBrief | null;
  shop_id: number;
  shop?: OrderShopBrief | null;
  status: OrderStatus;
  subtotal_cents: number;
  shipping_fee_cents: number;
  discount_cents: number;
  total_cents: number;
  receiver_name: string;
  receiver_phone: string;
  /** 商品件数（sum(quantity)），后端在列表接口 join 计算 */
  item_count: number;
  cancel_reason: OrderCancelReason | null;
  payment_deadline_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Admin 订单详情（契约 §11 GET /admin/orders/{id}）。
 *
 * 完整字段 + admin_note + payment_sessions.external_txn_no。
 */
export interface AdminOrderDetail extends AdminOrderListItem {
  receiver_address: string;
  user_note: string | null;
  merchant_note: string | null;
  /** 管理员内部备注（对用户/商家不可见） */
  admin_note: string | null;
  shipping_carrier: string | null;
  tracking_no: string | null;
  auto_complete_at: string | null;
  cancel_note: string | null;
  idempotency_key: string | null;
  items: readonly OrderItemOut[];
  status_history: readonly OrderStatusHistoryOut[];
  /** 所有支付会话（可能多次尝试，含失败/过期） */
  payment_sessions: readonly PaymentSessionOut[];
  shipment_events: readonly OrderShipmentEvent[];
}

/**
 * Admin 平台看板（契约 §11 GET /admin/orders/stats/overview）。
 */
export interface AdminOrderOverview {
  orders_today_count: number;
  orders_today_gmv_cents: number;
  pending_payment_count: number;
  pending_ship_count: number;
  shipped_count: number;
  cancelled_today_count: number;
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

/**
 * POST /admin/orders/{id}/cancel 请求体（契约 §11）。
 *
 * cancel_note 必填 ≥ 10 字符（Admin 端比商家更严格，见任务说明）。
 */
export interface AdminCancelOrderPayload {
  cancel_note: string;
}

/**
 * POST /admin/orders/{id}/note 请求体（契约 §11）。
 */
export interface AdminAddNotePayload {
  admin_note: string;
}

/**
 * POST /admin/orders/{id}/logistics/simulate 请求体（契约 §11）。
 */
export interface SimulateLogisticsPayload {
  event_type: ShipmentEventType;
  description: string;
}

// ---------------------------------------------------------------------------
// 超时任务
// ---------------------------------------------------------------------------

/**
 * POST /admin/tasks/process-timeouts 响应结构（契约 §12）。
 *
 * 后端返回本次扫描处理的订单数分类：
 * - cancelled_expired_count: pending_payment → cancelled（支付超时）
 * - auto_completed_count: shipped → completed（自动确认收货）
 */
export interface ProcessTimeoutsResult {
  cancelled_expired_count: number;
  auto_completed_count: number;
  /** 服务端执行时长（毫秒），仅供调试参考 */
  duration_ms?: number;
  /** 服务端本次扫描的时间戳 */
  scanned_at?: string;
}
