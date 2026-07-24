/**
 * Phase 5 · 商家端站内信 / 通知 API 客户端（§6.1）。
 *
 * 端点覆盖：
 *   - listNotifications    · GET    /api/v1/merchant/notifications
 *   - getUnreadCount       · GET    /api/v1/merchant/notifications/unread-count
 *   - markRead             · POST   /api/v1/merchant/notifications/{id}/read
 *   - markAllRead          · POST   /api/v1/merchant/notifications/read-all
 *   - deleteNotification   · DELETE /api/v1/merchant/notifications/{id}
 *   - deleteReadNotifications · DELETE /api/v1/merchant/notifications/read
 *
 * 契约要点：
 *   - `read` 幂等（重复标记不报错）
 *   - 「清空已读」只删掉 `is_read=true` 的记录，未读保留
 *   - 未读数轮询频率 60s（Sidebar 铃铛使用）
 */

import { api, unwrap } from "./api";
import type { PagedOut } from "@/types/api";
import type {
  NotificationListQuery,
  NotificationOut,
  UnreadCountOut,
} from "@/types/notification";

/** `GET /api/v1/merchant/notifications` */
export function listNotifications(
  query: NotificationListQuery = {},
): Promise<PagedOut<NotificationOut>> {
  const searchParams = new URLSearchParams();
  if (typeof query.is_read === "boolean") {
    searchParams.set("is_read", query.is_read ? "true" : "false");
  }
  if (query.category) searchParams.set("category", query.category);
  searchParams.set("page", String(query.page ?? 1));
  searchParams.set("size", String(query.size ?? 20));
  return unwrap<PagedOut<NotificationOut>>(
    api.get("v1/merchant/notifications", { searchParams }),
  );
}

/** `GET /api/v1/merchant/notifications/unread-count` */
export function getUnreadCount(): Promise<UnreadCountOut> {
  return unwrap<UnreadCountOut>(
    api.get("v1/merchant/notifications/unread-count"),
  );
}

/** `POST /api/v1/merchant/notifications/{id}/read` —— 幂等。 */
export async function markRead(id: number): Promise<void> {
  await api.post(`v1/merchant/notifications/${id}/read`);
}

/** `POST /api/v1/merchant/notifications/read-all` —— 全部已读。 */
export async function markAllRead(): Promise<void> {
  await api.post("v1/merchant/notifications/read-all");
}

/** `DELETE /api/v1/merchant/notifications/{id}` —— 删除单条。 */
export async function deleteNotification(id: number): Promise<void> {
  await api.delete(`v1/merchant/notifications/${id}`);
}

/** `DELETE /api/v1/merchant/notifications/read` —— 清空已读。 */
export async function deleteReadNotifications(): Promise<void> {
  await api.delete("v1/merchant/notifications/read");
}
