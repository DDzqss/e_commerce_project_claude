"use client";

/**
 * 平台订单大盘 (`/console/orders`)。
 *
 * 契约 §11 GET /admin/orders?status=&shop_id=&user_id=&keyword=&start_date=&end_date=&page=&size=
 *
 * UI 要素：
 * - Status tab（含全部）
 * - 顶部多筛选：关键字 / 店铺 ID / 用户 ID / 日期区间
 * - Table：订单号 / 下单时间 / 店铺 / 用户 / 收货人 / 商品数 / 合计 / 状态 / 操作
 * - 分页
 * - 右上角"手动触发超时扫描"按钮（需 admin:order:intervene）
 * - 需 admin:order:read_all 才能进入
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import {
  ORDER_STATUS_OPTIONS,
  OrderStatusBadge,
} from "@/components/ui/OrderStatusBadge";
import { Table, type TableColumn } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAdminOrders } from "@/hooks/useOrders";
import { usePermission } from "@/hooks/useAuth";
import { triggerProcessTimeouts } from "@/lib/task-api";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/types/errors";
import type { AdminOrderListItem, OrderStatus } from "@/types/order";

const PAGE_SIZE = 20;

type StatusKey = "all" | OrderStatus;

export default function AdminOrdersPage() {
  return (
    <RequirePermission permission="admin:order:read_all">
      <Suspense
        fallback={<div className="text-sm text-neutral-400">加载中…</div>}
      >
        <AdminOrdersInner />
      </Suspense>
    </RequirePermission>
  );
}

function AdminOrdersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canIntervene = usePermission("admin:order:intervene");

  const initialStatus = (searchParams.get("status") ?? "all") as StatusKey;
  const initialKeyword = searchParams.get("keyword") ?? "";
  const initialShop = searchParams.get("shop_id") ?? "";
  const initialUser = searchParams.get("user_id") ?? "";
  const initialStart = searchParams.get("start_date") ?? "";
  const initialEnd = searchParams.get("end_date") ?? "";
  const initialPage = Number(searchParams.get("page") ?? "1") || 1;

  const [status, setStatus] = useState<StatusKey>(initialStatus);
  const [keywordInput, setKeywordInput] = useState(initialKeyword);
  const [debouncedKeyword, setDebouncedKeyword] = useState(initialKeyword);
  const [shopInput, setShopInput] = useState(initialShop);
  const [debouncedShop, setDebouncedShop] = useState(initialShop);
  const [userInput, setUserInput] = useState(initialUser);
  const [debouncedUser, setDebouncedUser] = useState(initialUser);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [page, setPage] = useState(initialPage);

  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  // 输入去抖 300ms
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedKeyword(keywordInput.trim());
      setDebouncedShop(shopInput.trim());
      setDebouncedUser(userInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [keywordInput, shopInput, userInput]);

  // URL 同步
  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (debouncedKeyword) params.set("keyword", debouncedKeyword);
    if (debouncedShop) params.set("shop_id", debouncedShop);
    if (debouncedUser) params.set("user_id", debouncedUser);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (page !== 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [
    status,
    debouncedKeyword,
    debouncedShop,
    debouncedUser,
    startDate,
    endDate,
    page,
    router,
  ]);

  const query = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      keyword: debouncedKeyword || undefined,
      shop_id: debouncedShop || undefined,
      user_id: debouncedUser || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [status, debouncedKeyword, debouncedShop, debouncedUser, startDate, endDate, page],
  );

  const { data, isLoading, isFetching, isError, refetch } =
    useAdminOrders(query);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const timeoutMutation = useMutation({
    mutationFn: triggerProcessTimeouts,
    onSuccess: (res) => {
      setShowTimeoutModal(false);
      toast.push({
        type: "success",
        message: `扫描完成：超时取消 ${res.cancelled_expired_count} 单 / 自动收货 ${res.auto_completed_count} 单`,
      });
      // 触发列表 & 大盘刷新
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "order-overview"] });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? getErrorMessage(err.code, err.message)
          : "扫描失败，请稍后重试";
      toast.push({ type: "error", message: msg });
    },
  });

  const hasAnyFilter =
    debouncedKeyword ||
    debouncedShop ||
    debouncedUser ||
    startDate ||
    endDate ||
    status !== "all";

  const columns: TableColumn<AdminOrderListItem>[] = [
    {
      key: "order_no",
      title: "订单号 / 下单时间",
      render: (row) => (
        <div>
          <div className="font-mono text-xs text-neutral-900">
            {row.order_no}
          </div>
          <div className="mt-0.5 text-xs text-neutral-400 tabular-nums">
            {formatDateTime(row.created_at)}
          </div>
        </div>
      ),
    },
    {
      key: "shop",
      title: "店铺",
      render: (row) => (
        <div className="text-neutral-700">
          {row.shop?.name ?? `#${row.shop_id}`}
        </div>
      ),
    },
    {
      key: "user",
      title: "用户",
      render: (row) => (
        <div className="text-xs text-neutral-700">
          <div>
            {row.user?.nickname || <span className="text-neutral-400">—</span>}
            <span className="ml-1 text-neutral-400">#{row.user_id}</span>
          </div>
          {row.user?.phone ? (
            <div className="text-neutral-500 tabular-nums">{row.user.phone}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "receiver",
      title: "收货人",
      render: (row) => (
        <div className="text-xs">
          <div className="text-neutral-800">{row.receiver_name}</div>
          <div className="text-neutral-500 tabular-nums">
            {row.receiver_phone}
          </div>
        </div>
      ),
    },
    {
      key: "item_count",
      title: "商品数",
      align: "center",
      width: 70,
      render: (row) => (
        <span className="tabular-nums text-neutral-700">{row.item_count}</span>
      ),
    },
    {
      key: "total",
      title: "合计",
      align: "right",
      width: 100,
      render: (row) => (
        <span className="tabular-nums font-semibold text-neutral-900">
          ¥{(row.total_cents / 100).toFixed(2)}
        </span>
      ),
    },
    {
      key: "status",
      title: "状态",
      render: (row) => <OrderStatusBadge status={row.status} />,
    },
    {
      key: "actions",
      title: "操作",
      align: "right",
      width: 80,
      render: (row) => (
        <Link
          href={`/console/orders/${row.order_no}`}
          className="text-[color:var(--color-info)] hover:underline"
        >
          查看详情
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">订单大盘</h1>
          <p className="mt-1 text-sm text-neutral-500">
            跨店订单查询。支持强制取消、内部备注、模拟物流推进等干预操作。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canIntervene ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTimeoutModal(true)}
            >
              手动触发超时扫描
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            loading={isFetching && !isLoading}
          >
            刷新
          </Button>
        </div>
      </header>

      {/* Status tab */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[color:var(--color-border)]">
        {ORDER_STATUS_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setStatus(tab.key);
              setPage(1);
            }}
            className={clsx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition",
              status === tab.key
                ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)] font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-800",
            )}
            aria-current={status === tab.key ? "page" : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 筛选区 */}
      <div className="rounded-md border border-[color:var(--color-border)] bg-white p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FormField label="关键字（订单号 / 收货人 / 用户手机邮箱）">
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="例如 20260722… 或 138…"
              aria-label="关键字"
            />
          </FormField>
          <FormField label="店铺 ID">
            <Input
              value={shopInput}
              onChange={(e) =>
                setShopInput(e.target.value.replace(/\D/g, ""))
              }
              placeholder="例如 12"
              aria-label="店铺 ID"
              inputMode="numeric"
            />
          </FormField>
          <FormField label="用户 ID">
            <Input
              value={userInput}
              onChange={(e) =>
                setUserInput(e.target.value.replace(/\D/g, ""))
              }
              placeholder="例如 5001"
              aria-label="用户 ID"
              inputMode="numeric"
            />
          </FormField>
          <FormField label="下单日期起">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              aria-label="下单日期起"
              max={endDate || undefined}
            />
          </FormField>
          <FormField label="下单日期止">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              aria-label="下单日期止"
              min={startDate || undefined}
            />
          </FormField>
        </div>
        {hasAnyFilter ? (
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatus("all");
                setKeywordInput("");
                setShopInput("");
                setUserInput("");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
            >
              清空所有筛选
            </Button>
          </div>
        ) : null}
      </div>

      {isError ? (
        <div className="rounded border border-red-200 bg-[color:var(--color-danger-soft)] px-3 py-2 text-xs text-[color:var(--color-danger)]">
          加载失败，请点击右上角「刷新」重试。
        </div>
      ) : null}

      <Table
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyText="暂无符合条件的订单"
        pagination={{
          page,
          size: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />

      {/* 手动触发超时扫描 Modal */}
      <Modal
        open={showTimeoutModal}
        onClose={() =>
          timeoutMutation.isPending ? undefined : setShowTimeoutModal(false)
        }
        title="手动触发超时扫描"
        closeOnOverlay={!timeoutMutation.isPending}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowTimeoutModal(false)}
              disabled={timeoutMutation.isPending}
            >
              取消
            </Button>
            <Button
              loading={timeoutMutation.isPending}
              onClick={() => timeoutMutation.mutate()}
            >
              开始扫描
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm text-neutral-700">
          <p>
            此操作会立即扫描全平台超时订单并执行状态流转：
          </p>
          <ul className="list-inside list-disc pl-1 text-neutral-600">
            <li>
              <span className="font-medium">待支付超时</span> → 自动取消 +
              释放库存
            </li>
            <li>
              <span className="font-medium">已发货超过 15 天</span> →
              自动确认收货
            </li>
          </ul>
          <p className="text-xs text-neutral-500">
            生产环境每 1-5 分钟由 cron 自动执行；本入口仅供联调 /
            紧急调试使用。操作是幂等的，多次触发不会重复处理。
          </p>
        </div>
      </Modal>
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
