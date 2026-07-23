import { cn } from "@/lib/cn";

/**
 * 金额格式化：把整数分转成 "¥1,234.56"（默认 2 位小数）。
 * 契约要求金额一律以整数分传输，展示层负责转换与本地化。
 */
export function formatYuan(cents: number, options?: {
  withSymbol?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string {
  const {
    withSymbol = true,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options ?? {};
  const yuan = cents / 100;
  const formatted = yuan.toLocaleString("zh-CN", {
    minimumFractionDigits,
    maximumFractionDigits,
  });
  return withSymbol ? `¥${formatted}` : formatted;
}

interface PriceProps {
  /** 现价（整数分） */
  cents: number;
  /** 划线价（整数分），> cents 时展示 */
  originalCents?: number | null;
  /** 价格区间末端；给出时展示 "¥1.00 ~ ¥2.00" */
  maxCents?: number | null;
  /** 主价体积：base=常规、lg=详情页大号、sm=卡片小号 */
  size?: "sm" | "base" | "lg";
  className?: string;
  /** 是否强调主色红字（默认 true） */
  highlight?: boolean;
}

/**
 * 商品价格显示组件。
 *
 * 用法：
 *   <Price cents={9900} />
 *   <Price cents={9900} originalCents={12900} />
 *   <Price cents={799900} maxCents={1099900} size="lg" />
 */
export function Price({
  cents,
  originalCents,
  maxCents,
  size = "base",
  className,
  highlight = true,
}: PriceProps) {
  const showRange =
    typeof maxCents === "number" && maxCents > cents;
  const showOriginal =
    typeof originalCents === "number" && originalCents > cents;

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-2",
        className,
      )}
    >
      <span
        className={cn(
          "font-semibold tabular-nums",
          highlight && "text-[color:var(--color-primary)]",
          size === "sm" && "text-sm",
          size === "base" && "text-base",
          size === "lg" && "text-2xl",
        )}
      >
        {formatYuan(cents)}
        {showRange && (
          <span className="mx-1 text-neutral-400">~</span>
        )}
        {showRange && formatYuan(maxCents)}
      </span>
      {showOriginal && (
        <span className="text-xs text-neutral-400 line-through">
          {formatYuan(originalCents)}
        </span>
      )}
    </span>
  );
}
