/**
 * Phase 4 售后域强类型定义。
 *
 * 严格对齐 docs/API/phase-4-contracts.md：
 * - §2 三种售后类型
 * - §4 数据模型
 * - §5 12 态状态机
 * - §7 User 端接口
 * - §10 凭证系统
 *
 * 命名与后端 snake_case 保持一致。
 */

import type { ShopBrief } from "./catalog";
import type { OrderListItem, OrderStatus } from "./order";

/** ---------- 售后类型（3 种） ---------- */

export enum AftersalesType {
  RefundOnly = "refund_only",
  ReturnRefund = "return_refund",
  Exchange = "exchange",
}

export const AFTERSALES_TYPE_LABEL: Record<AftersalesType, string> = {
  [AftersalesType.RefundOnly]: "仅退款",
  [AftersalesType.ReturnRefund]: "退货退款",
  [AftersalesType.Exchange]: "换货",
};

/** 按订单状态计算可发起的售后类型（契约 §2）。 */
export function allowedAftersalesTypes(
  orderStatus: OrderStatus | string,
): AftersalesType[] {
  switch (orderStatus) {
    case "paid":
      return [AftersalesType.RefundOnly];
    case "shipped":
      return [
        AftersalesType.RefundOnly,
        AftersalesType.ReturnRefund,
        AftersalesType.Exchange,
      ];
    case "completed":
      return [AftersalesType.ReturnRefund, AftersalesType.Exchange];
    default:
      return [];
  }
}

/** ---------- 12 态状态 ---------- */

export enum AftersalesStatus {
  PendingMerchantReview = "pending_merchant_review",
  MerchantRejected = "merchant_rejected",
  MerchantAgreedWaitingReturn = "merchant_agreed_waiting_return",
  ReturnShippedWaitingReceive = "return_shipped_waiting_receive",
  MerchantAgreedWaitingShip = "merchant_agreed_waiting_ship",
  ExchangeShippedWaitingReceive = "exchange_shipped_waiting_receive",
  Refunding = "refunding",
  AdminArbitrating = "admin_arbitrating",
  CompletedRefunded = "completed_refunded",
  CompletedExchanged = "completed_exchanged",
  UserCancelled = "user_cancelled",
  SystemClosed = "system_closed",
}

export const AFTERSALES_STATUS_LABEL: Record<AftersalesStatus, string> = {
  [AftersalesStatus.PendingMerchantReview]: "待商家审核",
  [AftersalesStatus.MerchantRejected]: "商家已拒绝",
  [AftersalesStatus.MerchantAgreedWaitingReturn]: "待寄回",
  [AftersalesStatus.ReturnShippedWaitingReceive]: "商家待收货",
  [AftersalesStatus.MerchantAgreedWaitingShip]: "商家待再发货",
  [AftersalesStatus.ExchangeShippedWaitingReceive]: "待确认换货",
  [AftersalesStatus.Refunding]: "退款中",
  [AftersalesStatus.AdminArbitrating]: "平台仲裁中",
  [AftersalesStatus.CompletedRefunded]: "已退款",
  [AftersalesStatus.CompletedExchanged]: "换货完成",
  [AftersalesStatus.UserCancelled]: "已撤销",
  [AftersalesStatus.SystemClosed]: "已关闭",
};

/** 终态：不可再操作。 */
export const FINAL_STATUSES: ReadonlySet<AftersalesStatus> = new Set([
  AftersalesStatus.CompletedRefunded,
  AftersalesStatus.CompletedExchanged,
  AftersalesStatus.UserCancelled,
  AftersalesStatus.SystemClosed,
]);

export function isFinalStatus(s: AftersalesStatus | string): boolean {
  return FINAL_STATUSES.has(s as AftersalesStatus);
}

/** ---------- 原因分类（6+1） ---------- */

export type ReasonCategory =
  | "quality_issue"
  | "wrong_item"
  | "damage_in_transit"
  | "not_as_described"
  | "no_longer_needed"
  | "duplicate_purchase"
  | "other";

export const REASON_CATEGORY_LABEL: Record<ReasonCategory, string> = {
  quality_issue: "质量问题",
  wrong_item: "发错商品",
  damage_in_transit: "运输损坏",
  not_as_described: "与描述不符",
  no_longer_needed: "不想要了",
  duplicate_purchase: "重复下单",
  other: "其他",
};

export const REASON_CATEGORY_LIST: ReasonCategory[] = [
  "quality_issue",
  "wrong_item",
  "damage_in_transit",
  "not_as_described",
  "no_longer_needed",
  "duplicate_purchase",
  "other",
];

/** ---------- Escalation / Outcome / CloseReason ---------- */

export type EscalationReason =
  | "merchant_timeout"
  | "user_appeal"
  | "risk_flagged"
  | "manual"
  | "merchant_refuse_receive";

export const ESCALATION_REASON_LABEL: Record<EscalationReason, string> = {
  merchant_timeout: "商家超时未响应",
  user_appeal: "用户申诉",
  risk_flagged: "风控命中",
  manual: "人工升级",
  merchant_refuse_receive: "商家拒收退货",
};

export type ArbitrationOutcome =
  | "side_with_user"
  | "side_with_merchant"
  | "partial_refund"
  | "other";

export const ARBITRATION_OUTCOME_LABEL: Record<ArbitrationOutcome, string> = {
  side_with_user: "支持用户",
  side_with_merchant: "支持商家",
  partial_refund: "部分退款",
  other: "其他",
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
  auto_confirmed: "系统默认确认",
  system_closed: "系统关闭",
};

/** ---------- 数据模型 ---------- */

export type AftersalesActorType = "user" | "merchant" | "admin" | "system";
export type AftersalesUploaderType = "user" | "merchant" | "admin";
export type AftersalesMessageKind =
  | "nudge"
  | "appeal"
  | "reply"
  | "system_notice";

export type AftersalesEvidenceStage =
  | "apply"
  | "merchant_review"
  | "user_return"
  | "merchant_receive"
  | "exchange_ship"
  | "appeal"
  | "arbitration";

export const AFTERSALES_STAGE_LABEL: Record<AftersalesEvidenceStage, string> = {
  apply: "申请凭证",
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
  uploader_type: AftersalesUploaderType;
  uploader_id: number;
  stage: AftersalesEvidenceStage;
  image_url: string;
  note: string | null;
  created_at: string;
}

export interface AftersalesStatusHistoryItem {
  id: number;
  aftersales_id: number;
  from_status: AftersalesStatus | string | null;
  to_status: AftersalesStatus | string;
  actor_type: AftersalesActorType;
  actor_id: number | null;
  note: string | null;
  created_at: string;
}

export interface AftersalesMessage {
  id: number;
  aftersales_id: number;
  sender_type: AftersalesActorType;
  sender_id: number | null;
  kind: AftersalesMessageKind;
  content: string;
  created_at: string;
}

export interface AftersalesItemDetail {
  id: number;
  aftersales_id: number;
  order_item_id: number;
  quantity: number;
  refund_amount_cents: number;
  /** 订单 item 快照冗余（后端可以带回来，前端友好展示） */
  spu_title?: string | null;
  sku_specs?: Record<string, string> | null;
  sku_image?: string | null;
  unit_price_cents?: number | null;
  created_at: string;
}

/** 列表项：卡片式所需字段。 */
export interface AftersalesListItem {
  id: number;
  aftersales_no: string;
  order_id: number;
  order_no: string;
  shop: ShopBrief;
  type: AftersalesType;
  status: AftersalesStatus;
  reason_category: ReasonCategory;
  refund_amount_cents: number;
  actual_refund_cents: number | null;
  merchant_review_deadline: string | null;
  created_at: string;
  updated_at: string;
  /** 冗余：前 N 件商品 */
  items: AftersalesItemDetail[];
  items_count: number;
}

/** 详情：字段全 + 关联集合。 */
export interface AftersalesDetail extends AftersalesListItem {
  user_id: number;
  shop_id: number;
  reason_note: string;
  merchant_reviewed_at: string | null;
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

  escalated_at: string | null;
  escalation_reason: EscalationReason | null;
  arbitrator_admin_id: number | null;
  arbitrated_at: string | null;
  arbitration_conclusion: string | null;
  arbitration_outcome: ArbitrationOutcome | null;

  refunded_at: string | null;
  refund_txn_no: string | null;

  closed_at: string | null;
  close_reason: CloseReason | null;

  nudge_count: number;
  last_nudged_at: string | null;
  appeal_count: number;

  status_history: AftersalesStatusHistoryItem[];
  evidences: AftersalesEvidence[];
  messages: AftersalesMessage[];
}

/** ---------- 请求 payloads ---------- */

export interface AftersalesCreateItem {
  order_item_id: number;
  quantity: number;
}

export interface AftersalesCreatePayload {
  type: AftersalesType;
  reason_category: ReasonCategory;
  reason_note: string;
  items: AftersalesCreateItem[];
  refund_amount_cents: number;
  evidence_image_keys?: string[];
}

export interface AftersalesCancelPayload {
  cancel_note?: string;
}

export interface AftersalesSubmitTrackingPayload {
  carrier: string;
  tracking_no: string;
}

export interface AftersalesAppealPayload {
  reason: string;
  evidence_image_keys?: string[];
}

export interface AftersalesAddEvidencePayload {
  stage: AftersalesEvidenceStage;
  image_key: string;
  note?: string;
}

/** ---------- 列表查询 ---------- */

/**
 * 兼容"状态分组 tab" —— 我们把 status tab 拆成语义组，避免 UI 只能选单值。
 * URL 上传的是 status 关键字（如 pending / in_progress / done / closed / all）。
 */
export interface AftersalesListQuery {
  /** 具体单值 or 逗号分隔多值。 */
  status?: AftersalesStatus | string;
  type?: AftersalesType | string;
  keyword?: string;
  page?: number;
  size?: number;
}

/** 用户端的状态语义分组（UI tab 用）。 */
export const USER_STATUS_GROUPS: Record<string, AftersalesStatus[]> = {
  pending: [AftersalesStatus.PendingMerchantReview],
  in_progress: [
    AftersalesStatus.MerchantAgreedWaitingReturn,
    AftersalesStatus.ReturnShippedWaitingReceive,
    AftersalesStatus.MerchantAgreedWaitingShip,
    AftersalesStatus.ExchangeShippedWaitingReceive,
    AftersalesStatus.Refunding,
    AftersalesStatus.AdminArbitrating,
    AftersalesStatus.MerchantRejected,
  ],
  done: [
    AftersalesStatus.CompletedRefunded,
    AftersalesStatus.CompletedExchanged,
  ],
  closed: [AftersalesStatus.UserCancelled, AftersalesStatus.SystemClosed],
};

/** 用户端可选/可撤销/可申诉/可催办的映射：详情页据此决定按钮显示。 */
export const USER_CAN_CANCEL: ReadonlySet<AftersalesStatus> = new Set([
  AftersalesStatus.PendingMerchantReview,
  AftersalesStatus.MerchantAgreedWaitingReturn,
  AftersalesStatus.MerchantRejected,
]);

export const USER_CAN_NUDGE: ReadonlySet<AftersalesStatus> = new Set([
  AftersalesStatus.PendingMerchantReview,
]);

export const USER_CAN_APPEAL: ReadonlySet<AftersalesStatus> = new Set([
  AftersalesStatus.MerchantRejected,
]);

export const USER_CAN_SUBMIT_TRACKING: ReadonlySet<AftersalesStatus> = new Set([
  AftersalesStatus.MerchantAgreedWaitingReturn,
]);

export const USER_CAN_CONFIRM_EXCHANGE: ReadonlySet<AftersalesStatus> = new Set(
  [AftersalesStatus.ExchangeShippedWaitingReceive],
);

/** ---------- 上传 ---------- */

/** Phase 4 §10.1 用户端上传 purpose 枚举扩展。 */
export type UserUploadPurpose =
  | "aftersales_apply"
  | "aftersales_user_return"
  | "aftersales_appeal"
  | "avatar";

export interface UserPresignUploadIn {
  purpose: UserUploadPurpose;
  content_type: string;
  file_size: number;
}

export interface UserPresignUploadOut {
  object_key: string;
  upload_url: string;
  expires_at: string;
  public_url: string;
}

/** ---------- 便捷：从 OrderListItem 派生"是否有 active 售后" ----------
 * Phase 4 后端返回订单详情时目前未强制附带 active_aftersales_id，
 * 前端在展示"申请售后"入口前用 order.status 进行第一道过滤，
 * 二次校验交给后端（15005）。
 */
export function orderCanApplyAftersales(order: OrderListItem): boolean {
  return allowedAftersalesTypes(order.status).length > 0;
}
