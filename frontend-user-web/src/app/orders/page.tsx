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
import { cn } from "@/lib/cn";
import { useOrders } from "@/hooks/useOrders";
import {
  ORDER_STATUS_LABEL,
  OrderStatus,
  type OrderListItem,
} from "@/types/order";

const PAGE_SIZE = 10;

/** 顶部状态 tab：全部 + 5 个业务状态。 */
const STATUS_TABS: { label: string; value: OrderStatus | "" }[] = [
  { label: "全部", value: "" },
  { label: "待支付", value: OrderStatus.PendingPayment },
  { label: "待发货", value: OrderStatus.Paid },
  { label: "待收货", value: OrderStatus.Shipped },
  { label: "已完成", value: OrderStatus.Completed },
  { label: "已取消", value: OrderStatus.Cancelled },
];

export default function OrdersPage() {
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
          <OrdersContent />
        </Suspense>
      </div>
    </RequireAuth>
  );
}

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const statusParam = (searchParams.get("status") ?? "") as OrderStatus | "";
  const keywordParam = searchParams.get("keyword") ?? "";
  const pageParam = Number(searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const [keyword, setKeyword] = useState(keywordParam);

  const query = useMemo(
    () => ({
      status: statusParam || undefined,
      keyword: keywordParam || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [statusParam, keywordParam, page],
  );

  const { data, isLoading, isError, refetch } = useOrders(query);

  const setUrl = (next: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "" || v === undefined) params.delete(k);
      else params.set(k, String(v));
    }
    // 切换 tab / 搜索时回到第 1 页
    if (
      Object.keys(next).some((k) => k === "status" || k === "keyword")
    ) {
      params.delete("page");
    }
    router.push(`/orders?${params.toString()}`);
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-6">
      <h1 className="mb-4 text-2xl font-semibold text-neutral-900">我的订单</h1>

      {/* status tabs */}
      <nav
        className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-neutral-200"
        aria-label="订单状态"
      >
        {STATUS_TABS.map((tab) => {
          const active = statusParam === tab.value;
          return (
            <button
              key={tab.value || "all"}
              type="button"
              onClick={() => setUrl({ status: tab.value })}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm",
                active
                  ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)]"
                  : "border-transparent text-neutral-600 hover:text-[color:var(--color-primary)]",
              )}
              data-testid={`status-tab-${tab.value || "all"}`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* 搜索栏 */}
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
          placeholder="搜索订单号或商品名"
          className="h-9 flex-1 rounded border border-neutral-300 bg-white px-3 text-sm text-neutral-800 focus:border-[color:var(--color-primary)] focus:outline-none"
          aria-label="搜索订单"
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
          title="订单加载失败"
          description="网络不稳定或服务暂时不可用，请稍后重试。"
          onRetry={() => refetch()}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          title="暂无订单"
          description={
            statusParam
              ? `没有${ORDER_STATUS_LABEL[statusParam as OrderStatus] ?? ""}的订单`
              : "还没有任何订单，去逛逛吧"
          }
          action={
            <Button onClick={() => router.push("/")}>去逛逛</Button>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.items.map((order) => (
            <OrderCard key={order.id} order={order} />
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

function OrderCard({ order }: { order: OrderListItem }) {
  const firstItem = order.items?.[0];
  const displayCount = order.items_count ?? order.items?.length ?? 0;
  return (
    <li
      className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
      data-testid={`order-card-${order.order_no}`}
    >
      <header className="flex items-center justify-between border-b border-neutral-100 pb-2 text-xs text-neutral-500">
        <div className="flex items-center gap-3">
          <span className="font-medium text-neutral-700">
            {order.shop?.name ?? "-"}
          </span>
          <span>订单号 {order.order_no}</span>
        </div>
        <StatusBadge status={order.status} />
      </header>
      <div className="mt-3 flex items-start gap-3">
        {firstItem && (
          <Link
            href={`/orders/${order.order_no}`}
            className="h-16 w-16 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-50"
          >
            <ImageWithFallback
              objectKey={firstItem.sku_image}
              alt={firstItem.spu_title}
              className="h-full w-full"
            />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {firstItem ? (
            <Link
              href={`/orders/${order.order_no}`}
              className="line-clamp-1 text-sm text-neutral-900 hover:text-[color:var(--color-primary)]"
            >
              {firstItem.spu_title}
            </Link>
          ) : (
            <span className="text-sm text-neutral-500">订单商品信息缺失</span>
          )}
          {displayCount > 1 && (
            <p className="text-xs text-neutral-500">
              共 {displayCount} 件商品
            </p>
          )}
        </div>
        <div className="text-right text-sm text-neutral-700">
          合计
          <div className="mt-0.5">
            <Price cents={order.total_cents} size="sm" />
          </div>
        </div>
      </div>
      <footer className="mt-3 flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
        <Link
          href={`/orders/${order.order_no}`}
          className="text-sm text-neutral-500 hover:text-[color:var(--color-primary)]"
        >
          查看详情
        </Link>
        {order.status === OrderStatus.PendingPayment && (
          <Link href={`/orders/${order.order_no}/pay`}>
            <Button size="sm">立即支付</Button>
          </Link>
        )}
        {order.status === OrderStatus.Shipped && (
          <Link href={`/orders/${order.order_no}/shipment`}>
            <Button variant="secondary" size="sm">
              查看物流
            </Button>
          </Link>
        )}
      </footer>
    </li>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const label = ORDER_STATUS_LABEL[status] ?? status;
  const color =
    status === OrderStatus.PendingPayment
      ? "text-[color:var(--color-primary)] bg-[color:var(--color-primary-50)]"
      : status === OrderStatus.Paid || status === OrderStatus.Shipped
        ? "text-blue-600 bg-blue-50"
        : status === OrderStatus.Completed
          ? "text-green-700 bg-green-50"
          : "text-neutral-500 bg-neutral-100";
  return (
    <span
      className={cn("rounded px-2 py-0.5 text-xs", color)}
      data-testid={`status-badge-${status}`}
    >
      {label}
    </span>
  );
}
