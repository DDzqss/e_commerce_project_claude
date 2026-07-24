"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toast";
import {
  ReviewForm,
  type ReviewFormValue,
} from "@/components/reviews/ReviewForm";
import { useOrder } from "@/hooks/useOrders";
import { useCreateReviews } from "@/hooks/useReviews";
import { ApiError } from "@/lib/api";
import { messageForCode } from "@/types/errors";
import {
  clearIdempotencyKey,
  getOrCreateIdempotencyKey,
} from "@/lib/idempotency";
import { OrderStatus } from "@/types/order";
import type {
  CreateReviewItemPayload,
  CreateReviewsPayload,
} from "@/types/review";

const MIN_CONTENT = 5;
const MAX_CONTENT = 2000;
const MAX_IMAGES = 6;

/**
 * 从"我的订单"发起批量评价页 `/orders/{orderNo}/reviews/new`。
 *
 * - 展示订单下所有商品项
 * - 每项一个 ReviewForm；"跳过"复选框控制是否提交
 * - 提交时把已勾选（未跳过）+ 通过校验的项作为 items 数组发出
 */
export default function WriteReviewsPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <WriteReviewsContent />
      </div>
    </RequireAuth>
  );
}

interface ItemState {
  order_item_id: number;
  spu_id: number;
  skip: boolean;
  form: ReviewFormValue;
  contentError: string | null;
  ratingError: string | null;
}

function WriteReviewsContent() {
  const params = useParams<{ orderNo: string }>();
  const router = useRouter();
  const orderNo = params.orderNo;
  const { data, isLoading, isError, refetch } = useOrder(orderNo);
  const createMutation = useCreateReviews();

  const [items, setItems] = useState<ItemState[]>([]);
  const [initialized, setInitialized] = useState(false);

  // 首次填充。用 useMemo 触发一次 setItems（依赖 order 数据）
  useMemo(() => {
    if (!data || initialized) return;
    setItems(
      data.items.map((it) => ({
        order_item_id: it.id,
        spu_id: it.spu_id,
        skip: false,
        form: {
          rating: 5,
          content: "",
          images: [],
          is_anonymous: false,
        },
        contentError: null,
        ratingError: null,
      })),
    );
    setInitialized(true);
  }, [data, initialized]);

  const canReview =
    data?.status === OrderStatus.Completed || data?.status === OrderStatus.Shipped;

  const updateItem = (idx: number, patch: Partial<ItemState>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  };

  const submit = async () => {
    if (!data) return;
    // 校验 & 收集
    const targets: CreateReviewItemPayload[] = [];
    let hasError = false;
    const next = items.map((it) => {
      if (it.skip) return { ...it, contentError: null, ratingError: null };
      const errors = { contentError: null as string | null, ratingError: null as string | null };
      const content = it.form.content.trim();
      if (it.form.rating < 1 || it.form.rating > 5) {
        errors.ratingError = "请选择 1-5 星";
      }
      if (content.length < MIN_CONTENT) {
        errors.contentError = `评价内容至少 ${MIN_CONTENT} 字`;
      } else if (content.length > MAX_CONTENT) {
        errors.contentError = `评价内容最多 ${MAX_CONTENT} 字`;
      }
      const stillUploading = it.form.images.some((im) => im.uploading);
      if (stillUploading) {
        errors.contentError = errors.contentError ?? "图片仍在上传，请稍候";
      }
      if (errors.contentError || errors.ratingError) {
        hasError = true;
      } else {
        targets.push({
          order_item_id: it.order_item_id,
          rating: it.form.rating,
          content,
          images: it.form.images.map((im) => im.object_key).filter(Boolean),
          is_anonymous: it.form.is_anonymous,
        });
      }
      return { ...it, ...errors };
    });
    setItems(next);
    if (hasError) {
      toast.error("请检查评价内容");
      return;
    }
    if (targets.length === 0) {
      toast.error("请至少填写一件商品的评价");
      return;
    }

    const scope = `create-reviews:${orderNo}`;
    const key = getOrCreateIdempotencyKey(scope);
    try {
      const payload: CreateReviewsPayload = { reviews: targets };
      await createMutation.mutateAsync({
        orderIdOrNo: orderNo,
        payload,
        idempotencyKey: key,
      });
      clearIdempotencyKey(scope);
      toast.success("评价已提交");
      router.push("/reviews");
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "评价提交失败";
      toast.error(msg);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-6 pb-24">
      <h1 className="mb-3 text-2xl font-semibold text-neutral-900">发表评价</h1>
      <p className="mb-4 text-xs text-neutral-500">
        订单 {orderNo}
        {data && (
          <>
            {" · "}
            <Link
              href={`/orders/${orderNo}`}
              className="text-[color:var(--color-primary)] hover:underline"
            >
              查看订单
            </Link>
          </>
        )}
      </p>

      {isLoading && <Skeleton className="h-40 w-full" />}
      {isError && (
        <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
          加载订单失败，
          <button
            type="button"
            className="ml-1 underline"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      )}

      {data && !canReview && (
        <EmptyState
          title="订单当前状态不可评价"
          description="仅已完成订单支持评价"
          action={
            <Link href={`/orders/${orderNo}`}>
              <Button variant="secondary">返回订单</Button>
            </Link>
          }
        />
      )}

      {data && canReview && items.length === 0 && (
        <EmptyState title="订单没有可评价的商品" />
      )}

      {data && canReview && items.length > 0 && (
        <ul className="flex flex-col gap-4">
          {data.items.map((it, idx) => {
            const state = items[idx];
            if (!state) return null;
            return (
              <li
                key={it.id}
                className="rounded-lg border border-neutral-200 bg-white p-4"
                data-testid={`review-item-${it.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-50">
                    <ImageWithFallback
                      objectKey={it.sku_image}
                      alt={it.spu_title}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${it.spu_id}`}
                      className="line-clamp-2 text-sm text-neutral-900 hover:text-[color:var(--color-primary)]"
                    >
                      {it.spu_title}
                    </Link>
                    {Object.values(it.sku_specs ?? {}).length > 0 && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {Object.values(it.sku_specs).join(" / ")}
                      </p>
                    )}
                  </div>
                  <label className="ml-2 shrink-0 text-xs text-neutral-500">
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={state.skip}
                      onChange={(e) =>
                        updateItem(idx, { skip: e.target.checked })
                      }
                      data-testid={`review-skip-${it.id}`}
                    />
                    跳过此项
                  </label>
                </div>

                {!state.skip && (
                  <div className="mt-4">
                    <ReviewForm
                      value={state.form}
                      onChange={(v) => updateItem(idx, { form: v })}
                      contentError={state.contentError}
                      ratingError={state.ratingError}
                      maxImages={MAX_IMAGES}
                      minContent={MIN_CONTENT}
                      maxContent={MAX_CONTENT}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data && canReview && items.length > 0 && (
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => router.push(`/orders/${orderNo}`)}
          >
            返回订单
          </Button>
          <Button
            onClick={submit}
            loading={createMutation.isPending}
            data-testid="submit-reviews-btn"
          >
            提交评价
          </Button>
        </div>
      )}
    </main>
  );
}
