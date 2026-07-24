"use client";

import { useState } from "react";
import { StarRating } from "@/components/ui/StarRating";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/image";
import { reportReview } from "@/lib/review-api";
import { ApiError } from "@/lib/api";
import { messageForCode } from "@/types/errors";
import {
  REVIEW_REPORT_CATEGORY_LABEL,
  REVIEW_REPORT_CATEGORY_LIST,
  maskAnonymousNickname,
  type ReviewOut,
  type ReviewReportCategory,
} from "@/types/review";

interface ReviewCardProps {
  review: ReviewOut;
  /** 是否显示举报入口（自己的评价不允许举报）。 */
  canReport?: boolean;
  /** 右上角操作节点（编辑/删除等） */
  rightActions?: React.ReactNode;
  className?: string;
}

/** 单条评价卡片。 */
export function ReviewCard({
  review,
  canReport = true,
  rightActions,
  className,
}: ReviewCardProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(Boolean(review.reported_by_me));
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const nickname = maskAnonymousNickname(review);

  return (
    <article
      className={cn(
        "rounded-lg border border-neutral-200 bg-white p-4",
        className,
      )}
      data-testid={`review-card-${review.id}`}
    >
      <header className="flex items-center gap-3">
        <div
          aria-hidden
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[color:var(--color-primary-50)] text-sm font-medium text-[color:var(--color-primary-700)]"
        >
          {review.user?.avatar_url ? (
            <ImageWithFallback
              objectKey={review.user.avatar_url}
              alt=""
              className="h-full w-full"
            />
          ) : (
            <span>{nickname.slice(0, 1)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-800">
              {nickname}
            </span>
            <StarRating value={review.rating} readOnly size={14} allowHalf={false} />
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {formatDateTime(review.created_at)}
            {review.sku?.specs && Object.keys(review.sku.specs).length > 0 && (
              <span className="ml-2">
                {Object.values(review.sku.specs).join(" / ")}
              </span>
            )}
          </div>
        </div>
        {rightActions}
      </header>

      <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-800">
        {review.content}
      </p>

      {review.images && review.images.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {review.images.map((k, idx) => (
            <li key={k + idx}>
              <button
                type="button"
                onClick={() => setPreviewImg(imageUrl(k))}
                className="block h-20 w-20 overflow-hidden rounded border border-neutral-200 bg-neutral-50 hover:border-[color:var(--color-primary)]"
                aria-label={`查看第 ${idx + 1} 张图`}
              >
                <ImageWithFallback
                  objectKey={k}
                  alt=""
                  className="h-full w-full"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {review.reply && (
        <div className="mt-3 rounded-md bg-neutral-50 p-3 text-sm">
          <div className="text-xs text-neutral-500">
            商家回复 · {formatDateTime(review.reply.created_at)}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-neutral-800">
            {review.reply.content}
          </p>
        </div>
      )}

      {canReport && (
        <footer className="mt-3 flex justify-end">
          <button
            type="button"
            className="text-xs text-neutral-400 hover:text-[color:var(--color-primary)] disabled:opacity-50"
            disabled={reported}
            onClick={() => setReportOpen(true)}
            data-testid={`review-report-${review.id}`}
          >
            {reported ? "已举报" : "举报"}
          </button>
        </footer>
      )}

      {reportOpen && (
        <ReportReviewModal
          reviewId={review.id}
          onClose={() => setReportOpen(false)}
          onSuccess={() => {
            setReported(true);
            setReportOpen(false);
          }}
        />
      )}

      {previewImg && (
        <Modal
          open
          title="查看图片"
          onClose={() => setPreviewImg(null)}
          className="max-w-3xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImg}
            alt=""
            className="mx-auto max-h-[70vh] object-contain"
          />
        </Modal>
      )}
    </article>
  );
}

function ReportReviewModal({
  reviewId,
  onClose,
  onSuccess,
}: {
  reviewId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState<ReviewReportCategory | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason) {
      toast.error("请选择举报理由");
      return;
    }
    setSubmitting(true);
    try {
      await reportReview(reviewId, {
        reason_category: reason,
        reason_note: note.trim() || undefined,
      });
      toast.success("已提交举报，等待客服处理");
      onSuccess();
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "举报失败";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="举报评价">
      <div className="flex flex-col gap-3">
        <div
          role="radiogroup"
          aria-label="举报理由"
          className="flex flex-wrap gap-2"
        >
          {REVIEW_REPORT_CATEGORY_LIST.map((cat) => {
            const active = reason === cat;
            return (
              <button
                key={cat}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setReason(cat)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition",
                  active
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)] text-[color:var(--color-primary-700)]"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400",
                )}
                data-testid={`report-reason-${cat}`}
              >
                {REVIEW_REPORT_CATEGORY_LABEL[cat]}
              </button>
            );
          })}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder="补充说明（可选，最多 500 字）"
          className="w-full rounded border border-neutral-300 bg-white p-2 text-sm text-neutral-800 focus:border-[color:var(--color-primary)] focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            取消
          </Button>
          <Button type="button" onClick={submit} loading={submitting}>
            提交举报
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}
