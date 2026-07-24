"use client";

/**
 * 星级评分展示组件（只读）。
 *
 * 契约 §3.1 review.rating ∈ 1..5。
 *
 * 使用：
 *   <StarRating rating={4} />
 *   <StarRating rating={4.5} size="sm" showValue />
 *
 * 设计：
 * - 纯 CSS 五角星，无外部 icon 依赖
 * - 支持小数（半星以背景色截取实现）
 * - 支持 sm(12px) / md(16px) / lg(20px) 三档
 * - showValue: 是否在星星后显示 "4.5" 数字
 */

import clsx from "clsx";

export type StarRatingSize = "sm" | "md" | "lg";

interface StarRatingProps {
  rating: number;
  /** 满分，默认 5 */
  max?: number;
  size?: StarRatingSize;
  showValue?: boolean;
  className?: string;
  ariaLabel?: string;
}

const SIZE_CLASS: Record<StarRatingSize, string> = {
  sm: "text-[12px]",
  md: "text-[16px]",
  lg: "text-[20px]",
};

/**
 * 只读星级评分。
 *
 * 通过绝对定位重叠两层字符 ★★★★★：
 * - 底层灰色作为背景
 * - 顶层琥珀色，用 clipPath / width 表达实际评分
 * 这样能天然支持小数（如 4.3 → 显示 4.3 个星）。
 */
export function StarRating({
  rating,
  max = 5,
  size = "md",
  showValue = false,
  className,
  ariaLabel,
}: StarRatingProps) {
  const safeMax = Math.max(1, Math.floor(max));
  const clamped = Math.max(0, Math.min(safeMax, rating));
  const percentage = (clamped / safeMax) * 100;

  const stars = "★".repeat(safeMax);
  const labelBase = ariaLabel ?? `${clamped.toFixed(1)} / ${safeMax} 星`;

  return (
    <span
      role="img"
      aria-label={labelBase}
      className={clsx(
        "inline-flex items-center gap-1 select-none",
        SIZE_CLASS[size],
        className,
      )}
    >
      <span className="relative inline-block leading-none tracking-[0.05em]">
        <span aria-hidden className="text-neutral-300">
          {stars}
        </span>
        <span
          aria-hidden
          className="absolute inset-0 overflow-hidden text-amber-500"
          style={{ width: `${percentage}%` }}
        >
          {stars}
        </span>
      </span>
      {showValue ? (
        <span className="text-xs text-neutral-600 tabular-nums">
          {clamped.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}
