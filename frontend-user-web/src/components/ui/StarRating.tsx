"use client";

import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

interface StarRatingProps {
  /** 当前评分（0..5）。可用小数（如 4.5）用于展示。 */
  value: number;
  /** 输入模式回调。传了即视为可交互。 */
  onChange?: (v: number) => void;
  /** 尺寸像素。 */
  size?: number;
  /** 只读展示；有 onChange 时默认 false。 */
  readOnly?: boolean;
  /** 展示模式是否允许半星（value 有小数时）。 */
  allowHalf?: boolean;
  className?: string;
  /** ARIA label（默认 "评分"）。 */
  ariaLabel?: string;
}

/**
 * 星级组件（5 星）。
 *
 * - 展示模式：value 支持小数，半星用 clip-path 显示
 * - 输入模式：点击选择；键盘支持 ← → / 0-5
 * - Accessible：radiogroup 语义 + arrow key navigation
 *
 * 主色使用 --color-primary（京东红 #D0211A）。
 */
export function StarRating({
  value,
  onChange,
  size = 20,
  readOnly = onChange === undefined,
  allowHalf = true,
  className,
  ariaLabel = "评分",
}: StarRatingProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const clamped = Math.max(0, Math.min(5, value));

  const activeIdx = hoverIdx ?? clamped;

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || !onChange) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(5, Math.floor(clamped) + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(0, Math.floor(clamped) - 1));
    } else if (/^[0-5]$/.test(e.key)) {
      e.preventDefault();
      onChange(Number(e.key));
    }
  };

  return (
    <div
      role={readOnly ? "img" : "radiogroup"}
      aria-label={`${ariaLabel} ${clamped} / 5`}
      tabIndex={readOnly ? -1 : 0}
      onKeyDown={handleKey}
      className={cn(
        "inline-flex items-center gap-0.5 outline-none",
        !readOnly &&
          "focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 rounded",
        className,
      )}
      onMouseLeave={() => setHoverIdx(null)}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.floor(activeIdx);
        const half =
          allowHalf &&
          !filled &&
          i - 1 < activeIdx &&
          i > activeIdx;
        return (
          <button
            key={i}
            type="button"
            role={readOnly ? "presentation" : "radio"}
            aria-checked={readOnly ? undefined : i === Math.round(clamped)}
            aria-label={`${i} 星`}
            disabled={readOnly}
            tabIndex={-1}
            onClick={() => !readOnly && onChange?.(i)}
            onMouseEnter={() => !readOnly && setHoverIdx(i)}
            className={cn(
              "relative inline-flex shrink-0",
              !readOnly && "cursor-pointer",
              readOnly && "cursor-default",
            )}
            style={{ width: size, height: size }}
            data-testid={`star-${i}`}
          >
            {/* 底层空星 */}
            <StarSvg size={size} className="text-neutral-300" filled={false} />
            {/* 上层填充：半星用 clip-path 只显示左半 */}
            {(filled || half) && (
              <span
                className="absolute inset-0"
                style={{
                  clipPath: half ? "inset(0 50% 0 0)" : undefined,
                }}
              >
                <StarSvg
                  size={size}
                  className="text-[color:var(--color-primary)]"
                  filled
                />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function StarSvg({
  size,
  className,
  filled,
}: {
  size: number;
  className?: string;
  filled: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("block", className)}
    >
      <path
        d="M12 2.5l2.94 6.35 6.86.72-5.17 4.7 1.5 6.83L12 17.77 5.87 21.1l1.5-6.83L2.2 9.57l6.86-.72L12 2.5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
