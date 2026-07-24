/**
 * Phase 5 站内信 / 消息通知类型（Admin 视角）。
 *
 * 与 docs/API/phase-5-contracts.md §3.4 / §6 严格对齐。
 *
 * Admin 端 scope 前缀为 `/admin`；其它端结构一致。
 */

// ---------------------------------------------------------------------------
// 枚举
// ---------------------------------------------------------------------------

/** 契约 §3.4 recipient_type。Admin 收件人仅可能为 `admin`。 */
export type NotificationRecipientType = "user" | "merchant" | "admin";

/** 契约 §3.4 category（6 类）。 */
export type NotificationCategory =
  | "system"
  | "order"
  | "aftersales"
  | "review"
  | "shop"
  | "promo";

// ---------------------------------------------------------------------------
// 数据结构
// ---------------------------------------------------------------------------

/**
 * 站内信 / 通知消息（契约 §3.4）。
 *
 * 展示注意：
 * - body 支持简单 markdown（Phase 5 前端按纯文本 + 换行渲染即可）
 * - action_url 为相对路径（例如 `/console/aftersales/123`），前端点击跳转
 */
export interface NotificationOut {
  id: number;
  recipient_type: NotificationRecipientType;
  recipient_id: number;
  category: NotificationCategory;
  title: string;
  body: string;
  action_url: string | null;
  related_type: string | null;
  related_id: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 查询 / 响应负载
// ---------------------------------------------------------------------------

/** GET /admin/notifications 查询参数。 */
export interface ListNotificationsQuery {
  is_read?: boolean;
  category?: NotificationCategory;
  page?: number;
  size?: number;
}

/** GET /admin/notifications/unread-count 响应体。 */
export interface UnreadCountData {
  count: number;
}
