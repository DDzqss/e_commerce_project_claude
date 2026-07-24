"use client";

/**
 * 举报处理弹窗（uphold / dismiss 二合一）。
 *
 * 契约 §5.5：
 * - POST /admin/review-reports/{id}/uphold  { review_note }  举报成立，同事务隐藏评价
 * - POST /admin/review-reports/{id}/dismiss { review_note }  驳回举报
 *
 * 前端校验：
 * - action 必选（uphold 或 dismiss）
 * - review_note ≥ 5 字（≤ 500）
 * - uphold 需二次确认（会隐藏关联评价）
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";

export type HandleReportAction = "uphold" | "dismiss";

interface HandleReportModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (action: HandleReportAction, review_note: string) => void;
  submitting?: boolean;
  /** 弹窗内的举报摘要，例如 "举报 #123 · 评价 #45 · ad_spam" */
  reportSummary?: string;
}

export function HandleReportModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  reportSummary,
}: HandleReportModalProps) {
  const [action, setAction] = useState<HandleReportAction>("uphold");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时清空
  const openKey = open ? "open" : "closed";
  const [lastOpen, setLastOpen] = useState("closed");
  if (openKey !== lastOpen) {
    setLastOpen(openKey);
    if (open) {
      setAction("uphold");
      setNote("");
      setConfirmed(false);
      setError(null);
    }
  }

  const isUphold = action === "uphold";

  const handleSubmit = () => {
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setError("处理备注至少 5 字");
      return;
    }
    if (trimmed.length > 500) {
      setError("处理备注最多 500 字");
      return;
    }
    if (isUphold && !confirmed) {
      setError("举报成立会隐藏该评价，请勾选二次确认");
      return;
    }
    setError(null);
    onSubmit(action, trimmed);
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="处理评价举报"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button
            variant={isUphold ? "danger" : "primary"}
            loading={submitting}
            onClick={handleSubmit}
          >
            {isUphold ? "举报成立并隐藏评价" : "驳回举报"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {reportSummary ? (
          <div className="rounded border border-[color:var(--color-border)] bg-neutral-50 p-2 text-xs text-neutral-600">
            {reportSummary}
          </div>
        ) : null}

        <FormField label="处理结果" required>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 text-sm text-neutral-800">
              <input
                type="radio"
                className="mt-0.5"
                name="handle-report-action"
                checked={action === "uphold"}
                onChange={() => setAction("uphold")}
                aria-label="举报成立"
              />
              <span>
                <span className="font-medium">举报成立</span>
                <span className="ml-1 text-xs text-neutral-500">
                  · 同事务隐藏关联评价并通知评价作者
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-neutral-800">
              <input
                type="radio"
                className="mt-0.5"
                name="handle-report-action"
                checked={action === "dismiss"}
                onChange={() => setAction("dismiss")}
                aria-label="驳回举报"
              />
              <span>
                <span className="font-medium">驳回举报</span>
                <span className="ml-1 text-xs text-neutral-500">
                  · 评价保持可见
                </span>
              </span>
            </label>
          </div>
        </FormField>

        <FormField
          label="处理备注 / 隐藏原因"
          required
          error={error}
          description={
            isUphold
              ? "举报成立时，此备注同时写入评价的 hidden_reason 字段"
              : "驳回时，此备注仅记录审核痕迹"
          }
        >
          <textarea
            className="block h-28 w-full resize-none rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]/20"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder={
              isUphold
                ? "请填写认定该评价违规的理由，将展示给评价作者（5-500 字）"
                : "请填写驳回理由，用于审核痕迹（5-500 字）"
            }
            aria-invalid={Boolean(error)}
            aria-label="处理备注"
          />
        </FormField>
        <div className="text-right text-xs text-neutral-400 tabular-nums">
          {note.trim().length} / 500
        </div>

        {isUphold ? (
          <label className="flex items-start gap-2 text-xs text-neutral-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              aria-label="二次确认举报成立"
            />
            <span>
              我确认已核实举报理由充分，同意隐藏该评价，并知晓此操作会通知评价作者与更新店铺评分。
            </span>
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
