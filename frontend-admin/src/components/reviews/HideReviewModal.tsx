"use client";

/**
 * 隐藏评价 Modal。
 *
 * 契约 §5.4 POST /admin/reviews/{id}/hide 请求体 { hidden_reason }
 *
 * 前端校验：
 * - hidden_reason ≥ 5 字（≤ 500）
 * - 破坏性操作 → 二次确认 checkbox
 *
 * UX 特殊性：
 * - closeOnOverlay=false，避免误触遮罩关闭
 * - loading 期间禁用交互 + close 按钮
 * - 弹窗打开时重置内部 state（reason / confirm / error）
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import type { HideReviewPayload } from "@/types/review";

interface HideReviewModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: HideReviewPayload) => void;
  submitting?: boolean;
  /** 用于弹窗内显示的评价简要摘要（如 "评价 #123 · 5 星 · iPhone 20 Pro"） */
  reviewSummary?: string;
}

export function HideReviewModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  reviewSummary,
}: HideReviewModalProps) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时清空
  const openKey = open ? "open" : "closed";
  const [lastOpen, setLastOpen] = useState("closed");
  if (openKey !== lastOpen) {
    setLastOpen(openKey);
    if (open) {
      setReason("");
      setConfirmed(false);
      setError(null);
    }
  }

  const handleSubmit = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError("隐藏原因至少 5 字");
      return;
    }
    if (trimmed.length > 500) {
      setError("隐藏原因最多 500 字");
      return;
    }
    if (!confirmed) {
      setError("请勾选二次确认后再提交");
      return;
    }
    setError(null);
    onSubmit({ hidden_reason: trimmed });
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="隐藏评价"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button
            variant="danger"
            loading={submitting}
            onClick={handleSubmit}
          >
            确认隐藏
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-600">
          隐藏后该评价对用户 / 商家 / 公开端不再可见；同事务会更新店铺评分冗余字段（
          <code>shops.rating_avg / rating_count</code>），并给评价作者发送「评价已被隐藏」站内信。
        </p>

        {reviewSummary ? (
          <div className="rounded border border-[color:var(--color-border)] bg-neutral-50 p-2 text-xs text-neutral-600">
            {reviewSummary}
          </div>
        ) : null}

        <FormField label="隐藏原因" required error={error}>
          <textarea
            className="block h-28 w-full resize-none rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]/20"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="请填写隐藏原因，将作为处理记录并展示给评价作者（5-500 字）"
            aria-invalid={Boolean(error)}
            aria-label="隐藏原因"
          />
        </FormField>
        <div className="text-right text-xs text-neutral-400 tabular-nums">
          {reason.trim().length} / 500
        </div>

        <label className="flex items-start gap-2 text-xs text-neutral-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            aria-label="二次确认隐藏"
          />
          <span>
            我确认已核实评价内容存在违规，并同意隐藏该评价。此操作会通知评价作者。
          </span>
        </label>
      </div>
    </Modal>
  );
}
