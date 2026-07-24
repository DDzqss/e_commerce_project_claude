"use client";

/**
 * 仲裁裁决 Modal（客服工作台核心组件）。
 *
 * 契约 §9.3 POST /admin/aftersales/{id}/resolve
 * Body:
 * - outcome: side_with_user | side_with_merchant | partial_refund
 * - conclusion: ≥ 20 字必填
 * - actual_refund_cents: outcome != side_with_merchant 时必填 (> 0 且 ≤ 用户申请值)
 * - evidence_image_keys: 可选（Phase 4 前端仅占位；上传流程复用 Phase 2 后单独接入）
 *
 * 交互规则：
 * - 顶部大警告"仲裁不可撤销 + 二次勾选"
 * - outcome 联动金额输入框显隐（side_with_merchant 隐藏金额）
 * - conclusion 字数计数 + 校验
 * - 提交后由父组件 mutate；此组件只做校验 + 抛回 payload
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type {
  ArbitrationOutcome,
  ResolveArbitrationPayload,
} from "@/types/aftersales";

const OUTCOME_OPTIONS: readonly {
  value: Exclude<ArbitrationOutcome, "other">;
  label: string;
  description: string;
  requiresAmount: boolean;
}[] = [
  {
    value: "side_with_user",
    label: "支持用户 · 全额退款",
    description: "认为用户诉求成立，按用户申请金额全额退款给用户",
    requiresAmount: true,
  },
  {
    value: "partial_refund",
    label: "部分退款",
    description: "双方各有责任，按裁决金额部分退款给用户",
    requiresAmount: true,
  },
  {
    value: "side_with_merchant",
    label: "支持商家 · 驳回申请",
    description: "认为商家处理合理，售后单关闭，不产生退款",
    requiresAmount: false,
  },
];

export interface ResolveModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: ResolveArbitrationPayload) => void;
  submitting: boolean;
  /** 用户申请的退款金额（分），用于金额输入的上限校验 + 快捷填充 */
  refundAmountCents: number;
  /** 售后单号（顶部展示） */
  aftersalesNo?: string;
}

const CONCLUSION_MIN = 20;
const CONCLUSION_MAX = 1000;

export function ResolveModal({
  open,
  onClose,
  onSubmit,
  submitting,
  refundAmountCents,
  aftersalesNo,
}: ResolveModalProps) {
  const [outcome, setOutcome] = useState<
    Exclude<ArbitrationOutcome, "other">
  >("side_with_user");
  const [conclusion, setConclusion] = useState("");
  const [amountYuanText, setAmountYuanText] = useState<string>("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 每次打开重置状态；默认预填全额到用户申请金额
  useEffect(() => {
    if (open) {
      setOutcome("side_with_user");
      setConclusion("");
      setAmountYuanText((refundAmountCents / 100).toFixed(2));
      setConfirmed(false);
      setError(null);
    }
  }, [open, refundAmountCents]);

  const requiresAmount = outcome !== "side_with_merchant";

  const parseAmountCents = (): number | null => {
    const text = amountYuanText.trim();
    if (!text) return null;
    const yuan = Number(text);
    if (!Number.isFinite(yuan) || yuan <= 0) return null;
    return Math.round(yuan * 100);
  };

  const handleSubmit = () => {
    const trimmed = conclusion.trim();
    if (trimmed.length < CONCLUSION_MIN) {
      setError(`仲裁结论需 ≥ ${CONCLUSION_MIN} 字`);
      return;
    }
    if (trimmed.length > CONCLUSION_MAX) {
      setError(`仲裁结论不得超过 ${CONCLUSION_MAX} 字`);
      return;
    }
    let cents: number | null = null;
    if (requiresAmount) {
      cents = parseAmountCents();
      if (cents === null) {
        setError("请填写有效的退款金额（元），必须 > 0");
        return;
      }
      if (cents > refundAmountCents) {
        setError(
          `退款金额不得超过用户申请值 ¥${(refundAmountCents / 100).toFixed(2)}`,
        );
        return;
      }
      if (outcome === "partial_refund" && cents === refundAmountCents) {
        setError(
          "「部分退款」金额需小于用户申请值；等额退款请选择「支持用户」",
        );
        return;
      }
    }
    if (!confirmed) {
      setError("请勾选二次确认");
      return;
    }
    setError(null);
    onSubmit({
      outcome,
      conclusion: trimmed,
      ...(requiresAmount && cents !== null
        ? { actual_refund_cents: cents }
        : {}),
    });
  };

  const currentMeta = OUTCOME_OPTIONS.find((o) => o.value === outcome);

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={
        <span>
          仲裁裁决
          {aftersalesNo ? (
            <span className="ml-2 font-mono text-xs text-neutral-500">
              {aftersalesNo}
            </span>
          ) : null}
        </span>
      }
      size="lg"
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
            确认裁决
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 顶部大警告 */}
        <div className="rounded border-2 border-red-300 bg-[color:var(--color-danger-soft)] p-3 text-sm text-[color:var(--color-danger)]">
          <div className="mb-1 font-semibold">
            ⚠ 仲裁不可撤销 · 裁决即生效
          </div>
          <ul className="ml-4 list-disc space-y-1 text-xs">
            <li>裁决结果会立即写入售后单，触发对应退款流程（如有）</li>
            <li>裁决记录永久留档，商家 / 用户 / 平台三方可见</li>
            <li>请务必核对证据 / 消息 / 金额，勿轻率下判</li>
          </ul>
        </div>

        {/* Outcome 选择 */}
        <FormField label="裁决结果" required>
          <div className="flex flex-col gap-2">
            {OUTCOME_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={
                  "flex cursor-pointer items-start gap-2 rounded border p-2 text-sm transition " +
                  (outcome === opt.value
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-100)]"
                    : "border-[color:var(--color-border)] bg-white hover:bg-neutral-50")
                }
              >
                <input
                  type="radio"
                  name="resolve-outcome"
                  value={opt.value}
                  checked={outcome === opt.value}
                  onChange={() => setOutcome(opt.value)}
                  className="mt-0.5"
                />
                <span className="flex-1">
                  <span className="font-medium text-neutral-900">
                    {opt.label}
                  </span>
                  <span className="ml-2 text-xs text-neutral-500">
                    {opt.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </FormField>

        {/* 金额输入（联动显示） */}
        {requiresAmount ? (
          <FormField
            label={
              outcome === "partial_refund" ? "部分退款金额（元）" : "退款金额（元）"
            }
            required
            description={`用户申请金额 ¥${(refundAmountCents / 100).toFixed(
              2,
            )}${outcome === "partial_refund" ? "，需严格小于该值" : "，可等于或小于该值"}`}
          >
            <Input
              value={amountYuanText}
              onChange={(e) => setAmountYuanText(e.target.value)}
              placeholder="例如 39.60"
              inputMode="decimal"
              aria-label="退款金额（元）"
            />
          </FormField>
        ) : (
          <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            当前裁决「支持商家 · 驳回申请」，无退款；售后单将转为「系统已关闭」状态。
          </div>
        )}

        {/* 结论 */}
        <FormField
          label="仲裁结论（对三方公开）"
          required
          error={
            error &&
            !error.startsWith("请勾选") &&
            (error.includes("结论") || error.includes("金额"))
              ? error
              : null
          }
          description={`≥ ${CONCLUSION_MIN} 字；建议包含证据 / 责任划分 / 结论三部分。`}
        >
          <textarea
            className="block h-28 w-full resize-none rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--color-danger)] focus:ring-1 focus:ring-[color:var(--color-danger)]/20"
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            maxLength={CONCLUSION_MAX}
            aria-invalid={Boolean(error && error.includes("结论"))}
            placeholder={`例如：经审阅证据 (evidence #12/#13)，商品确有质量瑕疵；商家未在 72h 内响应，判定 ${currentMeta?.label ?? "……"}`}
          />
        </FormField>
        <div className="-mt-3 text-right text-xs text-neutral-400">
          {conclusion.trim().length} / {CONCLUSION_MAX} · 至少 {CONCLUSION_MIN} 字
        </div>

        {/* 二次确认 */}
        <label className="flex items-start gap-2 rounded border border-[color:var(--color-border)] bg-neutral-50 p-2 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            我已核对全部证据与消息，理解仲裁一旦提交即生效且不可撤销。
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
