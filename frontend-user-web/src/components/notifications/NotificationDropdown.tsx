"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NotificationItem } from "./NotificationItem";
import { cn } from "@/lib/cn";
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";

interface NotificationDropdownProps {
  className?: string;
}

/**
 * 顶部铃铛 + 未读徽章 + hover/click 展开最近 10 条。
 *
 * - 未登录不渲染
 * - 未读数每 60s 自动刷新（useUnreadCount hook）
 * - 打开时按需拉取最近 10 条
 * - 点击某条 → 后端 mark read；有 action_url 由 NotificationItem 内部 Link 跳转
 */
export function NotificationDropdown({ className }: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isLoggedIn, hasHydrated } = useAuth();
  const { data: unreadData } = useUnreadCount();
  const unread = unreadData?.count ?? 0;

  const listQuery = { page: 1, size: 10 };
  const {
    data: notifsData,
    isLoading,
    refetch,
  } = useNotifications(listQuery);
  const markReadMutation = useMarkRead();
  const markAllReadMutation = useMarkAllRead();

  useEffect(() => {
    if (!open) return;
    void refetch();
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open, refetch]);

  if (!hasHydrated || !isLoggedIn) return null;

  const list = notifsData?.items ?? [];

  return (
    <div className={cn("relative", className)} ref={menuRef}>
      <button
        type="button"
        aria-label="通知"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100"
        data-testid="notification-bell"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="M6 8a6 6 0 1112 0v4l1.5 3H4.5L6 12V8z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 18a2 2 0 004 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        {unread > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[color:var(--color-primary)] px-1 text-[10px] font-semibold leading-4 text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-80 max-w-[92vw] overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          <header className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <span className="text-sm font-medium text-neutral-800">
              消息通知
            </span>
            <button
              type="button"
              className="text-xs text-[color:var(--color-primary)] hover:underline disabled:opacity-40"
              disabled={unread === 0 || markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              全部已读
            </button>
          </header>

          <div className="max-h-80 overflow-y-auto">
            {isLoading && (
              <div className="px-3 py-6 text-center text-xs text-neutral-500">
                加载中…
              </div>
            )}
            {!isLoading && list.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-neutral-500">
                暂无消息
              </div>
            )}
            {!isLoading && list.length > 0 && (
              <ul className="divide-y divide-neutral-100">
                {list.map((n) => (
                  <li key={n.id}>
                    <NotificationItem
                      notification={n}
                      compact
                      onClick={() => {
                        if (!n.is_read) {
                          markReadMutation.mutate({ id: n.id });
                        }
                        setOpen(false);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="border-t border-neutral-100 px-3 py-2 text-center">
            <Link
              href="/notifications"
              className="text-xs text-neutral-600 hover:text-[color:var(--color-primary)]"
              onClick={() => setOpen(false)}
            >
              查看全部
            </Link>
          </footer>
        </div>
      )}
    </div>
  );
}
