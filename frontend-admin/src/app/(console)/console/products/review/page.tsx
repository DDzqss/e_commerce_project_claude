"use client";

/**
 * 商品审核队列 (`/console/products/review`)。
 *
 * 契约 §7 GET /admin/spus?status=&shop_id=&keyword=&page=&size=
 *
 * UI 要素：
 * - Status tab（默认 pending_review；含 approved / rejected / off_shelf / draft / all）
 * - 关键字 + 店铺 ID 筛选
 * - Table：图 + 标题 + 店铺 + 类目 + 品牌 + status + 提交时间 + 查看
 * - 分页
 * - RequirePermission "admin:spu:read_all"
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, type TableColumn } from "@/components/ui/Table";
import { useAdminSPUs } from "@/hooks/useCatalog";
import { imagePlaceholder, imageUrl } from "@/lib/image";
import type { AdminSPUListItem, SPUStatus } from "@/types/api";

const STATUS_TABS: { key: "all" | SPUStatus; label: string }[] = [
  { key: "pending_review", label: "待审核" },
  { key: "approved", label: "已上架" },
  { key: "rejected", label: "已驳回" },
  { key: "off_shelf", label: "已下架" },
  { key: "draft", label: "草稿" },
  { key: "all", label: "全部" },
];

const PAGE_SIZE = 20;

export default function ProductReviewPage() {
  return (
    <RequirePermission permission="admin:spu:read_all">
      <Suspense
        fallback={<div className="text-sm text-neutral-400">加载中…</div>}
      >
        <ProductReviewInner />
      </Suspense>
    </RequirePermission>
  );
}

function ProductReviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialStatus = (searchParams.get("status") ??
    "pending_review") as (typeof STATUS_TABS)[number]["key"];
  const initialKeyword = searchParams.get("keyword") ?? "";
  const initialShop = searchParams.get("shop_id") ?? "";
  const initialPage = Number(searchParams.get("page") ?? "1") || 1;

  const [status, setStatus] =
    useState<(typeof STATUS_TABS)[number]["key"]>(initialStatus);
  const [keywordInput, setKeywordInput] = useState(initialKeyword);
  const [debouncedKeyword, setDebouncedKeyword] = useState(initialKeyword);
  const [shopInput, setShopInput] = useState(initialShop);
  const [debouncedShop, setDebouncedShop] = useState(initialShop);
  const [page, setPage] = useState(initialPage);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedKeyword(keywordInput.trim());
      setDebouncedShop(shopInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [keywordInput, shopInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "pending_review") params.set("status", status);
    if (debouncedKeyword) params.set("keyword", debouncedKeyword);
    if (debouncedShop) params.set("shop_id", debouncedShop);
    if (page !== 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [status, debouncedKeyword, debouncedShop, page, router]);

  const query = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      keyword: debouncedKeyword || undefined,
      shop_id: debouncedShop || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [status, debouncedKeyword, debouncedShop, page],
  );

  const { data, isLoading, isFetching, isError, refetch } =
    useAdminSPUs(query);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns: TableColumn<AdminSPUListItem>[] = [
    {
      key: "main_image",
      title: "图",
      width: 60,
      render: (row) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl(row.main_image)}
          alt={row.title}
          width={44}
          height={44}
          className="h-11 w-11 rounded border border-neutral-200 object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = imagePlaceholder();
          }}
        />
      ),
    },
    {
      key: "title",
      title: "商品",
      render: (row) => (
        <div>
          <div className="font-medium text-neutral-900">{row.title}</div>
          {row.subtitle ? (
            <div className="mt-0.5 line-clamp-1 text-xs text-neutral-400">
              {row.subtitle}
            </div>
          ) : null}
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
      key: "category",
      title: "类目",
      render: (row) => (
        <span className="text-xs text-neutral-600">
          {row.category?.name ?? `#${row.category_id}`}
        </span>
      ),
    },
    {
      key: "brand",
      title: "品牌",
      render: (row) => (
        <span className="text-xs text-neutral-600">
          {row.brand?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      title: "状态",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "created_at",
      title: "提交时间",
      render: (row) => (
        <span className="tabular-nums text-xs text-neutral-600">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      title: "操作",
      align: "right",
      width: 80,
      render: (row) => (
        <Link
          href={`/console/products/review/${row.id}`}
          className="text-[color:var(--color-info)] hover:underline"
        >
          查看
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            商品审核
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            跨店商品审核队列。通过 / 驳回 / 强制下架均记录审核人与备注。
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

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="搜索商品标题 / 副标题"
            aria-label="关键词"
          />
        </div>
        <div className="w-40">
          <Input
            value={shopInput}
            onChange={(e) => setShopInput(e.target.value.replace(/\D/g, ""))}
            placeholder="店铺 ID"
            aria-label="店铺 ID"
            inputMode="numeric"
          />
        </div>
        {debouncedKeyword || debouncedShop ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setKeywordInput("");
              setShopInput("");
            }}
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
        rowKey={(row) => row.id}
        emptyText="暂无符合条件的商品"
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
