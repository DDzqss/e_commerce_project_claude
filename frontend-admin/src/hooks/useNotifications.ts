"use client";

/**
 * Admin 站内信 / 通知相关 React Query hooks。
 *
 * 契约 §6.1：
 * - useNotifications — GET /admin/notifications 列表（分页 + 筛选）
 * - useUnreadCount   — GET /admin/notifications/unread-count（60s 轮询）
 *
 * 权限：admin:notification:read
 *
 * 轮询：Header 铃铛依赖 useUnreadCount，refetchInterval=60_000
 * 与契约 §1「Phase 5 用 HTTP 轮询」保持一致。
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { PaginatedData } from "@/types";
import type {
  ListNotificationsQuery,
  NotificationOut,
  UnreadCountData,
} from "@/types/notification";
import { getUnreadCount, listNotifications } from "@/lib/notification-api";

/**
 * useNotifications — 通知列表。
 *
 * placeholderData 保留上一次结果，翻页 / 筛选切换时避免"闪空"。
 */
export function useNotifications(
  query: ListNotificationsQuery,
  options?: Omit<
    UseQueryOptions<
      PaginatedData<NotificationOut>,
      Error,
      PaginatedData<NotificationOut>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["admin", "notifications", query],
    queryFn: () => listNotifications(query),
    placeholderData: (prev) => prev,
    ...options,
  });
}

/**
 * useUnreadCount — 未读数（60s 轮询）。
 *
 * refetchOnWindowFocus 打开：切回窗口后立即刷新。
 */
export function useUnreadCount(
  options?: Omit<
    UseQueryOptions<UnreadCountData, Error, UnreadCountData>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["admin", "notifications-unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    ...options,
  });
}
