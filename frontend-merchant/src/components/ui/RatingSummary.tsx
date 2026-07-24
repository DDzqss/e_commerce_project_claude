"use client";

/**
 * RatingSummary —— 评分汇总面板（评价管理页顶部使用）。
 *
 * 展示：平均分（大号）+ 总评价数 + 星级分布条。
 *
 * 契约：`distribution` 里 key 为星级（1-5），value 为该星级评价数。
 */

import { cn } from "@/lib/cn";
import { StarRating } from "./StarRating";

export interface RatingSummaryProps {
  avgRating: number;
  totalCount: number;
  distribution: Record<number, number>;
  className?: string;
}

export function RatingSummary({
  avgRating,
  totalCount,
  distribution,
  className,
}: RatingSummaryProps) {
  const rows = [5, 4, 3, 2, 1] as const;
  const safeTotal = totalCount > 0 ? totalCount : 1;

  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-lg border border-neutral-200 bg-white p-5 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="flex flex-col items-center border-neutral-100 sm:min-w-[8rem] sm:border-r sm:pr-6">
        <div className="text-4xl font-semibold text-neutral-900">
          {avgRating.toFixed(1)}
        </div>
        <StarRating value={avgRating} sizeClass="text-lg" />
        <div className="mt-1 text-xs text-neutral-500">
          共 {totalCount} 条评价
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {rows.map((star) => {
          const count = distribution[star] ?? 0;
          const pct = Math.min(100, Math.round((count / safeTotal) * 100));
          return (
            <div key={star} className="flex items-center gap-3 text-xs">
              <span className="w-8 shrink-0 text-neutral-600">{star} 星</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-neutral-100">
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-neutral-500">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
