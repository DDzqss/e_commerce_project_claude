"use client";

/**
 * 商家订单列表页（Phase 3 §10.1）。
 *
 * 布局：
 *   1. 顶部 4 张统计卡（stats/summary）
 *   2. Status tabs（默认待发货 paid）
 *   3. 筛选栏：关键字（订单号/收货人/电话） + 日期区间
 *   4. Table + 分页
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OrderStatusBadge } from "@/components/ui/OrderStatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { ShipOrderModal } from "@/components/orders/ShipOrderModal";
import { CancelOrderModal } from "@/components/orders/CancelOrderModal";
import { cn } from "@/lib/cn";
import { formatCentsCny, formatDateTime, maskPhone } from "@/lib/order-utils";
import {
  useMerchantOrders,
  useMerchantOrderStats,
} from "@/hooks/useMerchantOrders";
import {
  OrderStatus,
  type MerchantOrderListItem,
} from "@/types/order";

const STATUS_TABS: Array<{ key: OrderStatus | ""; label: string }> = [
  { key: "", label: "全部" },
  { key: OrderStatus.PendingPayment, label: "待付款" },
  { key: OrderStatus.Paid, label: "待发货" },
  { key: OrderStatus.Shipped, label: "已发货" },
  { key: OrderStatus.Completed, label: "已完成" },
  { key: OrderStatus.Cancelled, label: "已取消" },
];

const PAGE_SIZE = 20;

export default function OrdersListPage() {
  // 默认展示待发货，商家最关心
  const [status, setStatus] = useState<OrderStatus | "">(OrderStatus.Paid);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const [shipping, setShipping] = useState<MerchantOrderListItem | null>(null);
  const [cancelling, setCancelling] = useState<MerchantOrderListItem | null>(
    null,
  );

  const statsQuery = useMerchantOrderStats();

  const { data, isLoading, isError, refetch } = useMerchantOrders({
    status: status || undefined,
    keyword: keyword || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    page,
    size: PAGE_SIZE,
  });

  const totalPages = useMemo(
    () =>
      data ? Math.max(1, Math.ceil(data.total / (data.size || PAGE_SIZE))) : 1,
    [data],
  );

  const onSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-neutral-900">订单管理</h2>
        <p className="mt-1 text-sm text-neutral-500">
          处理来自用户的订单：查看详情、发货、缺货取消与备注
        </p>
      </header>

      {/* 4 张统计卡 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="待付款"
          value={statsQuery.data?.pending_payment_count ?? "—"}
          hint="用户尚未完成支付"
          tone="warning"
        />
        <StatCard
          label="待发货"
          value={statsQuery.data?.paid_pending_ship_count ?? "—"}
          hint="需在 48 小时内处理"
          tone="primary"
        />
        <StatCard
          label="已发货"
          value={statsQuery.data?.shipped_count ?? "—"}
          hint="含 15 日自动确认收货"
          tone="info"
        />
        <StatCard
          label="今日成交额"
          value={
            statsQuery.data
              ? formatCentsCny(statsQuery.data.revenue_today_cents)
              : "—"
          }
          hint={`今日完成 ${statsQuery.data?.completed_today_count ?? 0} 单`}
          tone="success"
        />
      </div>

      {/* Status tabs */}
      <div className="border-b border-neutral-200">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="订单状态筛选">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.key;
            return (
              <button
                key={tab.key || "all"}
                type="button"
                onClick={() => {
                  setStatus(tab.key);
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="订单号 / 收货人 / 电话"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
          className="max-w-xs"
        />
        <DateRangePicker
          start={startDate}
          end={endDate}
          onChange={({ start, end }) => {
            setStartDate(start);
            setEndDate(end);
            setPage(1);
          }}
        />
        <Button variant="secondary" onClick={onSearch}>
          搜索
        </Button>
        {keyword || startDate || endDate ? (
          <Button
            variant="ghost"
            onClick={() => {
              setKeywordInput("");
              setKeyword("");
              setStartDate("");
              setEndDate("");
              setPage(1);
            }}
          >
            重置
          </Button>
        ) : null}
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-600">
            订单列表加载失败。
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => refetch()}
            >
              重试
            </button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">
            <div className="text-3xl">📦</div>
            <div className="mt-2">暂无订单</div>
            <div className="mt-1 text-xs text-neutral-400">
              当前筛选条件下没有匹配订单
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3">订单号 / 下单时间</th>
                <th className="px-4 py-3">收货人</th>
                <th className="px-4 py-3">商品</th>
                <th className="w-28 px-4 py-3">合计</th>
                <th className="w-24 px-4 py-3">状态</th>
                <th className="w-56 px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.items.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onShip={setShipping}
                  onCancel={setCancelling}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Pagination */}
      {data && data.total > 0 ? (
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <div>
            共 {data.total} 条 · 第 {page} / {totalPages} 页
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

      {shipping ? (
        <ShipOrderModal
          open
          onClose={() => setShipping(null)}
          order={shipping}
        />
      ) : null}
      {cancelling ? (
        <CancelOrderModal
          open
          onClose={() => setCancelling(null)}
          order={cancelling}
        />
      ) : null}
    </div>
  );
}

/**
 * 单行渲染。
 * 商品列采用「首件 x 数量 + N 件」的紧凑摘要格式。
 */
function OrderRow({
  order,
  onShip,
  onCancel,
}: {
  order: MerchantOrderListItem;
  onShip: (o: MerchantOrderListItem) => void;
  onCancel: (o: MerchantOrderListItem) => void;
}) {
  const detailHref = `/orders/${order.order_no}`;
  const first = order.items[0];
  const others = Math.max(0, order.items_count - (first?.quantity ?? 0));

  const canShip = order.status === OrderStatus.Paid;
  const canCancel = order.status === OrderStatus.Paid;

  return (
    <tr className="hover:bg-neutral-50/60">
      <td className="px-4 py-3 align-top">
        <Link
          href={detailHref}
          className="font-mono text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          {order.order_no}
        </Link>
        <div className="mt-0.5 text-xs text-neutral-500">
          {formatDateTime(order.created_at)}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-neutral-800">
        <div>{order.receiver_name}</div>
        <div className="mt-0.5 text-xs text-neutral-500">
          {maskPhone(order.receiver_phone)}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-neutral-700">
        {first ? (
          <>
            <span className="line-clamp-1">
              {first.spu_title} x{first.quantity}
            </span>
            {others > 0 ? (
              <span className="mt-0.5 block text-xs text-neutral-400">
                + {others} 件
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-top font-medium text-neutral-900">
        {formatCentsCny(order.total_cents)}
      </td>
      <td className="px-4 py-3 align-top">
        <OrderStatusBadge status={order.status} />
      </td>
      <td className="px-4 py-3 align-top text-right">
        <div className="flex justify-end gap-3">
          <Link
            href={detailHref}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            详情
          </Link>
          {canShip ? (
            <button
              type="button"
              onClick={() => onShip(order)}
              className="text-sm text-emerald-700 hover:underline"
            >
              发货
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              onClick={() => onCancel(order)}
              className="text-sm text-red-600 hover:underline"
            >
              取消
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
