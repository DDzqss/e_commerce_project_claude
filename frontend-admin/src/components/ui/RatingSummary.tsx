"use client";

/**
 * 评分汇总组件（平均分 + 分布）。
 *
 * 用于评价详情页 / 店铺主页顶部展示"综合评分 4.5 · 128 条"以及柱状分布。
 *
 * Phase 5 简化：管理员端主要用于详情页占位；数据来源可能是
 * 客户端聚合的 review.distribution，也可能是店铺聚合字段。
 */

import clsx from "clsx";
import { StarRating } from "./StarRating";

interface RatingSummaryProps {
  /** 平均分 0..5，允许小数 */
  average: number;
  /** 评价总数 */
  count: number;
  /**
   * 星级分布 { 1: N, 2: N, ..., 5: N }
   * 若未提供则不渲染分布柱状条
   */
  distribution?: Record<number, number>;
  className?: string;
}

export function RatingSummary({
  average,
  count,
  distribution,
  className,
}: RatingSummaryProps) {
  const rows = distribution
    ? [5, 4, 3, 2, 1].map((star) => {
        const num = distribution[star] ?? 0;
        const pct = count > 0 ? (num / count) * 100 : 0;
        return { star, num, pct };
      })
    : null;

  return (
    <section
      className={clsx(
        "flex flex-col gap-3 rounded-md border border-[color:var(--color-border)] bg-white p-4 sm:flex-row sm:items-center sm:gap-6",
        className,
      )}
      aria-label="评价汇总"
    >
      <div className="flex flex-col items-center gap-1 border-b border-[color:var(--color-border)] pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
        <span className="text-3xl font-semibold text-amber-500 tabular-nums">
          {average.toFixed(1)}
        </span>
        <StarRating rating={average} size="sm" />
        <span className="text-xs text-neutral-500 tabular-nums">
          {count} 条评价
        </span>
      </div>
      {rows ? (
        <ul className="flex flex-1 flex-col gap-1">
          {rows.map(({ star, num, pct }) => (
            <li
              key={star}
              className="flex items-center gap-2 text-xs text-neutral-600"
            >
              <span className="w-6 tabular-nums">{star}星</span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-amber-400"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              </span>
              <span className="w-8 text-right tabular-nums text-neutral-500">
                {num}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
