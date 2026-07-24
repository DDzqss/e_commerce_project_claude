"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import {
  deleteAllRead,
  deleteNotification,
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
} from "@/lib/notification-api";
import { useAuth } from "./useAuth";
import type { PaginatedData } from "@/types";
import type {
  NotificationListQuery,
  NotificationOut,
  UnreadCountOut,
} from "@/types/notification";

const NOTIFICATIONS_KEY_ROOT = ["user", "notifications"] as const;

/** 60s 轮询未读数（登录后开启）。 */
export function useUnreadCount() {
  const { isLoggedIn, hasHydrated } = useAuth();
  return useQuery<UnreadCountOut>({
    queryKey: [...NOTIFICATIONS_KEY_ROOT, "unread-count"],
    queryFn: getUnreadCount,
    enabled: hasHydrated && isLoggedIn,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

/** 分页通知列表。 */
export function useNotifications(query: NotificationListQuery) {
  const { isLoggedIn, hasHydrated } = useAuth();
  return useQuery<PaginatedData<NotificationOut>>({
    queryKey: [...NOTIFICATIONS_KEY_ROOT, "list", query],
    queryFn: () => listNotifications(query),
    enabled: hasHydrated && isLoggedIn,
    staleTime: 10_000,
  });
}

export function useInvalidateNotifications() {
  const client = useQueryClient();
  return {
    list: () =>
      client.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY_ROOT, "list"] }),
    unread: () =>
      client.invalidateQueries({
        queryKey: [...NOTIFICATIONS_KEY_ROOT, "unread-count"],
      }),
    all: () =>
      client.invalidateQueries({ queryKey: NOTIFICATIONS_KEY_ROOT }),
  };
}

export function useMarkRead(
  options?: UseMutationOptions<NotificationOut, unknown, { id: number | string }>,
) {
  const invalidate = useInvalidateNotifications();
  return useMutation<NotificationOut, unknown, { id: number | string }>({
    mutationFn: (v) => markRead(v.id),
    ...options,
    onSuccess: (...args) => {
      void invalidate.unread();
      void invalidate.list();
      return options?.onSuccess?.(...args);
    },
  });
}

export function useMarkAllRead(
  options?: UseMutationOptions<{ affected: number }, unknown, void>,
) {
  const invalidate = useInvalidateNotifications();
  return useMutation<{ affected: number }, unknown, void>({
    mutationFn: () => markAllRead(),
    ...options,
    onSuccess: (...args) => {
      void invalidate.all();
      return options?.onSuccess?.(...args);
    },
  });
}

export function useDeleteNotification(
  options?: UseMutationOptions<void, unknown, { id: number | string }>,
) {
  const invalidate = useInvalidateNotifications();
  return useMutation<void, unknown, { id: number | string }>({
    mutationFn: (v) => deleteNotification(v.id),
    ...options,
    onSuccess: (...args) => {
      void invalidate.all();
      return options?.onSuccess?.(...args);
    },
  });
}

export function useDeleteAllRead(
  options?: UseMutationOptions<{ affected: number }, unknown, void>,
) {
  const invalidate = useInvalidateNotifications();
  return useMutation<{ affected: number }, unknown, void>({
    mutationFn: () => deleteAllRead(),
    ...options,
    onSuccess: (...args) => {
      void invalidate.all();
      return options?.onSuccess?.(...args);
    },
  });
}
