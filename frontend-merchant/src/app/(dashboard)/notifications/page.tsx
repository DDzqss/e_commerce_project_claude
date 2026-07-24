"use client";

/**
 * 商家 · 通知中心（Phase 5 §6.1）。
 *
 * 布局：
 *   - 顶部：未读数 + 操作按钮（全部已读 / 清空已读）
 *   - 中部：Category tabs（全部 / 系统 / 订单 / 售后 / 评价 / 店铺 / 促销）+ 是否已读 tabs
 *   - 列表：整行卡片，点击标记已读 + 跳转 action_url
 *   - 分页
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  deleteNotification,
  deleteReadNotifications,
  markAllRead,
  markRead,
} from "@/lib/notification-api";
import {
  MERCHANT_NOTIFICATIONS_QUERY_KEY,
  MERCHANT_NOTIFICATIONS_UNREAD_KEY,
  useNotifications,
  useUnreadCount,
} from "@/hooks/useNotifications";
import { ApiError } from "@/types/errors";
import type { NotificationOut } from "@/types/notification";
import {
  NOTIFICATION_CATEGORY_LABEL,
  NotificationCategory,
} from "@/types/notification";

type CategoryFilter = "" | NotificationCategory;
type ReadFilter = "" | "read" | "unread";

const PAGE_SIZE = 20;

const CATEGORY_TABS: Array<{ key: CategoryFilter; label: string }> = [
  { key: "", label: "全部" },
  { key: NotificationCategory.Order, label: "订单" },
  { key: NotificationCategory.Aftersales, label: "售后" },
  { key: NotificationCategory.Review, label: "评价" },
  { key: NotificationCategory.Shop, label: "店铺" },
  { key: NotificationCategory.System, label: "系统" },
  { key: NotificationCategory.Promo, label: "促销" },
];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", { hour12: false });
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<CategoryFilter>("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("");
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => ({
      category: category || undefined,
      is_read:
        readFilter === "" ? undefined : readFilter === "read",
      page,
      size: PAGE_SIZE,
    }),
    [category, readFilter, page],
  );

  const listQuery = useNotifications(query);
  const unreadQuery = useUnreadCount();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: MERCHANT_NOTIFICATIONS_QUERY_KEY,
    });
    void queryClient.invalidateQueries({
      queryKey: MERCHANT_NOTIFICATIONS_UNREAD_KEY,
    });
  };

  const markOne = useMutation({
    mutationFn: (id: number) => markRead(id),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => {
      invalidate();
      toast.success("已全部标记为已读");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.toUserMessage() : "操作失败"),
  });
  const deleteOne = useMutation({
    mutationFn: (id: number) => deleteNotification(id),
    onSuccess: () => {
      invalidate();
      toast.success("通知已删除");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.toUserMessage() : "删除失败"),
  });
  const clearRead = useMutation({
    mutationFn: () => deleteReadNotifications(),
    onSuccess: () => {
      invalidate();
      toast.success("已读通知已清空");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.toUserMessage() : "清空失败"),
  });

  const totalPages = useMemo(
    () =>
      listQuery.data
        ? Math.max(
            1,
            Math.ceil(listQuery.data.total / (listQuery.data.size || PAGE_SIZE)),
          )
        : 1,
    [listQuery.data],
  );

  const onItemClick = (n: NotificationOut) => {
    if (!n.is_read) markOne.mutate(n.id);
    if (n.action_url) router.push(n.action_url);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">通知中心</h2>
          <p className="mt-1 text-sm text-neutral-500">
            未读{" "}
            <span className="font-semibold text-red-600">
              {unreadQuery.data?.unread_count ?? 0}
            </span>{" "}
            条 · 每 60 秒自动刷新
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => markAll.mutate()}
            loading={markAll.isPending}
            disabled={(unreadQuery.data?.unread_count ?? 0) === 0}
          >
            全部已读
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm("确定清空所有已读通知？此操作不可恢复。")) {
                clearRead.mutate();
              }
            }}
            loading={clearRead.isPending}
            className="text-red-600 hover:bg-red-50"
          >
            清空已读
          </Button>
        </div>
      </header>

      {/* Category tabs */}
      <div className="border-b border-neutral-200">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="按类别筛选">
          {CATEGORY_TABS.map((tab) => {
            const active = category === tab.key;
            return (
              <button
                key={tab.key || "all"}
                type="button"
                onClick={() => {
                  setCategory(tab.key);
                  setPage(1);
                }}
                className={cn(
                  "border-b-2 px-4 py-2 text-sm transition-colors",
                  active
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-neutral-500 hover:text-neutral-800",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Read filter */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-neutral-600">状态：</span>
        {(
          [
            { key: "" as ReadFilter, label: "全部" },
            { key: "unread" as ReadFilter, label: "未读" },
            { key: "read" as ReadFilter, label: "已读" },
          ]
        ).map((op) => (
          <button
            key={op.label}
            type="button"
            onClick={() => {
              setReadFilter(op.key);
              setPage(1);
            }}
            className={cn(
              "rounded px-2 py-0.5 text-xs",
              readFilter === op.key
                ? "bg-[var(--color-primary)] text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
            )}
          >
            {op.label}
          </button>
        ))}
      </div>

      {/* List */}
      {listQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          通知列表加载失败。
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => listQuery.refetch()}
          >
            重试
          </button>
        </div>
      ) : !listQuery.data || listQuery.data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-16 text-center text-sm text-neutral-500">
          <div className="text-3xl">📭</div>
          <div className="mt-2">当前筛选条件下没有通知</div>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {listQuery.data.items.map((n) => (
            <li
              key={n.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3 hover:bg-neutral-50",
                !n.is_read && "bg-blue-50/30",
              )}
            >
              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] text-neutral-500">
                {NOTIFICATION_CATEGORY_LABEL[n.category] ?? "?"}
              </div>
              <button
                type="button"
                onClick={() => onItemClick(n)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {!n.is_read ? (
                      <span
                        aria-label="未读"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                      />
                    ) : null}
                    <span className="truncate text-sm font-medium text-neutral-800">
                      {n.title}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {formatDateTime(n.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-600 line-clamp-2">
                  {n.body}
                </p>
                {n.action_url ? (
                  <span className="mt-1 inline-block text-xs text-[var(--color-primary)]">
                    查看详情 →
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => deleteOne.mutate(n.id)}
                aria-label="删除通知"
                className="shrink-0 rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 分页 */}
      {listQuery.data && listQuery.data.total > 0 ? (
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <div>
            共 {listQuery.data.total} 条 · 第 {page} / {totalPages} 页
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-neutral-400">
        <Link
          href="/dashboard"
          className="text-[var(--color-primary)] hover:underline"
        >
          返回看板
        </Link>
      </p>
    </div>
  );
}
