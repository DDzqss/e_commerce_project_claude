"use client";

import { cn } from "@/lib/cn";

export interface DateRangePickerProps {
  /** YYYY-MM-DD 或空串 */
  start: string;
  end: string;
  onChange: (range: { start: string; end: string }) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * 极简日期区间选择器 —— Phase 3 用两个 <input type="date"> 即可。
 * 后续 Phase 若要更强能力再切到日历组件。
 */
export function DateRangePicker({
  start,
  end,
  onChange,
  className,
  disabled,
}: DateRangePickerProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        type="date"
        value={start}
        disabled={disabled}
        max={end || undefined}
        onChange={(e) => onChange({ start: e.target.value, end })}
        aria-label="开始日期"
        className={cn(
          "h-10 w-40 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900",
          "focus:outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-blue-200",
          "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
        )}
      />
      <span className="text-xs text-neutral-400">至</span>
      <input
        type="date"
        value={end}
        disabled={disabled}
        min={start || undefined}
        onChange={(e) => onChange({ start, end: e.target.value })}
        aria-label="结束日期"
        className={cn(
          "h-10 w-40 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900",
          "focus:outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-blue-200",
          "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
        )}
      />
      {start || end ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ start: "", end: "" })}
          className="text-xs text-neutral-500 hover:text-[var(--color-primary)] disabled:cursor-not-allowed"
        >
          清空
        </button>
      ) : null}
    </div>
  );
}
