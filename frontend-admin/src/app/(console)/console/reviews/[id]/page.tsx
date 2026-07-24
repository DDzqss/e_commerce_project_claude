"use client";

/**
 * 平台评价审核详情 (`/console/reviews/[id]`)。
 *
 * 契约 §5.4 GET /admin/reviews/{id} 详情（含 order 摘要 + reply）
 *
 * UI 要素：
 * - 完整内容 + 图片画廊 + 关联订单跳转链接 + merchant reply
 * - 操作按钮：hide / restore
 * - 隐藏原因、隐藏人、隐藏时间（若已隐藏）
 * - 编辑窗口 edit_deadline_at / edit_count
 *
 * 权限：admin:review:moderate（读 + 写共用同一权限）
 */

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StarRating } from "@/components/ui/StarRating";
import { useToast } from "@/components/ui/Toast";
import { HideReviewModal } from "@/components/reviews/HideReviewModal";
import { AdminReviewCard } from "@/components/reviews/AdminReviewCard";
import { useAdminReview } from "@/hooks/useAdminReviews";
import { hideReview, restoreReview } from "@/lib/review-api";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/types/errors";
import type { HideReviewPayload } from "@/types/review";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminReviewDetailPage(props: PageProps) {
  const { id } = use(props.params);
  return (
    <RequirePermission permission="admin:review:moderate">
      <AdminReviewDetailInner id={id} />
    </RequirePermission>
  );
}

function AdminReviewDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useAdminReview(id);

  const [hideOpen, setHideOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["admin", "review", String(id)],
    });
    queryClient.invalidateQueries({ queryKey: ["admin", "reviews-list"] });
  };

  const hideMutation = useMutation({
    mutationFn: (payload: HideReviewPayload) => hideReview(id, payload),
    onSuccess: () => {
      setHideOpen(false);
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
    mutationFn: () => restoreReview(id),
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

  const handleRestore = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确认恢复评价显示？此操作会重新计入店铺评分。")
    ) {
      return;
    }
    restoreMutation.mutate();
  };

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="rounded border border-red-200 bg-[color:var(--color-danger-soft)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
        {error instanceof ApiError
          ? getErrorMessage(error.code, error.message)
          : "评价详情加载失败"}
        <div className="mt-2">
          <Link
            href="/console/reviews"
            className="text-[color:var(--color-info)] hover:underline"
          >
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  const review = data;
  const isHidden = !review.visible;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-2 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
          >
            ← 返回
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-neutral-900">
              评价 #{review.id}
            </h1>
            <StarRating rating={review.rating} showValue />
            {isHidden ? (
              <Badge tone="danger">已隐藏</Badge>
            ) : (
              <Badge tone="success">显示中</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            发表于 {formatDateTime(review.created_at)} · SPU #{review.spu_id} ·
            SKU #{review.sku_id}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isHidden ? (
            <Button
              variant="secondary"
              onClick={handleRestore}
              loading={restoreMutation.isPending}
            >
              恢复显示
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setHideOpen(true)}>
              隐藏评价
            </Button>
          )}
        </div>
      </div>

      {/* 评价卡片（复用 AdminReviewCard，禁用 modal 内按钮，只展示） */}
      <AdminReviewCard review={review} canModerate={false} />

      {/* 关联订单 */}
      <section className="rounded-md border border-[color:var(--color-border)] bg-white">
        <header className="border-b border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-neutral-800">
          关联订单
        </header>
        <div className="flex items-center justify-between p-4 text-sm">
          {review.order ? (
            <>
              <div>
                <div className="font-mono text-neutral-900">
                  {review.order.order_no}
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  订单 #{review.order.id} · 状态 {review.order.status ?? "—"}
                </div>
              </div>
              <Link
                href={`/console/orders/${review.order.order_no}`}
                className="text-[color:var(--color-info)] hover:underline"
              >
                查看订单详情 →
              </Link>
            </>
          ) : (
            <div className="text-xs text-neutral-500">
              订单 #{review.order_id} · 后端未附带订单摘要{" "}
              <Link
                href={`/console/orders`}
                className="ml-2 text-[color:var(--color-info)] hover:underline"
              >
                前往订单管理搜索
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Merchant Reply */}
      <section className="rounded-md border border-[color:var(--color-border)] bg-white">
        <header className="border-b border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-neutral-800">
          商家回复
        </header>
        {review.reply ? (
          <div className="p-4 text-sm">
            <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
              <span>店铺 #{review.reply.shop_id}</span>
              <span className="tabular-nums">
                {formatDateTime(review.reply.created_at)}
              </span>
              {review.reply.updated_at !== review.reply.created_at ? (
                <span className="tabular-nums">
                  · 更新于 {formatDateTime(review.reply.updated_at)}
                </span>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-neutral-800">
              {review.reply.content}
            </p>
          </div>
        ) : (
          <div className="p-4 text-sm text-neutral-400">商家尚未回复</div>
        )}
      </section>

      {/* 隐藏详情 */}
      {isHidden ? (
        <section className="rounded-md border border-red-200 bg-[color:var(--color-danger-soft)]/40">
          <header className="border-b border-red-200 px-4 py-3 text-sm font-semibold text-[color:var(--color-danger)]">
            隐藏记录
          </header>
          <dl className="grid grid-cols-1 gap-y-2 gap-x-6 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-neutral-500">隐藏时间</dt>
              <dd className="mt-0.5 text-neutral-800 tabular-nums">
                {formatDateTime(review.hidden_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">操作管理员</dt>
              <dd className="mt-0.5 text-neutral-800">
                {review.hidden_by_admin_id
                  ? `#${review.hidden_by_admin_id}`
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-neutral-500">隐藏原因</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-neutral-800">
                {review.hidden_reason ?? "—"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {/* Hide Modal */}
      <HideReviewModal
        open={hideOpen}
        onClose={() => setHideOpen(false)}
        onSubmit={(payload) => hideMutation.mutate(payload)}
        submitting={hideMutation.isPending}
        reviewSummary={`评价 #${review.id} · ${review.rating} 星 · ${
          review.spu?.title ?? `SPU #${review.spu_id}`
        }`}
      />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
