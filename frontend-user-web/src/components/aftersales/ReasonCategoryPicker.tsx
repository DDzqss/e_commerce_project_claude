"use client";

import { cn } from "@/lib/cn";
import {
  REASON_CATEGORY_LABEL,
  REASON_CATEGORY_LIST,
  type ReasonCategory,
} from "@/types/aftersales";

interface ReasonCategoryPickerProps {
  value: ReasonCategory | "";
  onChange: (v: ReasonCategory) => void;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * 售后原因分类选择器：6+1 分类以按钮组呈现。
 * 单选，key 与后端 enum 完全对齐。
 */
export function ReasonCategoryPicker({
  value,
  onChange,
  error,
  disabled,
  className,
}: ReasonCategoryPickerProps) {
  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label="售后原因"
        className="flex flex-wrap gap-2"
      >
        {REASON_CATEGORY_LIST.map((cat) => {
          const active = value === cat;
          return (
            <button
              key={cat}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(cat)}
              data-testid={`reason-${cat}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition",
                active
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)] text-[color:var(--color-primary-700)]"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              {REASON_CATEGORY_LABEL[cat]}
            </button>
          );
        })}
      </div>
      {error && (
        <p
          className="mt-1 text-xs text-[color:var(--color-primary)]"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
