"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * 快递公司常量：code → 中文名。
 *
 * Phase 3 硬编码常见承运商，与 backend `shipping_carrier` 字段一致；
 * 未来接真实物流后可迁至后端 dict 接口。
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

/** 展示层辅助：code → 中文名（无匹配时返回原 code）。 */
export function carrierLabel(code: string | null | undefined): string {
  if (!code) return "-";
  return CARRIER_MAP[code] ?? code;
}

export interface CarrierPickerProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> {
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
}

/**
 * 快递公司选择器。原生 <select>，样式向 <Input> 对齐。
 */
export const CarrierPicker = forwardRef<HTMLSelectElement, CarrierPickerProps>(
  function CarrierPicker(
    { value, onChange, invalid, className, disabled, ...rest },
    ref,
  ) {
    return (
      <select
        ref={ref}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "block h-10 w-full rounded-md border bg-white px-3 text-sm text-neutral-900",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
          invalid
            ? "border-red-400 focus-visible:ring-red-300"
            : "border-neutral-300 focus-visible:border-[var(--color-primary)] focus-visible:ring-blue-200",
          "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
          className,
        )}
        {...rest}
      >
        <option value="">请选择快递公司</option>
        {CARRIERS.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    );
  },
);
