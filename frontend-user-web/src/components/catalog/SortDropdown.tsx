"use client";

import { cn } from "@/lib/cn";
import type { SPUSort } from "@/types/catalog";

const OPTIONS: { value: SPUSort; label: string }[] = [
  { value: "default", label: "综合" },
  { value: "newest", label: "最新" },
  { value: "sales", label: "销量" },
  { value: "price_asc", label: "价格↑" },
  { value: "price_desc", label: "价格↓" },
];

interface SortDropdownProps {
  value: SPUSort;
  onChange: (v: SPUSort) => void;
  className?: string;
}

/**
 * 排序切换：一排 pill 按钮（比 <select> 视觉更强、更好点）。
 * 契约 §11.2 支持 5 种排序，全部枚举好后端可直接接。
 */
export function SortDropdown({
  value,
  onChange,
  className,
}: SortDropdownProps) {
  return (
    <div
      role="tablist"
      aria-label="排序方式"
      className={cn(
        "inline-flex items-center gap-1 rounded border border-neutral-200 bg-white p-1 text-sm",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded px-3 py-1 text-xs transition",
              active
                ? "bg-[color:var(--color-primary)] text-white"
                : "text-neutral-600 hover:bg-neutral-100",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
