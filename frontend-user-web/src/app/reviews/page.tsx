"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toast";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { Pagination } from "@/components/catalog/Pagination";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import {
  ReviewForm,
  type ReviewFormValue,
} from "@/components/reviews/ReviewForm";
import {
  useDeleteReview,
  useEditReview,
  useMyReviews,
} from "@/hooks/useReviews";
import { ApiError } from "@/lib/api";
import { messageForCode } from "@/types/errors";
import { canEditReview, type ReviewOut } from "@/types/review";

const PAGE_SIZE = 10;

export default function MyReviewsPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <Suspense
          fallback={
            <main className="mx-auto max-w-3xl px-6 py-6">
              <Skeleton className="h-40 w-full" />
            </main>
          }
        >
          <MyReviewsContent />
        </Suspense>
      </div>
    </RequireAuth>
  );
}

function MyReviewsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = Number(searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const query = useMemo(
    () => ({ page, size: PAGE_SIZE }),
    [page],
  );
  const { data, isLoading, isError, refetch } = useMyReviews(query);
  const deleteMutation = useDeleteReview();

  const [editing, setEditing] = useState<ReviewOut | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<ReviewOut | null>(null);

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/reviews?${params.toString()}`);
  };

  const onConfirmDelete = async () => {
    if (!deletingTarget) return;
    try {
      await deleteMutation.mutateAsync({ id: deletingTarget.id });
      toast.success("评价已删除");
      setDeletingTarget(null);
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "删除失败";
      toast.error(msg);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-6 pb-16">
      <h1 className="mb-4 text-2xl font-semibold text-neutral-900">我的评价</h1>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
          加载失败，
          <button
            type="button"
            className="ml-1 underline"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          title="还没有评价"
          description="完成订单后可以对商品发表评价"
          action={
            <Link href="/orders?status=completed">
              <Button variant="secondary">去评价订单</Button>
            </Link>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.items.map((r) => (
            <li key={r.id}>
              <div className="rounded-lg border border-neutral-200 bg-white p-4">
                {/* 商品快照 */}
                {r.spu && (
                  <Link
                    href={`/products/${r.spu.id}`}
                    className="mb-3 flex items-center gap-3 rounded-md bg-neutral-50 p-2 hover:bg-neutral-100"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-neutral-200 bg-white">
                      <ImageWithFallback
                        objectKey={r.spu.main_image}
                        alt={r.spu.title}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm text-neutral-800">
                        {r.spu.title}
                      </p>
                    </div>
                  </Link>
                )}
                <ReviewCard
                  review={r}
                  canReport={false}
                  rightActions={
                    <div className="flex items-center gap-2 text-xs">
                      {canEditReview(r) && (
                        <button
                          type="button"
                          onClick={() => setEditing(r)}
                          className="text-neutral-500 hover:text-[color:var(--color-primary)]"
                          data-testid={`review-edit-${r.id}`}
                        >
                          编辑
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeletingTarget(r)}
                        className="text-neutral-500 hover:text-[color:var(--color-primary)]"
                        data-testid={`review-delete-${r.id}`}
                      >
                        删除
                      </button>
                    </div>
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="mt-6">
          <Pagination
            page={data.page}
            size={data.size}
            total={data.total}
            onChange={setPage}
          />
        </div>
      )}

      {editing && (
        <EditReviewModal
          review={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => setEditing(null)}
        />
      )}

      <ConfirmModal
        open={Boolean(deletingTarget)}
        title="确认删除该评价？"
        description="删除后不可恢复。"
        danger
        loading={deleteMutation.isPending}
        onConfirm={onConfirmDelete}
        onCancel={() => setDeletingTarget(null)}
      />
    </main>
  );
}

function EditReviewModal({
  review,
  onClose,
  onSuccess,
}: {
  review: ReviewOut;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const editMutation = useEditReview();
  const [value, setValue] = useState<ReviewFormValue>({
    rating: review.rating,
    content: review.content,
    is_anonymous: review.is_anonymous,
    images: review.images.map((k) => ({
      object_key: k,
      preview_url: null,
    })),
  });

  const submit = async () => {
    const content = value.content.trim();
    if (value.rating < 1 || value.rating > 5) {
      toast.error("请选择 1-5 星");
      return;
    }
    if (content.length < 5) {
      toast.error("评价内容至少 5 字");
      return;
    }
    if (content.length > 2000) {
      toast.error("评价内容最多 2000 字");
      return;
    }
    if (value.images.some((im) => im.uploading)) {
      toast.error("图片仍在上传，请稍候");
      return;
    }
    try {
      await editMutation.mutateAsync({
        id: review.id,
        payload: {
          rating: value.rating,
          content,
          images: value.images.map((im) => im.object_key).filter(Boolean),
          is_anonymous: value.is_anonymous,
        },
      });
      toast.success("评价已更新");
      onSuccess();
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "保存失败";
      toast.error(msg);
    }
  };

  return (
    <Modal
      open
      title="编辑评价"
      onClose={onClose}
      className="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} loading={editMutation.isPending}>
            保存
          </Button>
        </>
      }
    >
      <ReviewForm value={value} onChange={setValue} />
      <p className="mt-2 text-xs text-neutral-400">
        本次编辑后不可再编辑；请谨慎修改。
      </p>
    </Modal>
  );
}
