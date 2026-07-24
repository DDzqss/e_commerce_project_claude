"use client";

/**
 * 商家 · 评价管理页（Phase 5 §5.3）。
 *
 * 布局：
 *   1. 顶部：评分汇总（RatingSummary）+ 4 张统计卡（总数 / 未回复 / 平均 / 差评）
 *   2. 筛选栏：星级 quick filter / 是否回复 / 关键字
 *   3. 卡片列表（ReviewCard），未回复优先（默认 has_reply=false 展示）
 *   4. 分页
 *
 * 权限：
 *   - SHOP_OWNER / SHOP_OPERATOR 可回复；SHOP_SUPPORT 只读
 */

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RatingSummary } from "@/components/ui/RatingSummary";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { StarRating } from "@/components/ui/StarRating";
import { cn } from "@/lib/cn";
import {
  createReply,
  deleteReply,
  updateReply,
} from "@/lib/review-api";
import {
  MERCHANT_REVIEWS_QUERY_KEY,
  MERCHANT_REVIEW_STATS_KEY,
  useMerchantReviews,
  useMerchantReviewStats,
} from "@/hooks/useMerchantReviews";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/types/errors";

type HasReplyFilter = "" | "false" | "true";

const PAGE_SIZE = 10;

export default function ReviewsPage() {
  const { merchantAccount } = useAuth();
  const canReply =
    merchantAccount?.role === "SHOP_OWNER" ||
    merchantAccount?.role === "SHOP_OPERATOR";

  const [rating, setRating] = useState<number>(0);
  const [hasReplyFilter, setHasReplyFilter] = useState<HasReplyFilter>("false");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => ({
      rating: rating > 0 ? rating : undefined,
      has_reply:
        hasReplyFilter === ""
          ? undefined
          : hasReplyFilter === "true",
      keyword: keyword || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [rating, hasReplyFilter, keyword, page],
  );

  const listQuery = useMerchantReviews(query);
  const statsQuery = useMerchantReviewStats();
  const stats = statsQuery.data;

  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: MERCHANT_REVIEWS_QUERY_KEY,
    });
    void queryClient.invalidateQueries({ queryKey: MERCHANT_REVIEW_STATS_KEY });
  };

  const createMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      createReply(id, { content }),
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      updateReply(id, { content }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => deleteReply(id),
    onSuccess: invalidate,
  });

  const totalPages = useMemo(
    () =>
      listQuery.data
        ? Math.max(
            1,
            Math.ceil(listQuery.data.total / (listQuery.data.size || PAGE_SIZE)),
          )
        : 1,
    [listQuery.data],
  );

  const onSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const doCreate = async (id: number, content: string) => {
    try {
      await createMutation.mutateAsync({ id, content });
    } catch (err) {
      if (err instanceof ApiError) throw new Error(err.toUserMessage());
      throw err;
    }
  };
  const doUpdate = async (id: number, content: string) => {
    try {
      await updateMutation.mutateAsync({ id, content });
    } catch (err) {
      if (err instanceof ApiError) throw new Error(err.toUserMessage());
      throw err;
    }
  };
  const doDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
    } catch (err) {
      if (err instanceof ApiError) throw new Error(err.toUserMessage());
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-neutral-900">评价管理</h2>
        <p className="mt-1 text-sm text-neutral-500">
          回复评价、关注差评。默认展示未回复的评价，请及时处理以提升店铺口碑。
        </p>
      </header>

      {/* 顶部统计 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="评价总数"
          value={stats?.total_count ?? (statsQuery.isLoading ? "…" : "—")}
          hint="所有可见评价累计"
          tone="primary"
        />
        <StatCard
          label="未回复"
          value={stats?.unreplied_count ?? (statsQuery.isLoading ? "…" : "—")}
          hint="尽快回复以提升信任"
          tone={stats && stats.unreplied_count > 0 ? "warning" : "info"}
        />
        <StatCard
          label="平均分"
          value={
            stats
              ? stats.avg_rating.toFixed(2)
              : statsQuery.isLoading
                ? "…"
                : "—"
          }
          hint="近 100 条评价均分"
          tone="success"
        />
        <StatCard
          label="差评（≤ 3 星）"
          value={stats?.low_rating_count ?? (statsQuery.isLoading ? "…" : "—")}
          hint="重点关注并回复"
          tone="danger"
        />
      </div>

      {stats ? (
        <RatingSummary
          avgRating={stats.avg_rating}
          totalCount={stats.total_count}
          distribution={stats.rating_distribution}
        />
      ) : null}

      {/* 筛选 */}
      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-neutral-600">星级：</span>
            <button
              type="button"
              onClick={() => {
                setRating(0);
                setPage(1);
              }}
              className={cn(
                "rounded px-2 py-0.5 text-xs",
                rating === 0
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
              )}
            >
              全部
            </button>
            {[5, 4, 3, 2, 1].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setRating(n);
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 text-xs",
                  rating === n
                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                )}
              >
                <StarRating value={1} max={1} sizeClass="text-xs" />
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-neutral-600">回复：</span>
            {(
              [
                { key: "" as HasReplyFilter, label: "全部" },
                { key: "false" as HasReplyFilter, label: "未回复" },
                { key: "true" as HasReplyFilter, label: "已回复" },
              ]
            ).map((op) => (
              <button
                key={op.label}
                type="button"
                onClick={() => {
                  setHasReplyFilter(op.key);
                  setPage(1);
                }}
                className={cn(
                  "rounded px-2 py-0.5 text-xs",
                  hasReplyFilter === op.key
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                )}
              >
                {op.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Input
              placeholder="关键字（内容 / 商品）"
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
            {rating > 0 || hasReplyFilter !== "false" || keyword ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setRating(0);
                  setHasReplyFilter("false");
                  setKeywordInput("");
                  setKeyword("");
                  setPage(1);
                }}
              >
                重置
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {/* 列表 */}
      {listQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          评价列表加载失败。
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => listQuery.refetch()}
          >
            重试
          </button>
        </div>
      ) : !listQuery.data || listQuery.data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-16 text-center text-sm text-neutral-500">
          <div className="text-3xl">🎉</div>
          <div className="mt-2">当前筛选条件下没有评价</div>
        </div>
      ) : (
        <div className="space-y-4">
          {listQuery.data.items.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onCreateReply={doCreate}
              onUpdateReply={doUpdate}
              onDeleteReply={doDelete}
              canReply={canReply}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {listQuery.data && listQuery.data.total > 0 ? (
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <div>
            共 {listQuery.data.total} 条 · 第 {page} / {totalPages} 页
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
