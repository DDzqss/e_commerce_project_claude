"use client";

/**
 * 平台评价审核大盘 (`/console/reviews`)。
 *
 * 契约 §5.4 GET /admin/reviews?visible=&shop_id=&spu_id=&keyword=&page=&size=
 *
 * UI 要素：
 * - 顶部筛选：可见性 (visible/hidden) / 星级 / 店铺 / 商品 / 关键字
 * - Table：评价内容摘要 + 星级 + 用户 + 店铺 + 商品 + 状态 + 操作（查看 / 隐藏 / 恢复）
 * - 分页 + URL 同步
 * - 权限 admin:review:moderate
 *
 * 交互：
 * - 隐藏 → HideReviewModal（≥ 5 字 + 二次确认）
 * - 恢复 → confirm 后直接调用 restoreReview
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { StarRating } from "@/components/ui/StarRating";
import { Table, type TableColumn } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { HideReviewModal } from "@/components/reviews/HideReviewModal";
import { useAdminReviews } from "@/hooks/useAdminReviews";
import { hideReview, restoreReview } from "@/lib/review-api";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/types/errors";
import { imagePlaceholder, imageUrl } from "@/lib/image";
import type {
  AdminReviewListItem,
  HideReviewPayload,
} from "@/types/review";

const PAGE_SIZE = 20;

type VisibilityKey = "all" | "visible" | "hidden";

export default function AdminReviewsPage() {
  return (
    <RequirePermission permission="admin:review:moderate">
      <Suspense
        fallback={<div className="text-sm text-neutral-400">加载中…</div>}
      >
        <AdminReviewsInner />
      </Suspense>
    </RequirePermission>
  );
}

function AdminReviewsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const initialVisibility = (searchParams.get("visibility") ??
    "all") as VisibilityKey;
  const initialRating = searchParams.get("rating") ?? "";
  const initialShop = searchParams.get("shop_id") ?? "";
  const initialSpu = searchParams.get("spu_id") ?? "";
  const initialKeyword = searchParams.get("keyword") ?? "";
  const initialPage = Number(searchParams.get("page") ?? "1") || 1;

  const [visibility, setVisibility] = useState<VisibilityKey>(initialVisibility);
  const [rating, setRating] = useState<string>(initialRating);
  const [shopInput, setShopInput] = useState(initialShop);
  const [debouncedShop, setDebouncedShop] = useState(initialShop);
  const [spuInput, setSpuInput] = useState(initialSpu);
  const [debouncedSpu, setDebouncedSpu] = useState(initialSpu);
  const [keywordInput, setKeywordInput] = useState(initialKeyword);
  const [debouncedKeyword, setDebouncedKeyword] = useState(initialKeyword);
  const [page, setPage] = useState(initialPage);

  // 输入去抖 300ms
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedShop(shopInput.trim());
      setDebouncedSpu(spuInput.trim());
      setDebouncedKeyword(keywordInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [shopInput, spuInput, keywordInput]);

  // URL 同步
  useEffect(() => {
    const params = new URLSearchParams();
    if (visibility !== "all") params.set("visibility", visibility);
    if (rating) params.set("rating", rating);
    if (debouncedShop) params.set("shop_id", debouncedShop);
    if (debouncedSpu) params.set("spu_id", debouncedSpu);
    if (debouncedKeyword) params.set("keyword", debouncedKeyword);
    if (page !== 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [
    visibility,
    rating,
    debouncedShop,
    debouncedSpu,
    debouncedKeyword,
    page,
    router,
  ]);

  const query = useMemo(
    () => ({
      visible:
        visibility === "all"
          ? undefined
          : visibility === "visible",
      rating: rating || undefined,
      shop_id: debouncedShop || undefined,
      spu_id: debouncedSpu || undefined,
      keyword: debouncedKeyword || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [visibility, rating, debouncedShop, debouncedSpu, debouncedKeyword, page],
  );

  const { data, isLoading, isFetching, isError, refetch } =
    useAdminReviews(query);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  // Hide modal 状态
  const [hideTarget, setHideTarget] = useState<AdminReviewListItem | null>(
    null,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "reviews-list"] });
  };

  const hideMutation = useMutation({
    mutationFn: (payload: { id: number; body: HideReviewPayload }) =>
      hideReview(payload.id, payload.body),
    onSuccess: () => {
      setHideTarget(null);
      toast.push({ type: "success", message: "已隐藏评价" });
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

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreReview(id),
    onSuccess: () => {
      toast.push({ type: "success", message: "已恢复显示" });
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

  const handleRestore = (row: AdminReviewListItem) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确认恢复评价 #${row.id} 的显示？此操作会重新计入店铺评分。`,
      )
    ) {
      return;
    }
    restoreMutation.mutate(row.id);
  };

  const columns: TableColumn<AdminReviewListItem>[] = [
    {
      key: "content",
      title: "评价摘要",
      render: (row) => (
        <div className="flex min-w-0 items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(row.spu?.main_image ?? null)}
            alt="商品图"
            className="h-10 w-10 shrink-0 rounded object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = imagePlaceholder();
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2">
              <StarRating rating={row.rating} size="sm" />
              <Link
                href={`/console/reviews/${row.id}`}
                className="text-[11px] text-[color:var(--color-info)] hover:underline"
              >
                评价 #{row.id}
              </Link>
              {row.images.length > 0 ? (
                <span className="text-[10px] text-neutral-400">
                  含 {row.images.length} 图
                </span>
              ) : null}
            </div>
            <p className="line-clamp-2 whitespace-pre-wrap text-xs text-neutral-700">
              {row.content}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "user",
      title: "用户",
      width: 160,
      render: (row) => (
        <div className="text-xs text-neutral-700">
          <div>
            {row.user?.nickname || (
              <span className="text-neutral-400">—</span>
            )}
            <span className="ml-1 text-neutral-400">#{row.user_id}</span>
            {row.is_anonymous ? (
              <span className="ml-1 text-[10px] text-neutral-400">
                （匿名）
              </span>
            ) : null}
          </div>
          {row.user?.phone ? (
            <div className="tabular-nums text-neutral-500">
              {row.user.phone}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "shop",
      title: "店铺 / 商品",
      render: (row) => (
        <div className="text-xs">
          <div className="text-neutral-800">
            {row.shop?.name ?? `店铺 #${row.shop_id}`}
          </div>
          <div className="mt-0.5 truncate text-neutral-500">
            {row.spu?.title ?? `SPU #${row.spu_id}`}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      title: "状态",
      width: 100,
      render: (row) =>
        row.visible ? (
          <Badge tone="success">显示中</Badge>
        ) : (
          <Badge tone="danger">已隐藏</Badge>
        ),
    },
    {
      key: "created_at",
      title: "发表时间",
      width: 140,
      render: (row) => (
        <span className="text-xs text-neutral-500 tabular-nums">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      title: "操作",
      align: "right",
      width: 160,
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/console/reviews/${row.id}`}
            className="text-xs text-[color:var(--color-info)] hover:underline"
          >
            查看
          </Link>
          {row.visible ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => setHideTarget(row)}
            >
              隐藏
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleRestore(row)}
              loading={
                restoreMutation.isPending &&
                restoreMutation.variables === row.id
              }
            >
              恢复
            </Button>
          )}
        </div>
      ),
    },
  ];

  const hasAnyFilter =
    visibility !== "all" ||
    rating !== "" ||
    debouncedShop !== "" ||
    debouncedSpu !== "" ||
    debouncedKeyword !== "";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            评价审核大盘
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            全站评价查看与隐藏/恢复。隐藏操作会同事务更新店铺评分冗余字段并通知作者。
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

      {/* 可见性 tab */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[color:var(--color-border)]">
        {(
          [
            { key: "all", label: "全部" },
            { key: "visible", label: "显示中" },
            { key: "hidden", label: "已隐藏" },
          ] as { key: VisibilityKey; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setVisibility(tab.key);
              setPage(1);
            }}
            className={clsx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition",
              visibility === tab.key
                ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)] font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-800",
            )}
            aria-current={visibility === tab.key ? "page" : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 筛选区 */}
      <div className="rounded-md border border-[color:var(--color-border)] bg-white p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FormField label="关键字（评价内容）">
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="包含的关键字"
              aria-label="评价关键字"
            />
          </FormField>
          <FormField label="星级">
            <select
              value={rating}
              onChange={(e) => {
                setRating(e.target.value);
                setPage(1);
              }}
              className="block h-8 w-full rounded border border-[color:var(--color-border)] bg-white px-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]/20"
              aria-label="星级筛选"
            >
              <option value="">全部</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={String(r)}>
                  {r} 星
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="店铺 ID">
            <Input
              value={shopInput}
              onChange={(e) => setShopInput(e.target.value.replace(/\D/g, ""))}
              placeholder="例如 12"
              inputMode="numeric"
              aria-label="店铺 ID"
            />
          </FormField>
          <FormField label="商品 SPU ID">
            <Input
              value={spuInput}
              onChange={(e) => setSpuInput(e.target.value.replace(/\D/g, ""))}
              placeholder="例如 5001"
              inputMode="numeric"
              aria-label="商品 SPU ID"
            />
          </FormField>
          <div className="flex items-end justify-end">
            {hasAnyFilter ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setVisibility("all");
                  setRating("");
                  setShopInput("");
                  setSpuInput("");
                  setKeywordInput("");
                  setPage(1);
                }}
              >
                清空所有筛选
              </Button>
            ) : null}
          </div>
        </div>
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
        emptyText="暂无符合条件的评价"
        pagination={{
          page,
          size: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />

      {/* Hide Modal */}
      <HideReviewModal
        open={hideTarget !== null}
        onClose={() => setHideTarget(null)}
        onSubmit={(payload) => {
          if (!hideTarget) return;
          hideMutation.mutate({ id: hideTarget.id, body: payload });
        }}
        submitting={hideMutation.isPending}
        reviewSummary={
          hideTarget
            ? `评价 #${hideTarget.id} · ${hideTarget.rating} 星 · ${
                hideTarget.spu?.title ?? `SPU #${hideTarget.spu_id}`
              }`
            : undefined
        }
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
