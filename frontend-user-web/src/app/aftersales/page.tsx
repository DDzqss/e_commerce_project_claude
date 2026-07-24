"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorScreen } from "@/components/ui/ErrorScreen";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/catalog/Pagination";
import { AftersalesStatusBadge } from "@/components/aftersales/AftersalesStatusBadge";
import { AftersalesTypeIcon } from "@/components/aftersales/AftersalesTypeIcon";
import { cn } from "@/lib/cn";
import { useAftersalesList } from "@/hooks/useAftersales";
import {
  AFTERSALES_TYPE_LABEL,
  AftersalesStatus,
  USER_STATUS_GROUPS,
  type AftersalesListItem,
} from "@/types/aftersales";

const PAGE_SIZE = 10;

/** 状态语义 tab（对应 USER_STATUS_GROUPS）。 */
const TABS: { label: string; value: string }[] = [
  { label: "全部", value: "" },
  { label: "待商家审核", value: "pending" },
  { label: "处理中", value: "in_progress" },
  { label: "已完成", value: "done" },
  { label: "已关闭", value: "closed" },
];

export default function AftersalesListPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <Suspense
          fallback={
            <main className="mx-auto max-w-4xl px-6 py-6">
              <Skeleton className="h-40 w-full" />
            </main>
          }
        >
          <AftersalesListContent />
        </Suspense>
      </div>
    </RequireAuth>
  );
}

function AftersalesListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") ?? "";
  const keywordParam = searchParams.get("keyword") ?? "";
  const pageParam = Number(searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const [keyword, setKeyword] = useState(keywordParam);

  const statusFilter = useMemo(() => {
    if (!tabParam) return undefined;
    const group = USER_STATUS_GROUPS[tabParam];
    if (!group || group.length === 0) return undefined;
    return group.join(",");
  }, [tabParam]);

  const query = useMemo(
    () => ({
      status: statusFilter,
      keyword: keywordParam || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [statusFilter, keywordParam, page],
  );

  const { data, isLoading, isError, refetch } = useAftersalesList(query);

  const setUrl = (next: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "" || v === undefined) params.delete(k);
      else params.set(k, String(v));
    }
    if (Object.keys(next).some((k) => k === "tab" || k === "keyword")) {
      params.delete("page");
    }
    router.push(`/aftersales?${params.toString()}`);
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-6">
      <h1 className="mb-4 text-2xl font-semibold text-neutral-900">我的售后</h1>

      <nav
        className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-neutral-200"
        aria-label="售后状态"
      >
        {TABS.map((tab) => {
          const active = tabParam === tab.value;
          return (
            <button
              key={tab.value || "all"}
              type="button"
              onClick={() => setUrl({ tab: tab.value })}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm",
                active
                  ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)]"
                  : "border-transparent text-neutral-600 hover:text-[color:var(--color-primary)]",
              )}
              data-testid={`aftersales-tab-${tab.value || "all"}`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setUrl({ keyword: keyword.trim() });
        }}
        className="mb-4 flex items-center gap-2"
        role="search"
      >
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索售后单号 / 订单号 / 商品名"
          className="h-9 flex-1 rounded border border-neutral-300 bg-white px-3 text-sm text-neutral-800 focus:border-[color:var(--color-primary)] focus:outline-none"
          aria-label="搜索售后"
        />
        <Button type="submit" variant="secondary" size="sm">
          搜索
        </Button>
      </form>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {isError && (
        <ErrorScreen
          title="售后单加载失败"
          description="网络不稳定或服务暂时不可用，请稍后重试。"
          onRetry={() => refetch()}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          title="暂无售后单"
          description={
            tabParam
              ? "该状态下没有售后单"
              : "尚未发起过售后申请。若订单有问题，可在订单详情页发起售后。"
          }
          action={
            <Button onClick={() => router.push("/orders")}>去我的订单</Button>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.items.map((row) => (
            <AftersalesCard key={row.id} row={row} />
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
    </main>
  );
}

function AftersalesCard({ row }: { row: AftersalesListItem }) {
  const firstItem = row.items?.[0];
  const displayCount = row.items_count ?? row.items?.length ?? 0;
  const isRefunding =
    row.status === AftersalesStatus.Refunding ||
    row.status === AftersalesStatus.CompletedRefunded;
  return (
    <li
      className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
      data-testid={`aftersales-card-${row.aftersales_no}`}
    >
      <header className="flex items-center justify-between border-b border-neutral-100 pb-2 text-xs text-neutral-500">
        <div className="flex items-center gap-3">
          <AftersalesTypeIcon type={row.type} showLabel />
          <span className="font-medium text-neutral-700">
            {row.shop?.name ?? "-"}
          </span>
          <span>售后单 {row.aftersales_no}</span>
          <span className="hidden sm:inline">订单 {row.order_no}</span>
        </div>
        <AftersalesStatusBadge status={row.status} />
      </header>

      <div className="mt-3 flex items-start gap-3">
        {firstItem && (
          <Link
            href={`/aftersales/${row.id}`}
            className="h-16 w-16 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-50"
          >
            <ImageWithFallback
              objectKey={firstItem.sku_image ?? null}
              alt={firstItem.spu_title ?? "商品"}
              className="h-full w-full"
            />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/aftersales/${row.id}`}
            className="line-clamp-1 text-sm text-neutral-900 hover:text-[color:var(--color-primary)]"
          >
            {firstItem?.spu_title ?? "商品信息缺失"}
          </Link>
          {displayCount > 1 && (
            <p className="text-xs text-neutral-500">共 {displayCount} 件</p>
          )}
          <p className="mt-1 text-xs text-neutral-500">
            {AFTERSALES_TYPE_LABEL[row.type]}
          </p>
        </div>
        <div className="text-right text-sm text-neutral-700">
          {isRefunding && row.actual_refund_cents !== null ? (
            <>
              实退
              <div className="mt-0.5">
                <Price cents={row.actual_refund_cents} size="sm" />
              </div>
            </>
          ) : (
            <>
              申请退
              <div className="mt-0.5">
                <Price cents={row.refund_amount_cents} size="sm" />
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="mt-3 flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
        <Link
          href={`/aftersales/${row.id}`}
          className="text-sm text-neutral-500 hover:text-[color:var(--color-primary)]"
        >
          查看进度
        </Link>
      </footer>
    </li>
  );
}
