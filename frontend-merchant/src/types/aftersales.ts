/**
 * Phase 4 · 商家端售后域类型定义。
 *
 * 严格对齐 docs/API/phase-4-contracts.md：
 * - §4 数据模型（Aftersales / AftersalesItem / StatusHistory / Evidence / Message）
 * - §5 12 态状态机
 * - §8 Merchant 端接口
 *
 * 命名保持后端 snake_case；避免手工映射错位。
 *
 * 备注：类型定义与 user-web/admin 通用，尽量按契约完整覆盖字段；
 *      商家侧列表 API 只回显必要子集，故拆分 `MerchantAftersalesListItem` 与
 *      `MerchantAftersalesDetail` 两类。
 */

// ---------- 售后类型 ---------------------------------------------------------

export const AftersalesType = {
  RefundOnly: "refund_only",
  ReturnRefund: "return_refund",
  Exchange: "exchange",
} as const;

export type AftersalesType = (typeof AftersalesType)[keyof typeof AftersalesType];

export const AFTERSALES_TYPE_LABEL: Record<AftersalesType, string> = {
  [AftersalesType.RefundOnly]: "仅退款",
  [AftersalesType.ReturnRefund]: "退货退款",
  [AftersalesType.Exchange]: "换货",
};

// ---------- 售后状态（12 态，§5） -------------------------------------------

export const AftersalesStatus = {
  PendingMerchantReview: "pending_merchant_review",
  MerchantRejected: "merchant_rejected",
  MerchantAgreedWaitingReturn: "merchant_agreed_waiting_return",
  ReturnShippedWaitingReceive: "return_shipped_waiting_receive",
  MerchantAgreedWaitingShip: "merchant_agreed_waiting_ship",
  ExchangeShippedWaitingReceive: "exchange_shipped_waiting_receive",
  Refunding: "refunding",
  AdminArbitrating: "admin_arbitrating",
  CompletedRefunded: "completed_refunded",
  CompletedExchanged: "completed_exchanged",
  UserCancelled: "user_cancelled",
  SystemClosed: "system_closed",
} as const;

export type AftersalesStatus =
  (typeof AftersalesStatus)[keyof typeof AftersalesStatus];

export const AFTERSALES_STATUS_LABEL: Record<AftersalesStatus, string> = {
  [AftersalesStatus.PendingMerchantReview]: "待审核",
  [AftersalesStatus.MerchantRejected]: "已驳回",
  [AftersalesStatus.MerchantAgreedWaitingReturn]: "同意退货 · 待寄回",
  [AftersalesStatus.ReturnShippedWaitingReceive]: "已寄回 · 待收货",
  [AftersalesStatus.MerchantAgreedWaitingShip]: "已收货 · 待再发货",
  [AftersalesStatus.ExchangeShippedWaitingReceive]: "已再发货 · 待用户确认",
  [AftersalesStatus.Refunding]: "退款中",
  [AftersalesStatus.AdminArbitrating]: "平台仲裁中",
  [AftersalesStatus.CompletedRefunded]: "退款完成",
  [AftersalesStatus.CompletedExchanged]: "换货完成",
  [AftersalesStatus.UserCancelled]: "用户已撤销",
  [AftersalesStatus.SystemClosed]: "系统关闭",
};

/** 终态集合：无操作可做。 */
export const AFTERSALES_FINAL_STATUSES: ReadonlySet<AftersalesStatus> = new Set([
  AftersalesStatus.CompletedRefunded,
  AftersalesStatus.CompletedExchanged,
  AftersalesStatus.UserCancelled,
  AftersalesStatus.SystemClosed,
]);

export function isFinalStatus(s: AftersalesStatus): boolean {
  return AFTERSALES_FINAL_STATUSES.has(s);
}

// ---------- 申请原因 --------------------------------------------------------

export type AftersalesReasonCategory =
  | "quality_issue"
  | "wrong_item"
  | "damage_in_transit"
  | "not_as_described"
  | "no_longer_needed"
  | "duplicate_purchase"
  | "other";

export const AFTERSALES_REASON_LABEL: Record<AftersalesReasonCategory, string> = {
  quality_issue: "质量问题",
  wrong_item: "发错货",
  damage_in_transit: "运输损坏",
  not_as_described: "货不对板",
  no_longer_needed: "不想要了",
  duplicate_purchase: "重复购买",
  other: "其他",
};

// ---------- 升级 / 关闭原因 --------------------------------------------------

export type EscalationReason =
  | "merchant_timeout"
  | "user_appeal"
  | "risk_flagged"
  | "manual"
  | "merchant_refuse_receive";

export const ESCALATION_REASON_LABEL: Record<EscalationReason, string> = {
  merchant_timeout: "商家超时未审核",
  user_appeal: "用户申诉",
  risk_flagged: "风控命中",
  manual: "人工介入",
  merchant_refuse_receive: "商家拒收升级",
};

export type CloseReason =
  | "user_cancelled"
  | "completed"
  | "user_ship_timeout"
  | "arbitration_closed"
  | "auto_confirmed"
  | "system_closed";

export const CLOSE_REASON_LABEL: Record<CloseReason, string> = {
  user_cancelled: "用户撤销",
  completed: "已完成",
  user_ship_timeout: "用户超时未寄回",
  arbitration_closed: "仲裁关闭",
  auto_confirmed: "超时自动确认",
  system_closed: "系统关闭",
};

// ---------- 明细 / 历史 / 凭证 / 消息 ---------------------------------------

export interface AftersalesItem {
  id: number;
  aftersales_id: number;
  order_item_id: number;
  quantity: number;
  refund_amount_cents: number;
  /** 后端聚合字段（可选）—— 便于前端不再联查 orders */
  spu_title?: string;
  sku_specs?: Record<string, string>;
  sku_image?: string | null;
  unit_price_cents?: number;
}

export type AftersalesActorType = "user" | "merchant" | "admin" | "system";

export const ACTOR_LABEL: Record<AftersalesActorType, string> = {
  user: "用户",
  merchant: "商家",
  admin: "平台",
  system: "系统",
};

export interface AftersalesStatusHistoryItem {
  id: number;
  aftersales_id: number;
  from_status: AftersalesStatus | null;
  to_status: AftersalesStatus;
  actor_type: AftersalesActorType;
  actor_id: number | null;
  note: string | null;
  created_at: string;
}

export type AftersalesEvidenceStage =
  | "apply"
  | "merchant_review"
  | "user_return"
  | "merchant_receive"
  | "exchange_ship"
  | "appeal"
  | "arbitration";

export const EVIDENCE_STAGE_LABEL: Record<AftersalesEvidenceStage, string> = {
  apply: "用户申请",
  merchant_review: "商家审核",
  user_return: "用户寄回",
  merchant_receive: "商家收货",
  exchange_ship: "商家再发货",
  appeal: "用户申诉",
  arbitration: "平台仲裁",
};

export interface AftersalesEvidence {
  id: number;
  aftersales_id: number;
  uploader_type: "user" | "merchant" | "admin";
  uploader_id: number;
  stage: AftersalesEvidenceStage;
  image_url: string;
  note: string | null;
  created_at: string;
}

export type AftersalesMessageKind =
  | "nudge"
  | "appeal"
  | "reply"
  | "system_notice";

export const MESSAGE_KIND_LABEL: Record<AftersalesMessageKind, string> = {
  nudge: "催办",
  appeal: "申诉",
  reply: "回复",
  system_notice: "系统通知",
};

export interface AftersalesMessage {
  id: number;
  aftersales_id: number;
  sender_type: AftersalesActorType;
  sender_id: number | null;
  kind: AftersalesMessageKind;
  content: string;
  created_at: string;
}

// ---------- 商家端列表 / 详情 -----------------------------------------------

/**
 * 列表项（`GET /merchant/aftersales`）。
 *
 * 冗余带 items 快照方便卡片展示；金额字段一律分。
 */
export interface MerchantAftersalesListItem {
  id: number;
  aftersales_no: string;
  order_id: number;
  order_no: string;
  user_id: number;
  /** 后端聚合展示名（脱敏后的账号或昵称）。 */
  user_display_name: string | null;
  shop_id: number;
  type: AftersalesType;
  status: AftersalesStatus;
  reason_category: AftersalesReasonCategory;
  reason_note: string;
  refund_amount_cents: number;
  actual_refund_cents: number | null;
  items_count: number;
  merchant_review_deadline: string;
  merchant_reviewed_at: string | null;
  escalated_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 详情（`GET /merchant/aftersales/{id}`）。
 * 相较列表增补：items 明细 / 状态历史 / 凭证 / 消息 / 各类物流字段。
 */
export interface MerchantAftersalesDetail extends MerchantAftersalesListItem {
  reason_note: string;
  return_address: string | null;
  return_carrier: string | null;
  return_tracking_no: string | null;
  return_shipped_at: string | null;
  return_ship_deadline: string | null;
  merchant_received_at: string | null;
  merchant_receive_deadline: string | null;
  merchant_refuse_receive: boolean;
  merchant_refuse_note: string | null;
  merchant_review_note: string | null;
  exchange_carrier: string | null;
  exchange_tracking_no: string | null;
  exchange_shipped_at: string | null;
  exchange_confirm_deadline: string | null;
  exchange_confirmed_at: string | null;
  escalation_reason: EscalationReason | null;
  arbitrator_admin_id: number | null;
  arbitrated_at: string | null;
  arbitration_conclusion: string | null;
  arbitration_outcome: string | null;
  refunded_at: string | null;
  refund_txn_no: string | null;
  closed_at: string | null;
  close_reason: CloseReason | null;
  nudge_count: number;
  last_nudged_at: string | null;
  appeal_count: number;

  /** 用户联系电话（后端已脱敏或前端再脱敏，避免直接暴露） */
  user_phone: string | null;
  /** 订单收货信息（换货再发货用；后端在 detail 中冗余带出） */
  receiver_name: string | null;
  receiver_phone: string | null;
  receiver_address: string | null;

  items: AftersalesItem[];
  status_history: AftersalesStatusHistoryItem[];
  evidences: AftersalesEvidence[];
  messages: AftersalesMessage[];
}

// ---------- 列表查询 --------------------------------------------------------

export interface MerchantAftersalesListQuery {
  status?: AftersalesStatus | "" | string;
  type?: AftersalesType | "";
  keyword?: string;
  /** 过滤"审核 deadline < 24h" */
  overdue_soon?: boolean;
  page?: number;
  size?: number;
}

// ---------- 操作 payload ---------------------------------------------------

/** `POST /merchant/aftersales/{id}/approve` */
export interface ApproveAftersalesPayload {
  actual_refund_cents: number;
  /** RETURN_REFUND/EXCHANGE 必填 */
  return_address?: string;
  review_note?: string;
}

/** `POST /merchant/aftersales/{id}/reject` */
export interface RejectAftersalesPayload {
  /** ≥ 5 字必填 */
  review_note: string;
}

/** `POST /merchant/aftersales/{id}/confirm-received` */
export interface ConfirmReceivedPayload {
  note?: string;
  evidence_image_keys?: string[];
}

/** `POST /merchant/aftersales/{id}/refuse-receive` */
export interface RefuseReceivePayload {
  /** ≥ 10 字必填 */
  refuse_note: string;
  evidence_image_keys?: string[];
}

/** `POST /merchant/aftersales/{id}/ship-exchange` */
export interface ShipExchangePayload {
  carrier: string;
  /** 6-30 alphanumeric */
  tracking_no: string;
}

/** `POST /merchant/aftersales/{id}/note` */
export interface AddAftersalesNotePayload {
  note: string;
}

// ---------- 商家看板 --------------------------------------------------------

/**
 * 商家端售后大盘统计（`GET /merchant/aftersales/stats/summary`）。
 *
 * 注：Phase 4 契约 §9.6 定义了 admin 端 stats/overview；merchant 端由后端
 * 沿用同结构或新增字段。此处采用商家场景所需的最小集合，尽量与后端别名保持一致。
 */
export interface MerchantAftersalesStats {
  /** 待审核（pending_merchant_review） */
  pending_review_count: number;
  /** 审核 deadline < 24h 且仍未审核 */
  overdue_soon_count: number;
  /** 用户已寄回，等商家收货 */
  waiting_receive_count: number;
  /** 商家已收货，等再发货（换货） */
  waiting_ship_count: number;
  /** 本月已完成（completed_refunded + completed_exchanged） */
  completed_this_month_count: number;
}
