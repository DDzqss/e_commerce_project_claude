"use client";

/**
 * 举报卡片 (list item)。
 *
 * 展示：
 * - 举报状态 badge（pending / upheld / dismissed）
 * - 举报理由 category badge + 用户备注
 * - 举报人（明文 + 手机号）
 * - 关联评价预览（星级 + 内容前 120 字 + 商品/店铺）
 * - 举报时间 + 处理时间
 * - "处理" 按钮（仅 pending 显示）→ 触发弹窗
 */

import Link from "next/link";
import clsx from "clsx";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { imagePlaceholder, imageUrl } from "@/lib/image";
import type {
  AdminReviewReportListItem,
  ReviewReportReasonCategory,
  ReviewReportStatus,
} from "@/types/review";

interface ReportItemProps {
  report: AdminReviewReportListItem;
  /** pending 状态是否可处理；无权限时按钮不渲染 */
  canHandle?: boolean;
  onHandle?: () => void;
  className?: string;
}

const REASON_META: Record<
  ReviewReportReasonCategory,
  { label: string; tone: BadgeTone }
> = {
  ad_spam: { label: "广告 / 刷屏", tone: "warning" },
  inappropriate: { label: "不当内容", tone: "danger" },
  fake_review: { label: "虚假评价", tone: "danger" },
  offensive: { label: "辱骂 / 攻击", tone: "danger" },
  irrelevant: { label: "与商品无关", tone: "info" },
  other: { label: "其他", tone: "default" },
};

const STATUS_META: Record<
  ReviewReportStatus,
  { label: string; tone: BadgeTone }
> = {
  pending: { label: "待处理", tone: "warning" },
  upheld: { label: "举报成立", tone: "danger" },
  dismissed: { label: "已驳回", tone: "default" },
};

export function reportReasonLabel(cat: ReviewReportReasonCategory): string {
  return REASON_META[cat].label;
}

export function ReportItem({
  report,
  canHandle = false,
  onHandle,
  className,
}: ReportItemProps) {
  const reason = REASON_META[report.reason_category];
  const status = STATUS_META[report.status];
  const review = report.review;
  const isPending = report.status === "pending";

  return (
    <article
      className={clsx(
        "flex flex-col gap-3 rounded-md border bg-white p-4 shadow-sm transition",
        isPending
          ? "border-red-200 bg-[color:var(--color-danger-soft)]/30"
          : "border-[color:var(--color-border)]",
        className,
      )}
    >
      {/* 顶部：状态 + 分类 + 时间 */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone={reason.tone}>{reason.label}</Badge>
          <span className="text-xs text-neutral-500 tabular-nums">
            举报于 {formatDateTime(report.created_at)}
          </span>
        </div>
        <div className="text-xs text-neutral-400">举报 #{report.id}</div>
      </header>

      {/* 举报人 */}
      <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
        <div className="rounded border border-[color:var(--color-border)] bg-neutral-50 p-2">
          <div className="mb-1 font-medium text-neutral-700">举报人</div>
          <div className="text-neutral-800">
            {report.reporter?.nickname ?? `用户 #${report.reporter_user_id}`}
            <span className="ml-2 text-neutral-400">
              #{report.reporter_user_id}
            </span>
          </div>
          {report.reporter?.phone ? (
            <div className="mt-0.5 tabular-nums text-neutral-500">
              {report.reporter.phone}
            </div>
          ) : null}
          {report.reason_note ? (
            <div className="mt-1 whitespace-pre-wrap rounded bg-white px-2 py-1 text-neutral-700">
              备注：{report.reason_note}
            </div>
          ) : null}
        </div>

        {/* 处理结果 */}
        <div className="rounded border border-[color:var(--color-border)] bg-neutral-50 p-2">
          <div className="mb-1 font-medium text-neutral-700">处理信息</div>
          {report.reviewer_admin ? (
            <div className="text-neutral-800">
              处理人：
              {report.reviewer_admin.display_name ??
                report.reviewer_admin.username}
              <span className="ml-2 text-neutral-400">
                #{report.reviewer_admin.id}
              </span>
            </div>
          ) : (
            <div className="text-neutral-400">尚未认领处理</div>
          )}
          {report.reviewed_at ? (
            <div className="mt-0.5 tabular-nums text-neutral-500">
              {formatDateTime(report.reviewed_at)}
            </div>
          ) : null}
          {report.review_note ? (
            <div className="mt-1 whitespace-pre-wrap rounded bg-white px-2 py-1 text-neutral-700">
              备注：{report.review_note}
            </div>
          ) : null}
        </div>
      </div>

      {/* 关联评价预览 */}
      {review ? (
        <div className="rounded border border-[color:var(--color-border)] bg-white p-3 text-xs">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={review.visible ? "success" : "danger"}>
              {review.visible ? "评价显示中" : "评价已隐藏"}
            </Badge>
            <StarRating rating={review.rating} size="sm" />
            <Link
              href={`/console/reviews/${review.id}`}
              className="text-[11px] text-[color:var(--color-info)] hover:underline"
            >
              评价 #{review.id} · 查看详情 →
            </Link>
          </div>
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(review.spu?.main_image ?? null)}
              alt="商品图"
              className="h-14 w-14 shrink-0 rounded object-cover"
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
              </div>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-neutral-700">
                {review.content}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded border border-dashed border-[color:var(--color-border)] p-2 text-xs text-neutral-400">
          评价快照未提供 ·{" "}
          <Link
            href={`/console/reviews/${report.review_id}`}
            className="text-[color:var(--color-info)] hover:underline"
          >
            打开评价 #{report.review_id}
          </Link>
        </div>
      )}

      {/* 操作 */}
      {canHandle && isPending ? (
        <footer className="flex items-center justify-end gap-2 border-t border-[color:var(--color-border)] pt-2">
          <Button size="sm" variant="primary" onClick={onHandle}>
            处理举报
          </Button>
        </footer>
      ) : null}
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
