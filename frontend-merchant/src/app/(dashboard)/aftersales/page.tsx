"use client";

/**
 * 商家售后工单列表页（Phase 4 §8.1）。
 *
 * 布局：
 *   1. 顶部 4 张统计卡（stats/summary）
 *   2. Status tabs（默认"待审核" pending_merchant_review）
 *   3. 筛选栏：关键字（售后单号/订单号） + 即将超时开关
 *   4. Table + 分页
 *
 * 关键细节：
 *   - 剩余审核时间列 <12h 红 / <24h 橙 / 其他绿（deadlineTextClass）
 *   - overdue_soon=true 打开时表格顶部醒目红字提示
 *   - 电话号码列表页不直显（详情才有；这里以 user_display_name 展示）
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorScreen } from "@/components/ui/ErrorScreen";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { AftersalesStatusBadge } from "@/components/aftersales/AftersalesStatusBadge";
import { AftersalesTypeIcon } from "@/components/aftersales/AftersalesTypeIcon";
import { cn } from "@/lib/cn";
import { formatCentsCny, formatDateTime } from "@/lib/order-utils";
import {
  computeDeadlineInfo,
  deadlineTextClass,
} from "@/lib/aftersales-utils";
import {
  useAftersalesStats,
  useMerchantAftersales,
} from "@/hooks/useMerchantAftersales";
import {
  AftersalesStatus,
  type MerchantAftersalesListItem,
} from "@/types/aftersales";

const STATUS_TABS: Array<{
  key: "" | AftersalesStatus | "completed" | "closed";
  label: string;
  /** 用于 API 传递（可能是多值） */
  paramValue?: string;
}> = [
  { key: "", label: "全部" },
  {
    key: AftersalesStatus.PendingMerchantReview,
    label: "待审核",
    paramValue: AftersalesStatus.PendingMerchantReview,
  },
  {
    key: AftersalesStatus.ReturnShippedWaitingReceive,
    label: "待收货",
    paramValue: AftersalesStatus.ReturnShippedWaitingReceive,
  },
  {
    key: AftersalesStatus.MerchantAgreedWaitingShip,
    label: "待再发货",
    paramValue: AftersalesStatus.MerchantAgreedWaitingShip,
  },
  {
    key: "completed",
    label: "已完成",
    paramValue: `${AftersalesStatus.CompletedRefunded},${AftersalesStatus.CompletedExchanged}`,
  },
  {
    key: "closed",
    label: "已关闭",
    paramValue: `${AftersalesStatus.UserCancelled},${AftersalesStatus.SystemClosed}`,
  },
];

const PAGE_SIZE = 20;

export default function AftersalesListPage() {
  // 默认最关键：待审核
  const [statusTab, setStatusTab] = useState<
    "" | AftersalesStatus | "completed" | "closed"
  >(AftersalesStatus.PendingMerchantReview);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [overdueSoon, setOverdueSoon] = useState(false);
  const [page, setPage] = useState(1);

  const statsQuery = useAftersalesStats();

  // 将 tab key 映射为 API status 参数（可能逗号分隔）
  const statusParam = useMemo(() => {
    const found = STATUS_TABS.find((t) => t.key === statusTab);
    return found?.paramValue ?? "";
  }, [statusTab]);

  const { data, isLoading, isError, refetch } = useMerchantAftersales({
    status: statusParam || undefined,
    keyword: keyword || undefined,
    overdue_soon: overdueSoon || undefined,
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
        <h2 className="text-2xl font-semibold text-neutral-900">售后处理</h2>
        <p className="mt-1 text-sm text-neutral-500">
          处理用户发起的售后单：审核、收货、拒收、换货再发货
        </p>
      </header>

      {/* 4 张统计卡 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="待审核"
          value={statsQuery.data?.pending_review_count ?? "—"}
          hint="需在 72 小时内审核"
          tone="warning"
        />
        <StatCard
          label="即将超时"
          value={statsQuery.data?.overdue_soon_count ?? "—"}
          hint="审核 deadline < 24h"
          tone="danger"
        />
        <StatCard
          label="待收货"
          value={statsQuery.data?.waiting_receive_count ?? "—"}
          hint="用户已寄回，请及时验收"
          tone="info"
        />
        <StatCard
          label="本月已完成"
          value={statsQuery.data?.completed_this_month_count ?? "—"}
          hint="含退款完成 + 换货完成"
          tone="success"
        />
      </div>

      {/* Status tabs */}
      <div className="border-b border-neutral-200">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="售后状态筛选">
          {STATUS_TABS.map((tab) => {
            const active = statusTab === tab.key;
            return (
              <button
                key={tab.key || "all"}
                type="button"
                onClick={() => {
                  setStatusTab(tab.key as typeof statusTab);
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
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="售后单号 / 订单号 / 关键字"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
          className="max-w-xs"
        />
        <Button variant="secondary" onClick={onSearch}>
          搜索
        </Button>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={overdueSoon}
            onChange={(e) => {
              setOverdueSoon(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-neutral-300 text-red-600 focus:ring-red-500"
          />
          <span>
            只看
            <span className="ml-1 font-semibold text-red-600">即将超时</span>
          </span>
        </label>
        {keyword || overdueSoon ? (
          <Button
            variant="ghost"
            onClick={() => {
              setKeywordInput("");
              setKeyword("");
              setOverdueSoon(false);
              setPage(1);
            }}
          >
            重置
          </Button>
        ) : null}
      </div>

      {/* Overdue soon 顶部提示 */}
      {overdueSoon ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="font-semibold">
            ⚠ 当前筛选：审核 deadline &lt; 24 小时。
          </span>
          {" "}请优先处理，超时未审核将自动升级至平台仲裁。
        </div>
      ) : null}

      {/* Table */}
      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isError ? (
          <ErrorScreen
            title="售后单列表加载失败"
            description="网络不稳定或服务暂时不可用，请稍后重试。"
            onRetry={() => refetch()}
            className="border-0 shadow-none"
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<span>📮</span>}
            title="暂无售后单"
            description="当前筛选条件下没有匹配记录"
            className="border-0"
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3">售后单号 / 类型</th>
                <th className="px-4 py-3">用户</th>
                <th className="px-4 py-3">订单号</th>
                <th className="w-16 px-4 py-3 text-center">商品</th>
                <th className="w-28 px-4 py-3">金额</th>
                <th className="w-24 px-4 py-3">状态</th>
                <th className="w-40 px-4 py-3">剩余审核时间</th>
                <th className="w-24 px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.items.map((row) => (
                <AftersalesRow key={row.id} row={row} />
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// 行渲染
// ---------------------------------------------------------------------------

function AftersalesRow({ row }: { row: MerchantAftersalesListItem }) {
  const detailHref = `/aftersales/${row.aftersales_no}`;
  const isPending = row.status === AftersalesStatus.PendingMerchantReview;
  const deadlineInfo = isPending
    ? computeDeadlineInfo(row.merchant_review_deadline)
    : null;

  return (
    <tr className="hover:bg-neutral-50/60">
      <td className="px-4 py-3 align-top">
        <Link
          href={detailHref}
          className="font-mono text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          {row.aftersales_no}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <AftersalesTypeIcon type={row.type} />
        </div>
        <div className="mt-0.5 text-xs text-neutral-500">
          {formatDateTime(row.created_at)}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-neutral-800">
        <div>{row.user_display_name ?? `用户 #${row.user_id}`}</div>
      </td>
      <td className="px-4 py-3 align-top">
        <Link
          href={`/orders/${row.order_no}`}
          className="font-mono text-xs text-neutral-700 hover:text-[var(--color-primary)] hover:underline"
        >
          {row.order_no}
        </Link>
      </td>
      <td className="px-4 py-3 align-top text-center text-neutral-700">
        {row.items_count}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-neutral-900">
          {formatCentsCny(row.refund_amount_cents)}
        </div>
        {row.actual_refund_cents !== null &&
        row.actual_refund_cents !== row.refund_amount_cents ? (
          <div className="mt-0.5 text-xs text-emerald-700">
            实退 {formatCentsCny(row.actual_refund_cents)}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top">
        <AftersalesStatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3 align-top">
        {deadlineInfo ? (
          <span className={cn("text-xs", deadlineTextClass(deadlineInfo.level))}>
            {deadlineInfo.text}
          </span>
        ) : (
          <span className="text-xs text-neutral-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-top text-right">
        <Link
          href={detailHref}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          详情
        </Link>
      </td>
    </tr>
  );
}
