"use client";

/**
 * 商家 · 通知相关 React Query hooks（Phase 5 §6）。
 *
 * 提供：
 *   - useNotifications(query)  · 通知列表分页
 *   - useUnreadCount()         · 未读数轮询（60s；供铃铛使用）
 *
 * 约定：
 *   - 未读数走独立 key，便于任意组件订阅（sidebar / dashboard 卡片）
 *   - 列表 staleTime 15s；未读数 refetchInterval 60s，与用户端一致
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { getUnreadCount, listNotifications } from "@/lib/notification-api";
import type { PagedOut } from "@/types/api";
import type {
  NotificationListQuery,
  NotificationOut,
  UnreadCountOut,
} from "@/types/notification";

export const MERCHANT_NOTIFICATIONS_QUERY_KEY = [
  "merchant",
  "notifications",
  "list",
] as const;

export const MERCHANT_NOTIFICATIONS_UNREAD_KEY = [
  "merchant",
  "notifications",
  "unread",
] as const;

export function useNotifications(
  query: NotificationListQuery,
  options?: Partial<UseQueryOptions<PagedOut<NotificationOut>>>,
) {
  return useQuery<PagedOut<NotificationOut>>({
    queryKey: [...MERCHANT_NOTIFICATIONS_QUERY_KEY, query],
    queryFn: () => listNotifications(query),
    staleTime: 15_000,
    ...options,
  });
}

export function useUnreadCount(
  options?: Partial<UseQueryOptions<UnreadCountOut>>,
) {
  return useQuery<UnreadCountOut>({
    queryKey: MERCHANT_NOTIFICATIONS_UNREAD_KEY,
    queryFn: () => getUnreadCount(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    ...options,
  });
}
