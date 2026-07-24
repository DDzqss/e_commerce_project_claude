/**
 * Admin 站内信 / 通知 API 封装。
 *
 * 契约 §6.1 用户 / 商家 / Admin 通用（scope 由 auth 决定）：
 * - GET    /admin/notifications?is_read=&category=&page=&size=
 * - GET    /admin/notifications/unread-count
 * - POST   /admin/notifications/{id}/read           标记已读（幂等）
 * - POST   /admin/notifications/read-all            全部已读
 * - DELETE /admin/notifications/{id}                删除单条
 * - DELETE /admin/notifications/read                清空已读
 *
 * 权限：admin:notification:read（除 read/read-all/delete 外的写操作也复用同一权限，
 *      理由：通知的读写归当前登录 admin 自己所有，无跨账户越权风险）
 *
 * 轮询：Header 铃铛 60s 拉一次 unread-count，与契约 §1 保持一致。
 */

import { api, apiGet, apiPost } from "@/lib/api";
import { unwrap } from "@/lib/api";
import type { ApiResponse, PaginatedData } from "@/types";
import type {
  ListNotificationsQuery,
  NotificationOut,
  UnreadCountData,
} from "@/types/notification";

/**
 * GET /admin/notifications
 */
export function listNotifications(
  query: ListNotificationsQuery = {},
): Promise<PaginatedData<NotificationOut>> {
  const searchParams: Record<string, string | number> = {};
  if (query.is_read !== undefined) {
    searchParams.is_read = query.is_read ? "true" : "false";
  }
  if (query.category) searchParams.category = query.category;
  if (query.page) searchParams.page = query.page;
  if (query.size) searchParams.size = query.size;
  return apiGet<PaginatedData<NotificationOut>>("admin/notifications", {
    searchParams,
  });
}

/**
 * GET /admin/notifications/unread-count
 */
export function getUnreadCount(): Promise<UnreadCountData> {
  return apiGet<UnreadCountData>("admin/notifications/unread-count");
}

/**
 * POST /admin/notifications/{id}/read
 * 幂等；标记指定通知为已读。
 * 错误：22001 通知不存在 / 22002 无权访问
 */
export function markAsRead(
  id: number | string,
): Promise<NotificationOut> {
  return apiPost<NotificationOut, Record<string, never>>(
    `admin/notifications/${id}/read`,
    {},
  );
}

/**
 * POST /admin/notifications/read-all
 * 将当前 admin 所有未读通知标记为已读。
 */
export function markAllAsRead(): Promise<{ updated_count: number }> {
  return apiPost<{ updated_count: number }, Record<string, never>>(
    "admin/notifications/read-all",
    {},
  );
}

/**
 * DELETE /admin/notifications/{id}
 * 删除单条通知（物理删除，非软删）。
 */
export function deleteNotification(
  id: number | string,
): Promise<{ deleted: true }> {
  return unwrap(
    api
      .delete(`admin/notifications/${id}`)
      .json<ApiResponse<{ deleted: true }>>(),
  );
}

/**
 * DELETE /admin/notifications/read
 * 清空所有已读通知。
 */
export function deleteReadNotifications(): Promise<{ deleted_count: number }> {
  return unwrap(
    api
      .delete("admin/notifications/read")
      .json<ApiResponse<{ deleted_count: number }>>(),
  );
}
