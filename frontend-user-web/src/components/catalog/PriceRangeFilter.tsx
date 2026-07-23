"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface PriceRangeFilterProps {
  /** 当前区间（元）；不传则空 */
  valueYuan?: { min?: number; max?: number };
  onChange: (next: { minCents?: number; maxCents?: number }) => void;
  className?: string;
}

/**
 * 价格区间筛选：两个输入框（元） + "确定"按钮。
 * 提交时把元转成分再回调，避免上层组件重复处理。
 * 空字符串代表"不限"；min > max 时置换。
 */
export function PriceRangeFilter({
  valueYuan,
  onChange,
  className,
}: PriceRangeFilterProps) {
  const [minStr, setMinStr] = useState(
    valueYuan?.min !== undefined ? String(valueYuan.min) : "",
  );
  const [maxStr, setMaxStr] = useState(
    valueYuan?.max !== undefined ? String(valueYuan.max) : "",
  );

  // 上层重置时同步本地 state
  useEffect(() => {
    setMinStr(valueYuan?.min !== undefined ? String(valueYuan.min) : "");
    setMaxStr(valueYuan?.max !== undefined ? String(valueYuan.max) : "");
  }, [valueYuan?.min, valueYuan?.max]);

  const submit = () => {
    let min = minStr === "" ? undefined : Number(minStr);
    let max = maxStr === "" ? undefined : Number(maxStr);
    if (min !== undefined && !Number.isFinite(min)) min = undefined;
    if (max !== undefined && !Number.isFinite(max)) max = undefined;
    if (min !== undefined && max !== undefined && min > max) {
      [min, max] = [max, min];
      setMinStr(String(min));
      setMaxStr(String(max));
    }
    onChange({
      minCents: min !== undefined ? Math.round(min * 100) : undefined,
      maxCents: max !== undefined ? Math.round(max * 100) : undefined,
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <PriceInput
          value={minStr}
          onChange={setMinStr}
          placeholder="最低价"
          aria-label="最低价（元）"
        />
        <span className="text-neutral-400">-</span>
        <PriceInput
          value={maxStr}
          onChange={setMaxStr}
          placeholder="最高价"
          aria-label="最高价（元）"
        />
      </div>
      <button
        type="button"
        className="h-8 rounded border border-neutral-300 bg-white text-xs text-neutral-700 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
        onClick={submit}
      >
        确定
      </button>
    </div>
  );
}

function PriceInput({
  value,
  onChange,
  placeholder,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "");
        onChange(raw);
      }}
      className="h-8 w-full min-w-0 rounded border border-neutral-300 bg-white px-2 text-xs text-neutral-800 focus:border-[color:var(--color-primary)] focus:outline-none"
      {...rest}
    />
  );
}
