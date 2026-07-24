"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * 快递公司常量。与 Phase 3 merchant/orders 中的 CarrierPicker 保持一致。
 * 后端 `return_carrier` 字段接受 code。
 */
export const CARRIERS: ReadonlyArray<{ code: string; name: string }> = [
  { code: "SF", name: "顺丰速运" },
  { code: "YTO", name: "圆通速递" },
  { code: "ZTO", name: "中通快递" },
  { code: "STO", name: "申通快递" },
  { code: "YUNDA", name: "韵达快递" },
  { code: "JD", name: "京东物流" },
  { code: "EMS", name: "邮政 EMS" },
  { code: "POST", name: "邮政小包" },
  { code: "DBL", name: "德邦快递" },
  { code: "OTHER", name: "其他" },
] as const;

const CARRIER_MAP: Readonly<Record<string, string>> = CARRIERS.reduce(
  (acc, c) => {
    acc[c.code] = c.name;
    return acc;
  },
  {} as Record<string, string>,
);

export function carrierLabel(code: string | null | undefined): string {
  if (!code) return "-";
  return CARRIER_MAP[code] ?? code;
}

/** 快递单号简单校验：8-40 位字母数字。 */
export function validateTrackingNo(no: string): string | null {
  const trimmed = no.trim();
  if (!trimmed) return "请填写快递单号";
  if (!/^[A-Za-z0-9-]{8,40}$/.test(trimmed)) {
    return "快递单号格式无效（8-40 位字母/数字）";
  }
  return null;
}

interface ReturnTrackingFormProps {
  /** 默认承运商 code。 */
  defaultCarrier?: string;
  defaultTrackingNo?: string;
  submitting?: boolean;
  onSubmit: (carrier: string, trackingNo: string) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
}

/** 用户回填寄回快递（RETURN_REFUND / EXCHANGE 主流程）。 */
export function ReturnTrackingForm({
  defaultCarrier = "",
  defaultTrackingNo = "",
  submitting = false,
  onSubmit,
  onCancel,
  className,
}: ReturnTrackingFormProps) {
  const [carrier, setCarrier] = useState(defaultCarrier);
  const [trackingNo, setTrackingNo] = useState(defaultTrackingNo);
  const [errors, setErrors] = useState<{
    carrier?: string;
    tracking_no?: string;
  }>({});

  const submit = () => {
    const next: typeof errors = {};
    if (!carrier) next.carrier = "请选择快递公司";
    const trackErr = validateTrackingNo(trackingNo);
    if (trackErr) next.tracking_no = trackErr;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void onSubmit(carrier, trackingNo.trim());
  };

  return (
    <form
      className={cn("flex flex-col gap-4", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      aria-label="寄回快递信息"
    >
      <div>
        <label
          htmlFor="return-carrier"
          className="mb-1.5 block text-sm font-medium text-neutral-800"
        >
          快递公司
        </label>
        <select
          id="return-carrier"
          data-testid="return-carrier"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          disabled={submitting}
          aria-invalid={Boolean(errors.carrier) || undefined}
          className={cn(
            "block h-10 w-full rounded-md border bg-white px-3 text-sm text-neutral-900",
            "focus:outline-none focus-visible:ring-2",
            errors.carrier
              ? "border-[color:var(--color-primary)] focus-visible:ring-[color:var(--color-primary)]/40"
              : "border-neutral-300 focus-visible:border-[color:var(--color-primary)] focus-visible:ring-[color:var(--color-primary)]/40",
            "disabled:cursor-not-allowed disabled:bg-neutral-50",
          )}
        >
          <option value="">请选择快递公司</option>
          {CARRIERS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.carrier && (
          <p
            className="mt-1 text-xs text-[color:var(--color-primary)]"
            role="alert"
          >
            {errors.carrier}
          </p>
        )}
      </div>
      <Input
        label="快递单号"
        data-testid="return-tracking-no"
        placeholder="请输入 8-40 位字母/数字"
        value={trackingNo}
        onChange={(e) => setTrackingNo(e.target.value)}
        disabled={submitting}
        error={errors.tracking_no ?? null}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            variant="ghost"
            type="button"
            onClick={onCancel}
            disabled={submitting}
          >
            取消
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          提交
        </Button>
      </div>
    </form>
  );
}
