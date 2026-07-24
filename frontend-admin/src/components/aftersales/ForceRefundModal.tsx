"use client";

/**
 * 强制退款 Modal（客服工作台）。
 *
 * 契约 §9.4 POST /admin/aftersales/{id}/force-refund
 * Body:
 * - amount_cents: > 0
 * - note: ≥ 10 字必填
 *
 * 交互：
 * - 顶部大警告 + 二次勾选（与 ResolveModal 一致的风格）
 * - amount 输入以元为单位；父组件 mutate 前转分
 * - note 计数 + 校验
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { ForceRefundPayload } from "@/types/aftersales";

export interface ForceRefundModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: ForceRefundPayload) => void;
  submitting: boolean;
  /** 用户申请或订单可退最大金额（分），用作默认填充上限校验 */
  maxRefundCents: number;
  aftersalesNo?: string;
}

const NOTE_MIN = 10;
const NOTE_MAX = 500;

export function ForceRefundModal({
  open,
  onClose,
  onSubmit,
  submitting,
  maxRefundCents,
  aftersalesNo,
}: ForceRefundModalProps) {
  const [amountYuanText, setAmountYuanText] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmountYuanText((maxRefundCents / 100).toFixed(2));
      setNote("");
      setConfirmed(false);
      setError(null);
    }
  }, [open, maxRefundCents]);

  const handleSubmit = () => {
    const text = amountYuanText.trim();
    const yuan = Number(text);
    if (!Number.isFinite(yuan) || yuan <= 0) {
      setError("请填写有效的退款金额（元），必须 > 0");
      return;
    }
    const cents = Math.round(yuan * 100);
    if (cents > maxRefundCents) {
      setError(
        `退款金额不得超过订单可退金额 ¥${(maxRefundCents / 100).toFixed(2)}`,
      );
      return;
    }
    const trimmedNote = note.trim();
    if (trimmedNote.length < NOTE_MIN) {
      setError(`原因备注需 ≥ ${NOTE_MIN} 字`);
      return;
    }
    if (trimmedNote.length > NOTE_MAX) {
      setError(`原因备注不得超过 ${NOTE_MAX} 字`);
      return;
    }
    if (!confirmed) {
      setError("请勾选二次确认");
      return;
    }
    setError(null);
    onSubmit({ amount_cents: cents, note: trimmedNote });
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={
        <span>
          强制退款
          {aftersalesNo ? (
            <span className="ml-2 font-mono text-xs text-neutral-500">
              {aftersalesNo}
            </span>
          ) : null}
        </span>
      }
      size="md"
      closeOnOverlay={false}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            返回
          </Button>
          <Button
            variant="danger"
            loading={submitting}
            onClick={handleSubmit}
          >
            确认强制退款
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded border-2 border-red-300 bg-[color:var(--color-danger-soft)] p-3 text-sm text-[color:var(--color-danger)]">
          <div className="mb-1 font-semibold">
            ⚠ 强制退款 · 超越商家意见 · 不可撤销
          </div>
          <ul className="ml-4 list-disc space-y-1 text-xs">
            <li>无论售后当前状态如何（除已完成 / 已关闭外），立即触发退款</li>
            <li>操作会以 <code>admin_force_refund</code> 记入售后历史与审计日志</li>
            <li>请务必先与商家 / 用户协商，确认必要性后再执行</li>
          </ul>
        </div>

        <FormField
          label="退款金额（元）"
          required
          description={`订单最大可退 ¥${(maxRefundCents / 100).toFixed(2)}`}
          error={error && error.includes("金额") ? error : null}
        >
          <Input
            value={amountYuanText}
            onChange={(e) => setAmountYuanText(e.target.value)}
            placeholder="例如 39.60"
            inputMode="decimal"
          />
        </FormField>

        <FormField
          label="强制退款原因（管理员留档）"
          required
          error={error && error.includes("原因备注") ? error : null}
        >
          <textarea
            className="block h-24 w-full resize-none rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--color-danger)] focus:ring-1 focus:ring-[color:var(--color-danger)]/20"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            placeholder="例如：与用户/商家电话沟通一致，因商品缺失且商家配合，先行退款处理…"
          />
        </FormField>
        <div className="-mt-3 text-right text-xs text-neutral-400">
          {note.trim().length} / {NOTE_MAX} · 至少 {NOTE_MIN} 字
        </div>

        <label className="flex items-start gap-2 rounded border border-[color:var(--color-border)] bg-neutral-50 p-2 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            我已确认：本次强制退款经过必要的核实与协商，理解操作不可撤销。
          </span>
        </label>
        {error && error.startsWith("请勾选") ? (
          <p
            className="text-xs text-[color:var(--color-danger)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
