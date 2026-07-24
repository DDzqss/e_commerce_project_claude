"use client";

/**
 * Admin 评价卡片。
 *
 * 用于评价审核列表 / 详情页展示单条评价。管理员视角特殊之处：
 * - 用户信息显示明文（含手机号，业务需要）
 * - 匿名标记 `is_anonymous` 仅作视觉提示（"用户已设为匿名"），仍展示真实昵称
 * - 显示 visible / hidden 状态与 hidden_reason（如有）
 * - 提供"隐藏 / 恢复"按钮（受 canModerate 控制）
 *
 * 与用户端 / 商家端不同：
 * - 展示店铺 + 商品缩略图 + SKU 规格（跨店审核台需要）
 * - 显示评价编辑窗口 edit_deadline_at / edit_count 供审核参考
 */

import Link from "next/link";
import clsx from "clsx";
import type {
  AdminReviewListItem,
  AdminReviewDetail,
} from "@/types/review";
import { StarRating } from "@/components/ui/StarRating";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { imagePlaceholder, imageUrl } from "@/lib/image";

interface AdminReviewCardProps {
  review: AdminReviewListItem | AdminReviewDetail;
  /** 是否点击标题跳转至详情（列表用 true，详情自己就是详情不用跳） */
  linkToDetail?: boolean;
  /** 是否可执行隐藏 / 恢复；无权限时按钮不渲染 */
  canModerate?: boolean;
  onHide?: () => void;
  onRestore?: () => void;
  className?: string;
}

export function AdminReviewCard({
  review,
  linkToDetail = false,
  canModerate = false,
  onHide,
  onRestore,
  className,
}: AdminReviewCardProps) {
  const isHidden = !review.visible;
  const anon = review.is_anonymous;
  const nicknameText = review.user?.nickname ?? `用户 #${review.user_id}`;

  return (
    <article
      className={clsx(
        "flex flex-col gap-3 rounded-md border bg-white p-4 shadow-sm transition",
        isHidden
          ? "border-red-200 bg-[color:var(--color-danger-soft)]/40"
          : "border-[color:var(--color-border)]",
        className,
      )}
    >
      {/* 顶部：用户 + 星级 + 状态 */}
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <StarRating rating={review.rating} size="sm" />
          <span className="text-sm font-medium text-neutral-800">
            {nicknameText}
            {anon ? (
              <span className="ml-1 text-xs text-neutral-400">（已匿名）</span>
            ) : null}
          </span>
          <span className="text-xs text-neutral-400">#{review.user_id}</span>
          {review.user?.phone ? (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] tabular-nums text-neutral-600">
              {review.user.phone}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {isHidden ? (
            <Badge tone="danger">已隐藏</Badge>
          ) : (
            <Badge tone="success">显示中</Badge>
          )}
          {review.edit_count > 0 ? (
            <Badge tone="warning">已编辑 {review.edit_count} 次</Badge>
          ) : null}
        </div>
      </header>

      {/* 商品 + 店铺 */}
      <div className="flex items-center gap-3 rounded border border-[color:var(--color-border)] bg-neutral-50 p-2 text-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(review.spu?.main_image ?? review.sku?.image ?? null)}
          alt="商品图"
          className="h-12 w-12 shrink-0 rounded object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = imagePlaceholder();
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-neutral-800">
            {review.spu?.title ?? `SPU #${review.spu_id}`}
          </div>
          <div className="mt-0.5 text-neutral-500">
            店铺：
            <span className="text-neutral-700">
              {review.shop?.name ?? `#${review.shop_id}`}
            </span>
            <span className="ml-2 text-neutral-400">
              SPU #{review.spu_id} · SKU #{review.sku_id}
            </span>
          </div>
          {review.sku?.specs ? (
            <div className="mt-0.5 text-neutral-500">
              规格：
              {Object.entries(review.sku.specs)
                .map(([k, v]) => `${k}=${v}`)
                .join(" · ")}
            </div>
          ) : null}
        </div>
      </div>

      {/* 评价正文 */}
      <div>
        {linkToDetail ? (
          <Link
            href={`/console/reviews/${review.id}`}
            className="mb-1 inline-block text-[11px] text-[color:var(--color-info)] hover:underline"
          >
            评价 #{review.id} · 查看详情 →
          </Link>
        ) : null}
        <p className="whitespace-pre-wrap text-sm text-neutral-800">
          {review.content}
        </p>
      </div>

      {/* 图片画廊 */}
      {review.images && review.images.length > 0 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {review.images.map((key) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={key}
              src={imageUrl(key)}
              alt="评价图片"
              className="aspect-square w-full rounded border border-[color:var(--color-border)] object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = imagePlaceholder();
              }}
            />
          ))}
        </div>
      ) : null}

      {/* Hidden 提示 */}
      {isHidden && review.hidden_reason ? (
        <div className="rounded border border-red-200 bg-white/60 px-2 py-1 text-xs text-[color:var(--color-danger)]">
          隐藏原因：
          <span className="text-neutral-700">{review.hidden_reason}</span>
          {review.hidden_at ? (
            <span className="ml-2 text-neutral-400 tabular-nums">
              {formatDateTime(review.hidden_at)}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* 尾部：时间 + 操作 */}
      <footer className="flex items-center justify-between gap-3 border-t border-[color:var(--color-border)] pt-2 text-xs text-neutral-500">
        <div className="flex items-center gap-3 tabular-nums">
          <span>发表 {formatDateTime(review.created_at)}</span>
          <span>
            可编辑至{" "}
            <span className="text-neutral-700">
              {formatDateTime(review.edit_deadline_at)}
            </span>
          </span>
        </div>
        {canModerate ? (
          <div className="flex items-center gap-2">
            {isHidden ? (
              <Button size="sm" variant="secondary" onClick={onRestore}>
                恢复显示
              </Button>
            ) : (
              <Button size="sm" variant="danger" onClick={onHide}>
                隐藏评价
              </Button>
            )}
          </div>
        ) : null}
      </footer>
    </article>
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
