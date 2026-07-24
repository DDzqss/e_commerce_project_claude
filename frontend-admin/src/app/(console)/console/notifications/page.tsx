"use client";

/**
 * 站内信 / 通知页 (`/console/notifications`)。
 *
 * 契约 §6：
 * - GET    /admin/notifications?is_read=&category=&page=&size=
 * - GET    /admin/notifications/unread-count
 * - POST   /admin/notifications/{id}/read      标记已读（幂等）
 * - POST   /admin/notifications/read-all       全部已读
 * - DELETE /admin/notifications/{id}           删除单条
 * - DELETE /admin/notifications/read           清空已读
 *
 * 权限：admin:notification:read
 *
 * UI：
 * - Tab: 全部 / 未读 / 已读
 * - Category 筛选：system / order / aftersales / review / shop / promo
 * - 卡片列表：title / body / action_url 跳转 / 时间戳 / 未读圆点
 * - Header：全部已读 / 清空已读 按钮
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useNotifications } from "@/hooks/useNotifications";
import {
  deleteNotification,
  deleteReadNotifications,
  markAllAsRead,
  markAsRead,
} from "@/lib/notification-api";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/types/errors";
import type {
  NotificationCategory,
  NotificationOut,
} from "@/types/notification";

const PAGE_SIZE = 20;

type ReadTab = "all" | "unread" | "read";

const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; tone: BadgeTone }
> = {
  system: { label: "系统", tone: "default" },
  order: { label: "订单", tone: "info" },
  aftersales: { label: "售后", tone: "warning" },
  review: { label: "评价", tone: "primary" },
  shop: { label: "店铺", tone: "success" },
  promo: { label: "活动", tone: "warning" },
};

export default function AdminNotificationsPage() {
  return (
    <RequirePermission permission="admin:notification:read">
      <Suspense
        fallback={<div className="text-sm text-neutral-400">加载中…</div>}
      >
        <AdminNotificationsInner />
      </Suspense>
    </RequirePermission>
  );
}

function AdminNotificationsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const initialTab = (searchParams.get("tab") ?? "all") as ReadTab;
  const initialCategory = (searchParams.get("category") ?? "") as
    | NotificationCategory
    | "";
  const initialPage = Number(searchParams.get("page") ?? "1") || 1;

  const [tab, setTab] = useState<ReadTab>(initialTab);
  const [category, setCategory] = useState<NotificationCategory | "">(
    initialCategory,
  );
  const [page, setPage] = useState(initialPage);

  // URL 同步
  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== "all") params.set("tab", tab);
    if (category) params.set("category", category);
    if (page !== 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [tab, category, page, router]);

  const query = useMemo(
    () => ({
      is_read: tab === "all" ? undefined : tab === "read",
      category: category || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [tab, category, page],
  );

  const { data, isLoading, isError, refetch } = useNotifications(query);
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    queryClient.invalidateQueries({
      queryKey: ["admin", "notifications-unread-count"],
    });
  };

  const readMutation = useMutation({
    mutationFn: (id: number) => markAsRead(id),
    onSuccess: () => invalidate(),
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? getErrorMessage(err.code, err.message)
          : "操作失败";
      toast.push({ type: "error", message: msg });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteNotification(id),
    onSuccess: () => {
      toast.push({ type: "success", message: "已删除" });
      invalidate();
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? getErrorMessage(err.code, err.message)
          : "操作失败";
      toast.push({ type: "error", message: msg });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: (res) => {
      toast.push({
        type: "success",
        message: `已将 ${res.updated_count ?? 0} 条置为已读`,
      });
      invalidate();
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? getErrorMessage(err.code, err.message)
          : "操作失败";
      toast.push({ type: "error", message: msg });
    },
  });

  const deleteReadMutation = useMutation({
    mutationFn: () => deleteReadNotifications(),
    onSuccess: (res) => {
      toast.push({
        type: "success",
        message: `已清空 ${res.deleted_count ?? 0} 条已读通知`,
      });
      invalidate();
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? getErrorMessage(err.code, err.message)
          : "操作失败";
      toast.push({ type: "error", message: msg });
    },
  });

  const handleDelete = (row: NotificationOut) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`确认删除通知 #${row.id}？`)
    ) {
      return;
    }
    deleteMutation.mutate(row.id);
  };

  const handleDeleteRead = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确认清空所有已读通知？此操作不可撤销。")
    ) {
      return;
    }
    deleteReadMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            站内通知
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Phase 5 通知使用 HTTP 轮询（60s 刷新未读数），点击可跳转至对应资源。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            loading={readMutation.isPending}
          >
            刷新
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => readAllMutation.mutate()}
            loading={readAllMutation.isPending}
          >
            全部已读
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDeleteRead}
            loading={deleteReadMutation.isPending}
          >
            清空已读
          </Button>
        </div>
      </header>

      {/* Tab */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[color:var(--color-border)]">
        {(
          [
            { key: "all", label: "全部" },
            { key: "unread", label: "未读" },
            { key: "read", label: "已读" },
          ] as { key: ReadTab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={clsx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition",
              tab === t.key
                ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)] font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-800",
            )}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 分类筛选 */}
      <div className="rounded-md border border-[color:var(--color-border)] bg-white p-3">
        <FormField label="分类">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as NotificationCategory | "");
              setPage(1);
            }}
            className="block h-8 w-full max-w-xs rounded border border-[color:var(--color-border)] bg-white px-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]/20"
            aria-label="分类筛选"
          >
            <option value="">全部分类</option>
            {(Object.keys(CATEGORY_META) as NotificationCategory[]).map(
              (c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ),
            )}
          </select>
        </FormField>
      </div>

      {isError ? (
        <div className="rounded border border-red-200 bg-[color:var(--color-danger-soft)] px-3 py-2 text-xs text-[color:var(--color-danger)]">
          加载失败，请点击右上角「刷新」重试。
        </div>
      ) : null}

      {/* 列表 */}
      <div className="flex flex-col gap-2">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-[color:var(--color-border)] bg-white p-10 text-center text-sm text-neutral-400">
            暂无符合条件的通知
          </div>
        ) : (
          rows.map((row) => (
            <NotificationItem
              key={row.id}
              row={row}
              onOpen={(n) => {
                if (!n.is_read) readMutation.mutate(n.id);
              }}
              onMarkRead={(n) => readMutation.mutate(n.id)}
              onDelete={(n) => handleDelete(n)}
              markingRead={
                readMutation.isPending && readMutation.variables === row.id
              }
              deleting={
                deleteMutation.isPending &&
                deleteMutation.variables === row.id
              }
            />
          ))
        )}
      </div>

      {/* 简易分页（复用 Table 分页会占用一列头，站内信直接文本分页） */}
      {rows.length > 0 ? (
        <NotificationsPagination
          page={page}
          size={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

function NotificationItem({
  row,
  onOpen,
  onMarkRead,
  onDelete,
  markingRead,
  deleting,
}: {
  row: NotificationOut;
  onOpen: (n: NotificationOut) => void;
  onMarkRead: (n: NotificationOut) => void;
  onDelete: (n: NotificationOut) => void;
  markingRead: boolean;
  deleting: boolean;
}) {
  const meta = CATEGORY_META[row.category];
  return (
    <article
      className={clsx(
        "flex items-start gap-3 rounded-md border p-3 transition",
        row.is_read
          ? "border-[color:var(--color-border)] bg-white"
          : "border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-100)]/40",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "mt-2 inline-block h-2 w-2 shrink-0 rounded-full",
          row.is_read ? "bg-neutral-300" : "bg-[color:var(--color-danger)]",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="text-sm font-medium text-neutral-900">
            {row.title}
          </span>
          <span className="ml-auto text-xs text-neutral-400 tabular-nums">
            {formatDateTime(row.created_at)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm text-neutral-700">
          {row.body}
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs">
          {row.action_url ? (
            <Link
              href={row.action_url}
              className="text-[color:var(--color-info)] hover:underline"
              onClick={() => onOpen(row)}
            >
              查看详情 →
            </Link>
          ) : null}
          {!row.is_read ? (
            <button
              type="button"
              className="text-neutral-500 hover:text-neutral-800"
              onClick={() => onMarkRead(row)}
              disabled={markingRead}
            >
              标记已读
            </button>
          ) : null}
          <button
            type="button"
            className="text-[color:var(--color-danger)] hover:underline"
            onClick={() => onDelete(row)}
            disabled={deleting}
          >
            删除
          </button>
        </div>
      </div>
    </article>
  );
}

function NotificationsPagination({
  page,
  size,
  total,
  onPageChange,
}: {
  page: number;
  size: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const start = total === 0 ? 0 : (page - 1) * size + 1;
  const end = Math.min(total, page * size);
  return (
    <div className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] bg-white px-4 py-2 text-xs text-neutral-600">
      <div>
        共 <span className="font-semibold text-neutral-800">{total}</span> 条 ·
        当前 {start}-{end}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </Button>
        <span className="text-neutral-500 tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
