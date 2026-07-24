/**
 * Phase 4 售后相关类型（Admin 视角）。
 *
 * 与 docs/API/phase-4-contracts.md §4 / §5 / §9 严格对齐：
 * - §4 数据模型（Aftersales / Items / History / Evidence / Message）
 * - §5 12 态状态机
 * - §9 Admin 端 endpoints
 *
 * 命名约定：字段全部 snake_case；金额整数分（`_cents` 后缀）。
 */

// ---------------------------------------------------------------------------
// 枚举
// ---------------------------------------------------------------------------

/** 契约 §2 三种售后类型。 */
export type AftersalesType = "refund_only" | "return_refund" | "exchange";

/** 契约 §5 12 态售后状态机。 */
export type AftersalesStatus =
  | "pending_merchant_review"
  | "merchant_rejected"
  | "merchant_agreed_waiting_return"
  | "return_shipped_waiting_receive"
  | "merchant_agreed_waiting_ship"
  | "exchange_shipped_waiting_receive"
  | "refunding"
  | "admin_arbitrating"
  | "completed_refunded"
  | "completed_exchanged"
  | "user_cancelled"
  | "system_closed";

/** 契约 §4.1 售后原因分类。 */
export type AftersalesReasonCategory =
  | "quality_issue"
  | "wrong_item"
  | "damage_in_transit"
  | "not_as_described"
  | "no_longer_needed"
  | "duplicate_purchase"
  | "other";

/**
 * 契约 §4.1 升级到平台的原因（5 种，含商家拒收）。
 * - merchant_timeout: 商家超时未审核（72h）
 * - user_appeal: 用户申诉（merchant_rejected 后）
 * - risk_flagged: 风控命中（跳过商家审核）
 * - manual: 客服手动升级
 * - merchant_refuse_receive: 商家拒收（return_shipped_waiting_receive）
 */
export type EscalationReason =
  | "merchant_timeout"
  | "user_appeal"
  | "risk_flagged"
  | "manual"
  | "merchant_refuse_receive";

/** 契约 §9.3 仲裁裁决 outcome。 */
export type ArbitrationOutcome =
  | "side_with_user"
  | "side_with_merchant"
  | "partial_refund"
  | "other";

/** 契约 §4.1 售后关闭原因。 */
export type AftersalesCloseReason =
  | "user_cancelled"
  | "completed"
  | "user_ship_timeout"
  | "arbitration_closed"
  | "auto_confirmed"
  | "system_closed";

/** 契约 §4.3 状态历史 actor 类型。 */
export type AftersalesActorType = "user" | "merchant" | "admin" | "system";

/** 契约 §4.4 凭证 stage 分组。 */
export type EvidenceStage =
  | "apply"
  | "merchant_review"
  | "user_return"
  | "merchant_receive"
  | "exchange_ship"
  | "appeal"
  | "arbitration";

/** 契约 §4.5 消息 kind。 */
export type AftersalesMessageKind =
  | "nudge"
  | "appeal"
  | "reply"
  | "system_notice";

// ---------------------------------------------------------------------------
// 关联摘要
// ---------------------------------------------------------------------------

/** 店铺摘要（列表 join 展示）。 */
export interface AftersalesShopBrief {
  id: number;
  name: string;
  contact_name?: string | null;
  contact_phone?: string | null;
}

/**
 * 用户摘要（列表 join 展示）。
 * Admin 有权看明文手机 / 邮箱（业务需要，见任务约束）。
 */
export interface AftersalesUserBrief {
  id: number;
  nickname: string | null;
  phone: string | null;
  email: string | null;
}

/** 关联订单摘要（详情页展示）。 */
export interface AftersalesOrderBrief {
  id: number;
  order_no: string;
  status: string;
  total_cents: number;
  created_at: string;
  paid_at?: string | null;
}

/** 当前仲裁员摘要（详情页展示"已由谁认领"）。 */
export interface ArbitratorAdminBrief {
  id: number;
  username: string;
  display_name?: string | null;
}

// ---------------------------------------------------------------------------
// 子记录
// ---------------------------------------------------------------------------

/** 售后明细（部分退款用）。契约 §4.2。 */
export interface AftersalesItemOut {
  id: number;
  aftersales_id: number;
  order_item_id: number;
  /** 快照：SPU/SKU 摘要（后端 join 返回） */
  spu_id?: number;
  sku_id?: number;
  spu_title?: string;
  sku_specs?: Record<string, string>;
  sku_image?: string | null;
  unit_price_cents?: number;
  quantity: number;
  refund_amount_cents: number;
  created_at: string;
}

/** 售后状态历史。契约 §4.3。 */
export interface AftersalesStatusHistoryOut {
  id: number;
  aftersales_id: number;
  from_status: AftersalesStatus | null;
  to_status: AftersalesStatus;
  actor_type: AftersalesActorType;
  actor_id: number | null;
  /** actor 显示名（后端 join 可选返回；无则前端展示 `<actor_type> #<actor_id>`） */
  actor_display_name?: string | null;
  note: string | null;
  created_at: string;
}

/** 售后凭证。契约 §4.4。 */
export interface AftersalesEvidenceOut {
  id: number;
  aftersales_id: number;
  uploader_type: Exclude<AftersalesActorType, "system">;
  uploader_id: number;
  stage: EvidenceStage;
  /** MinIO object_key，前端渲染需拼 NEXT_PUBLIC_IMAGE_CDN */
  image_url: string;
  note: string | null;
  created_at: string;
}

/**
 * 售后消息。契约 §4.5。
 * - kind=nudge  用户催办
 * - kind=appeal 用户申诉
 * - kind=reply  商家 / admin 回复（Phase 4 也作为 admin 内部备注写入）
 * - kind=system_notice 系统通知（超时升级等，灰色斜体展示）
 */
export interface AftersalesMessageOut {
  id: number;
  aftersales_id: number;
  sender_type: AftersalesActorType;
  sender_id: number | null;
  sender_display_name?: string | null;
  kind: AftersalesMessageKind;
  content: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 列表 & 详情
// ---------------------------------------------------------------------------

/**
 * Admin 售后列表元素（契约 §9.1 GET /admin/aftersales）。
 * 只挑列表 UI 需要的字段；完整字段见 Detail。
 */
export interface AdminAftersalesListItem {
  id: number;
  aftersales_no: string;
  order_id: number;
  order_no: string;
  user_id: number;
  user?: AftersalesUserBrief | null;
  shop_id: number;
  shop?: AftersalesShopBrief | null;
  type: AftersalesType;
  status: AftersalesStatus;
  reason_category: AftersalesReasonCategory;
  refund_amount_cents: number;
  actual_refund_cents: number | null;
  escalation_reason: EscalationReason | null;
  escalated_at: string | null;
  arbitrator_admin_id: number | null;
  arbitrator_admin?: ArbitratorAdminBrief | null;
  merchant_review_deadline: string;
  merchant_reviewed_at: string | null;
  refunded_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Admin 售后详情（契约 §9.1 GET /admin/aftersales/{id}）。
 *
 * 含完整字段 + items + status_history + evidences + messages。
 * admin_note 通过 aftersales_messages(kind='reply', sender_type='admin') 写入；
 * 前端可从 messages 里过滤出 admin 的最新一条 reply 作为"内部备注"展示。
 */
export interface AdminAftersalesDetail extends AdminAftersalesListItem {
  reason_note: string;
  merchant_review_note: string | null;
  return_address: string | null;
  return_carrier: string | null;
  return_tracking_no: string | null;
  return_shipped_at: string | null;
  return_ship_deadline: string | null;
  merchant_received_at: string | null;
  merchant_receive_deadline: string | null;
  merchant_refuse_receive: boolean;
  merchant_refuse_note: string | null;
  exchange_carrier: string | null;
  exchange_tracking_no: string | null;
  exchange_shipped_at: string | null;
  exchange_confirm_deadline: string | null;
  exchange_confirmed_at: string | null;
  arbitrated_at: string | null;
  arbitration_conclusion: string | null;
  arbitration_outcome: ArbitrationOutcome | null;
  refund_txn_no: string | null;
  close_reason: AftersalesCloseReason | null;
  nudge_count: number;
  last_nudged_at: string | null;
  appeal_count: number;
  order?: AftersalesOrderBrief | null;
  items: readonly AftersalesItemOut[];
  status_history: readonly AftersalesStatusHistoryOut[];
  evidences: readonly AftersalesEvidenceOut[];
  messages: readonly AftersalesMessageOut[];
}

// ---------------------------------------------------------------------------
// Admin 大盘统计（契约 §9.6）
// ---------------------------------------------------------------------------

export interface AftersalesStatsOverview {
  /** 待商家审核数（pending_merchant_review） */
  pending_review_count: number;
  /** 待仲裁数（admin_arbitrating 且 arbitrator_admin_id 为空） */
  escalated_pending_count: number;
  /** 处理中总数（所有非终态） */
  in_progress_count: number;
  /** 今日已解决 */
  resolved_today_count: number;
  /** 平均解决时长（小时） */
  avg_resolution_hours: number;
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

/**
 * 契约 §9.3 POST /admin/aftersales/{id}/resolve 请求体。
 *
 * 前端校验：
 * - conclusion 必填 ≥ 20 字
 * - outcome != side_with_merchant 时 actual_refund_cents 必填 & > 0
 * - side_with_merchant 时 actual_refund_cents 前端隐藏（可不传或传 null）
 */
export interface ResolveArbitrationPayload {
  outcome: Exclude<ArbitrationOutcome, "other">;
  conclusion: string;
  actual_refund_cents?: number | null;
  evidence_image_keys?: string[];
}

/**
 * 契约 §9.4 POST /admin/aftersales/{id}/force-refund 请求体。
 *
 * 前端校验：
 * - amount_cents > 0
 * - note ≥ 10 字
 * - 二次勾选确认
 */
export interface ForceRefundPayload {
  amount_cents: number;
  note: string;
}

/**
 * 契约 §9.5 POST /admin/aftersales/{id}/note 请求体。
 * 写入 aftersales_messages(kind='reply', sender_type='admin')。
 */
export interface AddAdminAftersalesNotePayload {
  note: string;
}
