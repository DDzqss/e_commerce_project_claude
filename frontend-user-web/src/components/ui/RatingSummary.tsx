"use client";

import { StarRating } from "./StarRating";
import { cn } from "@/lib/cn";
import type { RatingSummary as RatingSummaryData } from "@/types/review";

interface RatingSummaryProps {
  summary: RatingSummaryData;
  className?: string;
}

/**
 * 评价汇总面板：
 *   左：平均分大字 + 星级 + 总评价数
 *   右：5-1 星分布直方图（按数量占比）
 */
export function RatingSummary({ summary, className }: RatingSummaryProps) {
  const { avg, count, distribution } = summary;
  const rows = [5, 4, 3, 2, 1] as const;
  const total = Math.max(1, count);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:flex-row sm:items-center",
        className,
      )}
      data-testid="rating-summary"
    >
      <div className="flex flex-col items-center gap-1 sm:min-w-[160px] sm:border-r sm:border-neutral-100 sm:pr-5">
        <div className="text-4xl font-semibold text-[color:var(--color-primary)] tabular-nums">
          {avg.toFixed(1)}
        </div>
        <StarRating value={avg} readOnly size={18} allowHalf />
        <div className="text-xs text-neutral-500">
          {count.toLocaleString("zh-CN")} 条评价
        </div>
      </div>

      <div className="flex-1">
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => {
            const cnt = Number(distribution[String(r)] ?? 0);
            const pct = Math.min(100, Math.round((cnt / total) * 100));
            return (
              <li key={r} className="flex items-center gap-2 text-xs text-neutral-600">
                <span className="w-8 shrink-0 text-neutral-700">{r} 星</span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-[color:var(--color-primary)]"
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                </div>
                <span className="w-12 shrink-0 text-right tabular-nums text-neutral-500">
                  {cnt.toLocaleString("zh-CN")}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
