"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { Pagination } from "@/components/catalog/Pagination";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import {
  useDeleteAllRead,
  useDeleteNotification,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from "@/hooks/useNotifications";
import { ApiError } from "@/lib/api";
import { messageForCode } from "@/types/errors";
import { cn } from "@/lib/cn";
import {
  NOTIFICATION_CATEGORY_LABEL,
  NOTIFICATION_CATEGORY_LIST,
  type NotificationCategory,
  type NotificationOut,
} from "@/types/notification";

const PAGE_SIZE = 20;

type ReadFilter = "all" | "unread" | "read";

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <Suspense
          fallback={
            <main className="mx-auto max-w-3xl px-6 py-6">
              <Skeleton className="h-40 w-full" />
            </main>
          }
        >
          <NotificationsContent />
        </Suspense>
      </div>
    </RequireAuth>
  );
}

function NotificationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categoryParam = (searchParams.get("category") ?? "") as
    | NotificationCategory
    | "";
  const readParam = (searchParams.get("read") ?? "all") as ReadFilter;
  const pageParam = Number(searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const query = useMemo(() => {
    const q: Parameters<typeof useNotifications>[0] = {
      page,
      size: PAGE_SIZE,
    };
    if (categoryParam) q.category = categoryParam;
    if (readParam === "read") q.is_read = true;
    if (readParam === "unread") q.is_read = false;
    return q;
  }, [categoryParam, readParam, page]);

  const { data, isLoading, isError, refetch } = useNotifications(query);
  const markReadMutation = useMarkRead();
  const markAllReadMutation = useMarkAllRead();
  const deleteMutation = useDeleteNotification();
  const deleteAllReadMutation = useDeleteAllRead();

  const [confirmClear, setConfirmClear] = useState(false);

  const setUrl = (patch: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, String(v));
    }
    if (Object.keys(patch).some((k) => k === "category" || k === "read")) {
      params.delete("page");
    }
    router.push(`/notifications?${params.toString()}`);
  };

  const handleClickItem = (n: NotificationOut) => {
    if (!n.is_read) {
      markReadMutation.mutate({ id: n.id });
    }
    // 有 action_url 时由 NotificationItem 内部 <Link> 跳转
  };

  const handleDelete = async (n: NotificationOut) => {
    try {
      await deleteMutation.mutateAsync({ id: n.id });
      toast.success("已删除");
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "删除失败";
      toast.error(msg);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllReadMutation.mutateAsync();
      toast.success("已全部标记为已读");
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "操作失败";
      toast.error(msg);
    }
  };

  const handleClearRead = async () => {
    try {
      await deleteAllReadMutation.mutateAsync();
      toast.success("已清空已读消息");
      setConfirmClear(false);
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "清空失败";
      toast.error(msg);
    }
  };

  const list = data?.items ?? [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-6 pb-16">
      <h1 className="mb-4 text-2xl font-semibold text-neutral-900">消息通知</h1>

      {/* Category tabs */}
      <nav
        className="mb-3 flex flex-wrap items-center gap-1 overflow-x-auto border-b border-neutral-200"
        aria-label="消息分类"
      >
        <CategoryTabButton
          active={categoryParam === ""}
          onClick={() => setUrl({ category: null })}
        >
          全部
        </CategoryTabButton>
        {NOTIFICATION_CATEGORY_LIST.map((cat) => (
          <CategoryTabButton
            key={cat}
            active={categoryParam === cat}
            onClick={() => setUrl({ category: cat })}
            data-testid={`notif-cat-${cat}`}
          >
            {NOTIFICATION_CATEGORY_LABEL[cat]}
          </CategoryTabButton>
        ))}
      </nav>

      {/* Read filter + actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="未读筛选"
          className="inline-flex overflow-hidden rounded-md border border-neutral-200 text-xs"
        >
          {[
            { value: "all" as ReadFilter, label: "全部" },
            { value: "unread" as ReadFilter, label: "未读" },
            { value: "read" as ReadFilter, label: "已读" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={readParam === opt.value}
              onClick={() => setUrl({ read: opt.value })}
              className={cn(
                "px-3 py-1.5",
                readParam === opt.value
                  ? "bg-[color:var(--color-primary)] text-white"
                  : "bg-white text-neutral-700 hover:bg-neutral-50",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAll}
            loading={markAllReadMutation.isPending}
          >
            全部已读
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmClear(true)}
            className="text-[color:var(--color-primary)]"
          >
            清空已读
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
          加载失败，
          <button
            type="button"
            className="ml-1 underline"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      )}

      {data && list.length === 0 && (
        <EmptyState
          title={readParam === "unread" ? "暂无未读消息" : "暂无消息"}
          description="有新的订单、售后或评价动态时会通知你"
        />
      )}

      {data && list.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {list.map((n) => (
            <li key={n.id} className="border-b border-neutral-100 last:border-b-0">
              <NotificationItem
                notification={n}
                onClick={handleClickItem}
                onDelete={handleDelete}
                showDelete
              />
            </li>
          ))}
        </ul>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="mt-6">
          <Pagination
            page={data.page}
            size={data.size}
            total={data.total}
            onChange={(p) => setUrl({ page: p })}
          />
        </div>
      )}

      <ConfirmModal
        open={confirmClear}
        title="确认清空已读消息？"
        description="清空后不可恢复。"
        danger
        loading={deleteAllReadMutation.isPending}
        onConfirm={handleClearRead}
        onCancel={() => setConfirmClear(false)}
      />
    </main>
  );
}

function CategoryTabButton({
  active,
  onClick,
  children,
  ...rest
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  "data-testid"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 border-b-2 px-3 py-2 text-sm",
        active
          ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)]"
          : "border-transparent text-neutral-600 hover:text-[color:var(--color-primary)]",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
