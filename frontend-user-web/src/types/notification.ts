/**
 * Phase 5 · 站内信通知类型。
 *
 * 严格对齐 docs/API/phase-5-contracts.md §3.4 / §6。
 */

export type NotificationCategory =
  | "system"
  | "order"
  | "aftersales"
  | "review"
  | "shop"
  | "promo";

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  system: "系统",
  order: "订单",
  aftersales: "售后",
  review: "评价",
  shop: "店铺",
  promo: "促销",
};

export const NOTIFICATION_CATEGORY_LIST: NotificationCategory[] = [
  "system",
  "order",
  "aftersales",
  "review",
  "shop",
  "promo",
];

export type NotificationRelatedType =
  | "order"
  | "aftersales"
  | "review"
  | "merchant_application"
  | "shop"
  | (string & { readonly _brand?: unique symbol });

export interface NotificationOut {
  id: number;
  recipient_type: "user" | "merchant" | "admin";
  recipient_id: number;
  category: NotificationCategory;
  title: string;
  body: string;
  action_url: string | null;
  related_type: NotificationRelatedType | null;
  related_id: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListQuery {
  /** true = 只看未读；false = 只看已读；omit = 全部 */
  is_read?: boolean;
  category?: NotificationCategory;
  page?: number;
  size?: number;
}

/** GET /{scope}/notifications/unread-count 响应负载。 */
export interface UnreadCountOut {
  count: number;
}
