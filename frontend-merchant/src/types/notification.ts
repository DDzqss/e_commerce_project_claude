/**
 * Phase 5 · 站内信 / 通知类型定义（商家端）。
 *
 * 严格对齐 docs/API/phase-5-contracts.md §3.4 / §6。
 *
 * 商家端和用户 / 管理端共用同一份通知模型；scope 由 auth 决定，
 * 端点前缀为 `/api/v1/merchant/notifications/...`。
 */

/** 通知类别（对应后端 `notifications.category` 枚举）。 */
export const NotificationCategory = {
  System: "system",
  Order: "order",
  Aftersales: "aftersales",
  Review: "review",
  Shop: "shop",
  Promo: "promo",
} as const;

export type NotificationCategory =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  [NotificationCategory.System]: "系统",
  [NotificationCategory.Order]: "订单",
  [NotificationCategory.Aftersales]: "售后",
  [NotificationCategory.Review]: "评价",
  [NotificationCategory.Shop]: "店铺",
  [NotificationCategory.Promo]: "促销",
};

/** 一条通知（商家收件人视角）。 */
export interface NotificationOut {
  id: number;
  recipient_type: "merchant";
  recipient_id: number;
  category: NotificationCategory;
  title: string;
  /** body 支持简单 markdown（Phase 5 简化为纯文本 + \n）。 */
  body: string;
  /** 点击跳转的相对路径（前端约定：以 `/` 开头）。 */
  action_url: string | null;
  related_type: string | null;
  related_id: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

/** 未读数响应。 */
export interface UnreadCountOut {
  unread_count: number;
}

/** 通知列表查询参数。 */
export interface NotificationListQuery {
  is_read?: boolean;
  category?: NotificationCategory;
  page?: number;
  size?: number;
}
