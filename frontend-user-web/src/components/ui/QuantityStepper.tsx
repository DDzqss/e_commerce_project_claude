"use client";

import { cn } from "@/lib/cn";

interface QuantityStepperProps {
  value: number;
  onChange: (n: number) => void;
  /** 最小值，默认 1（购物车最少 1 件；<1 请直接删除）。 */
  min?: number;
  /** 最大值，默认 999（契约 §7.1 单件上限）。 */
  max?: number;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

/**
 * 数量增减控件 [-] [ N ] [+]。
 * - 内置 clamp，越界或非数字自动回落到 min
 * - onChange 只在值真的变化时触发（避免 setState 抖动）
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  disabled = false,
  size = "md",
  className,
  ariaLabel = "数量",
}: QuantityStepperProps) {
  const clamp = (n: number) => {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.floor(n)));
  };
  const setTo = (n: number) => {
    const next = clamp(n);
    if (next !== value) onChange(next);
  };

  const cellCls =
    size === "sm"
      ? "h-7 w-7 text-xs"
      : "h-9 w-9 text-sm";
  const inputCls =
    size === "sm" ? "h-7 w-10 text-xs" : "h-9 w-12 text-sm";

  return (
    <div
      className={cn(
        "inline-flex select-none items-stretch overflow-hidden rounded border border-neutral-300",
        disabled && "opacity-50",
        className,
      )}
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => setTo(value - 1)}
        disabled={disabled || value <= min}
        aria-label="减少数量"
        className={cn(
          cellCls,
          "text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        -
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "");
          if (digits === "") {
            setTo(min);
            return;
          }
          setTo(Number(digits));
        }}
        onBlur={(e) => {
          // blur 时兜底一次，防止用户没输入数字
          const n = Number(e.target.value.replace(/[^\d]/g, ""));
          if (!Number.isFinite(n) || n < min) setTo(min);
        }}
        className={cn(
          inputCls,
          "border-x border-neutral-300 bg-white text-center tabular-nums text-neutral-900 focus:outline-none disabled:bg-neutral-50",
        )}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        onClick={() => setTo(value + 1)}
        disabled={disabled || value >= max}
        aria-label="增加数量"
        className={cn(
          cellCls,
          "text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        +
      </button>
    </div>
  );
}
