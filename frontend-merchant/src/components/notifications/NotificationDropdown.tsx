"use client";

/**
 * NotificationDropdown —— sidebar / topbar 的铃铛下拉。
 *
 * 特性：
 *   - 未读徽章（数字，> 99 显示 99+）
 *   - 展开下拉：显示最近 10 条通知（未读优先）
 *   - 点击单条 → 标记已读 + 跳转 action_url
 *   - 「全部已读」+「查看全部」入口
 *
 * 数据源：
 *   - useUnreadCount() 60s 轮询
 *   - 打开下拉时才拉 list（避免常驻列表流量）
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/cn";
import {
  MERCHANT_NOTIFICATIONS_QUERY_KEY,
  MERCHANT_NOTIFICATIONS_UNREAD_KEY,
  useNotifications,
  useUnreadCount,
} from "@/hooks/useNotifications";
import { markAllRead, markRead } from "@/lib/notification-api";
import type { NotificationOut } from "@/types/notification";
import { NOTIFICATION_CATEGORY_LABEL } from "@/types/notification";

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

export function NotificationDropdown() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const unreadQuery = useUnreadCount();
  const unread = unreadQuery.data?.unread_count ?? 0;

  const listQuery = useNotifications(
    { page: 1, size: 10 },
    { enabled: open },
  );

  const invalidateAll = () => {
    void queryClient.invalidateQueries({
      queryKey: MERCHANT_NOTIFICATIONS_QUERY_KEY,
    });
    void queryClient.invalidateQueries({
      queryKey: MERCHANT_NOTIFICATIONS_UNREAD_KEY,
    });
  };

  const markOne = useMutation({
    mutationFn: (id: number) => markRead(id),
    onSuccess: () => invalidateAll(),
  });

  const markAll = useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => invalidateAll(),
  });

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const onItemClick = (n: NotificationOut) => {
    if (!n.is_read) markOne.mutate(n.id);
    setOpen(false);
    if (n.action_url) {
      // action_url 契约：以 `/` 开头的相对路径
      router.push(n.action_url);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`通知（${unread} 条未读）`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
      >
        <span aria-hidden className="text-lg leading-none">
          ⛭
        </span>
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute right-1 top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          <header className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 text-xs">
            <span className="font-medium text-neutral-800">通知</span>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending || unread === 0}
              className={cn(
                "text-[var(--color-primary)] hover:underline disabled:cursor-not-allowed disabled:text-neutral-300 disabled:no-underline",
              )}
            >
              全部已读
            </button>
          </header>
          <div className="max-h-96 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="px-3 py-6 text-center text-xs text-neutral-400">
                加载中…
              </div>
            ) : listQuery.data && listQuery.data.items.length > 0 ? (
              listQuery.data.items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onItemClick(n)}
                  className={cn(
                    "block w-full border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50",
                    !n.is_read && "bg-blue-50/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs">
                      {!n.is_read ? (
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                        />
                      ) : null}
                      <span className="text-neutral-500">
                        {NOTIFICATION_CATEGORY_LABEL[n.category] ?? n.category}
                      </span>
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {formatRelativeTime(n.created_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-sm font-medium text-neutral-800">
                    {n.title}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                    {n.body}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-8 text-center text-xs text-neutral-400">
                暂无通知
              </div>
            )}
          </div>
          <footer className="border-t border-neutral-100 px-3 py-2 text-right">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              查看全部 →
            </Link>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
