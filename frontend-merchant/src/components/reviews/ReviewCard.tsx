"use client";

/**
 * ReviewCard —— 单条评价卡片（评价管理页列表项）。
 *
 * 展示：
 *   - 顶部：用户展示名 + 时间 + 星级 + 匿名标记 + 隐藏（灰）标签
 *   - 中部：评价内容 + 图片九宫格（点击放大简化：新窗打开）
 *   - 底部：关联商品（图 + 标题 + SKU 规格）+ 订单号跳转
 *   - 内联：ReplyEditor（回复 / 编辑 / 删除）
 */

import Link from "next/link";

import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/image";
import { StarRating } from "@/components/ui/StarRating";
import { ReplyEditor } from "./ReplyEditor";
import type { MerchantReviewOut } from "@/types/review";

export interface ReviewCardProps {
  review: MerchantReviewOut;
  onCreateReply: (reviewId: number, content: string) => Promise<void>;
  onUpdateReply: (reviewId: number, content: string) => Promise<void>;
  onDeleteReply: (reviewId: number) => Promise<void>;
  /** SHOP_OWNER / SHOP_OPERATOR 可写；SHOP_SUPPORT 只读。 */
  canReply: boolean;
}

export function ReviewCard({
  review,
  onCreateReply,
  onUpdateReply,
  onDeleteReply,
  canReply,
}: ReviewCardProps) {
  const specText = review.sku_specs
    ? Object.entries(review.sku_specs)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" / ")
    : "";

  return (
    <article
      className={cn(
        "rounded-lg border border-neutral-200 bg-white p-4",
        !review.visible && "opacity-70",
      )}
    >
      {/* 顶部：用户信息 + 星级 + 时间 */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600"
            aria-hidden
          >
            {(review.user_display_name || "?").slice(0, 1)}
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
              {review.user_display_name}
              {review.is_anonymous ? (
                <span className="rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-500">
                  匿名
                </span>
              ) : null}
              {!review.visible ? (
                <span
                  className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700"
                  title={review.hidden_reason ?? undefined}
                >
                  已被平台隐藏
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">
              {new Date(review.created_at).toLocaleString("zh-CN")}
            </div>
          </div>
        </div>
        <StarRating value={review.rating} sizeClass="text-lg" />
      </header>

      {/* 评价内容 */}
      <p className="mt-3 whitespace-pre-line text-sm text-neutral-800">
        {review.content}
      </p>

      {/* 图片九宫格 */}
      {review.images.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.images.map((img) => (
            <a
              key={img}
              href={imageUrl(img)}
              target="_blank"
              rel="noreferrer noopener"
              className="block h-16 w-16 overflow-hidden rounded border border-neutral-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(img)}
                alt="评价图"
                className="h-full w-full object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}

      {/* 关联商品 + 订单号 */}
      <div className="mt-3 flex items-center gap-3 rounded-md border border-neutral-100 bg-neutral-50 p-2 text-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(review.sku_image)}
          alt=""
          className="h-10 w-10 rounded object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-neutral-800">{review.spu_title}</div>
          {specText ? (
            <div className="mt-0.5 truncate text-neutral-500">{specText}</div>
          ) : null}
        </div>
        <Link
          href={`/orders/${review.order_no}`}
          className="shrink-0 text-neutral-500 hover:text-[var(--color-primary)] hover:underline"
        >
          订单 {review.order_no}
        </Link>
      </div>

      {/* 回复区 */}
      <ReplyEditor
        reviewId={review.id}
        reply={review.reply}
        onCreate={onCreateReply}
        onUpdate={onUpdateReply}
        onDelete={onDeleteReply}
        canWrite={canReply && review.visible}
      />
    </article>
  );
}
