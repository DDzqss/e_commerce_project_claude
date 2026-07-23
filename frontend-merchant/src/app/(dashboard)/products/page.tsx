"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { toast } from "@/components/ui/Toast";
import { useMySPUs, MY_SPUS_QUERY_KEY } from "@/hooks/useMySPUs";
import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/image";
import { deleteSPU } from "@/lib/product-api";
import { centsToYuanString } from "@/components/ui/PriceInput";
import { ApiError } from "@/types/errors";
import type { SPUListItemOut, SPUStatus } from "@/types/api";

/** 顶部 tab 定义。空字符串表示全部。 */
const STATUS_TABS: Array<{ key: SPUStatus | ""; label: string }> = [
  { key: "", label: "全部" },
  { key: "draft", label: "草稿" },
  { key: "pending_review", label: "审核中" },
  { key: "approved", label: "已上架" },
  { key: "off_shelf", label: "已下架" },
  { key: "rejected", label: "已驳回" },
];

const PAGE_SIZE = 20;

export default function ProductsListPage() {
  const [status, setStatus] = useState<SPUStatus | "">("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<SPUListItemOut | null>(
    null,
  );

  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useMySPUs({
    status,
    keyword,
    page,
    size: PAGE_SIZE,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSPU(id),
    onSuccess: () => {
      toast.success("商品已删除");
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: MY_SPUS_QUERY_KEY });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? err.toUserMessage() : "删除失败，请稍后重试";
      toast.error(msg);
    },
  });

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / (data.size || PAGE_SIZE))) : 1),
    [data],
  );

  const onSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">商品管理</h2>
          <p className="mt-1 text-sm text-neutral-500">
            维护本店铺的商品：新建、编辑、提审、上下架与库存调整
          </p>
        </div>
        <Link href="/products/new">
          <Button variant="primary">＋ 新建商品</Button>
        </Link>
      </header>

      {/* Status Tabs */}
      <div className="border-b border-neutral-200">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="商品状态筛选">
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

      {/* Search Bar */}
      <div className="flex gap-2">
        <Input
          placeholder="搜索商品标题 / 副标题"
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
        {keyword ? (
          <Button
            variant="ghost"
            onClick={() => {
              setKeywordInput("");
              setKeyword("");
              setPage(1);
            }}
          >
            清空
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
            商品列表加载失败。
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
            <div className="text-3xl">🗂️</div>
            <div className="mt-2">暂无商品</div>
            <div className="mt-1 text-xs text-neutral-400">
              点击右上角「新建商品」开始上架
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="w-16 px-4 py-3">图</th>
                <th className="px-4 py-3">商品</th>
                <th className="w-24 px-4 py-3">状态</th>
                <th className="w-40 px-4 py-3">价格（元）</th>
                <th className="w-20 px-4 py-3">销量</th>
                <th className="w-40 px-4 py-3">更新时间</th>
                <th className="w-40 px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.items.map((spu) => (
                <ProductRow
                  key={spu.id}
                  spu={spu}
                  onDelete={setPendingDelete}
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

      {/* Delete confirm */}
      <Modal
        open={!!pendingDelete}
        onClose={() => {
          if (!deleteMutation.isPending) setPendingDelete(null);
        }}
        title="确认删除商品"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          确定要删除商品「{pendingDelete?.title}」吗？该操作为软删除，删除后无法在列表中查看。
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          注：仅 草稿 / 已下架 / 已驳回 状态支持删除；已上架商品请先下架。
        </p>
      </Modal>
    </div>
  );
}

function ProductRow({
  spu,
  onDelete,
}: {
  spu: SPUListItemOut;
  onDelete: (spu: SPUListItemOut) => void;
}) {
  const priceRange =
    spu.min_price_cents === spu.max_price_cents
      ? `¥${centsToYuanString(spu.min_price_cents)}`
      : `¥${centsToYuanString(spu.min_price_cents)} - ¥${centsToYuanString(spu.max_price_cents)}`;

  const canDelete =
    spu.status === "draft" ||
    spu.status === "off_shelf" ||
    spu.status === "rejected";

  return (
    <tr className="hover:bg-neutral-50/60">
      <td className="px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(spu.main_image)}
          alt={spu.title}
          className="h-10 w-10 rounded object-cover"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <Link
            href={`/products/${spu.id}`}
            className="line-clamp-1 text-sm font-medium text-neutral-900 hover:text-[var(--color-primary)]"
          >
            {spu.title}
          </Link>
          {spu.subtitle ? (
            <span className="mt-0.5 line-clamp-1 text-xs text-neutral-400">
              {spu.subtitle}
            </span>
          ) : null}
          {spu.review_note && spu.status === "rejected" ? (
            <span className="mt-1 text-xs text-red-600">
              驳回原因：{spu.review_note}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={spu.status} />
      </td>
      <td className="px-4 py-3 text-neutral-800">{priceRange}</td>
      <td className="px-4 py-3 text-neutral-600">{spu.sales_count}</td>
      <td className="px-4 py-3 text-xs text-neutral-500">
        {new Date(spu.updated_at).toLocaleString("zh-CN")}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <Link
            href={`/products/${spu.id}`}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            编辑
          </Link>
          <button
            type="button"
            disabled={!canDelete}
            title={canDelete ? "删除" : "已上架/审核中商品不可删除"}
            onClick={() => onDelete(spu)}
            className="text-sm text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-neutral-300 disabled:no-underline"
          >
            删除
          </button>
        </div>
      </td>
    </tr>
  );
}
