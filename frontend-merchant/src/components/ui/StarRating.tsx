"use client";

/**
 * StarRating —— 星级评分（只读 / 可交互两用）。
 *
 * 商家端场景以只读为主（展示评价星级）；组件保留 `onChange` 允许
 * 后续在评价筛选栏做「星级 quick filter」。
 *
 * 视觉：★ 实心金；☆ 空心灰。避免依赖图标库。
 */

import { cn } from "@/lib/cn";

export interface StarRatingProps {
  /** 当前分值（1-5，允许 0 表示未评分）。 */
  value: number;
  /** 交互回调；未设置则为只读。 */
  onChange?: (next: number) => void;
  /** 最大分值，默认 5。 */
  max?: number;
  /** 单星字号 class（默认 text-base）。 */
  sizeClass?: string;
  className?: string;
  /** 附加 label 以便屏幕阅读器识别。 */
  ariaLabel?: string;
}

export function StarRating({
  value,
  onChange,
  max = 5,
  sizeClass = "text-base",
  className,
  ariaLabel,
}: StarRatingProps) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  const readonly = !onChange;

  return (
    <span
      role={readonly ? "img" : "radiogroup"}
      aria-label={ariaLabel ?? `${value} 星（共 ${max} 星）`}
      className={cn("inline-flex items-center gap-0.5", sizeClass, className)}
    >
      {stars.map((n) => {
        const filled = n <= Math.round(value);
        if (readonly) {
          return (
            <span
              key={n}
              aria-hidden
              className={cn("leading-none", filled ? "text-amber-400" : "text-neutral-300")}
            >
              ★
            </span>
          );
        }
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange?.(n)}
            className={cn(
              "cursor-pointer leading-none transition-colors focus:outline-none",
              filled ? "text-amber-400 hover:text-amber-500" : "text-neutral-300 hover:text-amber-300",
            )}
          >
            ★
          </button>
        );
      })}
    </span>
  );
}
