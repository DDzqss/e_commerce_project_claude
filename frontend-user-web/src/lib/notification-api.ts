/**
 * Phase 5 · 站内信 API 客户端。
 *
 * 契约：docs/API/phase-5-contracts.md §6.1
 *   GET    /user/notifications?is_read&category&page&size
 *   GET    /user/notifications/unread-count
 *   POST   /user/notifications/{id}/read
 *   POST   /user/notifications/read-all
 *   DELETE /user/notifications/{id}
 *   DELETE /user/notifications/read
 */

import { apiDelete, apiGet, apiPost } from "./api";
import type { PaginatedData } from "@/types";
import type {
  NotificationListQuery,
  NotificationOut,
  UnreadCountOut,
} from "@/types/notification";

function toSearchParams<T extends object>(
  q: T | undefined,
): Record<string, string> | undefined {
  if (!q) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = typeof v === "boolean" ? String(v) : String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/** GET /user/notifications — 分页拉通知。 */
export function listNotifications(
  query?: NotificationListQuery,
): Promise<PaginatedData<NotificationOut>> {
  return apiGet<PaginatedData<NotificationOut>>("user/notifications", {
    searchParams: toSearchParams(query),
  });
}

/** GET /user/notifications/unread-count — 未读数（60s 轮询）。 */
export function getUnreadCount(): Promise<UnreadCountOut> {
  return apiGet<UnreadCountOut>("user/notifications/unread-count");
}

/** POST /user/notifications/{id}/read — 标记已读（幂等）。 */
export function markRead(id: number | string): Promise<NotificationOut> {
  return apiPost<NotificationOut>(`user/notifications/${id}/read`);
}

/** POST /user/notifications/read-all — 全部标记已读。 */
export function markAllRead(): Promise<{ affected: number }> {
  return apiPost<{ affected: number }>("user/notifications/read-all");
}

/** DELETE /user/notifications/{id} — 删除单条。 */
export function deleteNotification(id: number | string): Promise<void> {
  return apiDelete<void>(`user/notifications/${id}`);
}

/** DELETE /user/notifications/read — 清空已读。 */
export function deleteAllRead(): Promise<{ affected: number }> {
  return apiDelete<{ affected: number }>("user/notifications/read");
}
