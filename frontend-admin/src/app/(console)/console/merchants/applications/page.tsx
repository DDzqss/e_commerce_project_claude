"use client";

/**
 * 商家入驻申请列表页 (`/console/merchants/applications`)。
 *
 * 契约 §9 GET /admin/merchant-applications
 *
 * UI 要素：
 * - 顶部状态 tab（pending / approved / rejected / withdrawn / all）
 * - 搜索框（keyword，防抖 300ms）
 * - 表格：申请人昵称 / 店铺名 / 联系人 / 联系电话 / 状态 Badge / 提交时间 / 操作
 * - 分页
 * - 权限：admin:merchant_application:read（用 RequirePermission 包裹）
 *
 * URL 参数同步：status / keyword / page 反映在查询字符串中，方便复制链接分享。
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { RequirePermission } from "@/components/auth/RequirePermission";
import {
  ApplicationStatusBadge,
} from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Table, type TableColumn } from "@/components/ui/Table";
import {
  listMerchantApplications,
  type ListMerchantApplicationsQuery,
} from "@/lib/merchant-application-api";
import type {
  MerchantApplicationOut,
  MerchantApplicationStatus,
} from "@/types/api";

const STATUS_TABS: {
  key: "all" | MerchantApplicationStatus;
  label: string;
}[] = [
  { key: "pending", label: "待审核" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已驳回" },
  { key: "withdrawn", label: "已撤回" },
  { key: "all", label: "全部" },
];

const PAGE_SIZE = 20;

export default function MerchantApplicationsPage() {
  return (
    <RequirePermission permission="admin:merchant_application:read">
      <Suspense fallback={<div className="text-sm text-neutral-400">加载中…</div>}>
        <MerchantApplicationsInner />
      </Suspense>
    </RequirePermission>
  );
}

function MerchantApplicationsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 从 URL 读取初始参数
  const initialStatus = (searchParams.get("status") ??
    "pending") as (typeof STATUS_TABS)[number]["key"];
  const initialKeyword = searchParams.get("keyword") ?? "";
  const initialPage = Number(searchParams.get("page") ?? "1") || 1;

  const [status, setStatus] =
    useState<(typeof STATUS_TABS)[number]["key"]>(initialStatus);
  const [keywordInput, setKeywordInput] = useState(initialKeyword);
  const [debouncedKeyword, setDebouncedKeyword] = useState(initialKeyword);
  const [page, setPage] = useState(initialPage);

  // 300ms 防抖
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedKeyword(keywordInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [keywordInput]);

  // 同步 URL（用 replace 避免推入历史栈）
  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "pending") params.set("status", status);
    if (debouncedKeyword) params.set("keyword", debouncedKeyword);
    if (page !== 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : `?`, { scroll: false });
  }, [status, debouncedKeyword, page, router]);

  const query: ListMerchantApplicationsQuery = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      keyword: debouncedKeyword || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [status, debouncedKeyword, page],
  );

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["merchant-applications", query],
    queryFn: () => listMerchantApplications(query),
    placeholderData: (prev) => prev,
  });

  const columns: TableColumn<MerchantApplicationOut>[] = [
    {
      key: "applicant",
      title: "申请人",
      render: (row) => (
        <div>
          <div className="font-medium text-neutral-900">
            {row.applicant_nickname || `用户#${row.applicant_user_id}`}
          </div>
          <div className="text-xs text-neutral-400">
            UID {row.applicant_user_id}
          </div>
        </div>
      ),
    },
    {
      key: "shop_name",
      title: "店铺名",
      render: (row) => (
        <span className="text-neutral-800">{row.shop_name}</span>
      ),
    },
    {
      key: "contact_name",
      title: "联系人",
      render: (row) => row.contact_name,
    },
    {
      key: "contact_phone",
      title: "联系电话",
      render: (row) => (
        <span className="tabular-nums text-neutral-700">
          {row.contact_phone}
        </span>
      ),
    },
    {
      key: "status",
      title: "状态",
      render: (row) => <ApplicationStatusBadge status={row.status} />,
    },
    {
      key: "created_at",
      title: "提交时间",
      render: (row) => (
        <span className="tabular-nums text-neutral-600">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      title: "操作",
      align: "right",
      width: 100,
      render: (row) => (
        <Link
          href={`/console/merchants/applications/${row.id}`}
          className="text-[color:var(--color-info)] hover:underline"
        >
          查看
        </Link>
      ),
    },
  ];

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            商家入驻审核
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            审批通过后系统将自动创建商家账号与店铺，并生成初始密码。
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          loading={isFetching && !isLoading}
        >
          刷新
        </Button>
      </header>

      {/* 状态 tab */}
      <div className="flex items-center gap-1 border-b border-[color:var(--color-border)]">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setStatus(tab.key);
              setPage(1);
            }}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2 text-sm transition",
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

      {/* 搜索框 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-sm">
          <Input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="搜索店铺名 / 联系人"
            aria-label="关键词搜索"
          />
        </div>
        {debouncedKeyword ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setKeywordInput("")}
          >
            清空
          </Button>
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
        emptyText="暂无符合条件的申请"
        rowKey={(row) => row.id}
        pagination={{
          page,
          size: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}

/**
 * 格式化 ISO timestamp → 本地时区 "YYYY-MM-DD HH:mm"。
 * 后端全部返回 UTC，前端本地化展示。
 */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
