"use client";

import { cn } from "@/lib/cn";

interface PaginationProps {
  page: number;
  size: number;
  total: number;
  onChange: (nextPage: number) => void;
  className?: string;
}

/**
 * 简版分页：上一页 / 页码序列 / 下一页。
 *
 * 页码显示逻辑：始终首末页 + 当前页附近 2 页，其余折叠为 …。
 * onChange 只在实际发生变化时触发。
 */
export function Pagination({
  page,
  size,
  total,
  onChange,
  className,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, size)));
  if (pageCount <= 1) return null;

  const go = (p: number) => {
    const next = Math.min(pageCount, Math.max(1, p));
    if (next !== page) onChange(next);
  };

  const pages = buildPageList(page, pageCount);

  return (
    <nav
      aria-label="分页"
      className={cn(
        "flex items-center justify-center gap-1 text-sm text-neutral-700",
        className,
      )}
    >
      <PagerButton disabled={page <= 1} onClick={() => go(page - 1)}>
        上一页
      </PagerButton>
      {pages.map((p, idx) =>
        p === "..." ? (
          <span key={`gap-${idx}`} className="px-2 text-neutral-400">
            …
          </span>
        ) : (
          <PagerButton
            key={p}
            active={p === page}
            onClick={() => go(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </PagerButton>
        ),
      )}
      <PagerButton disabled={page >= pageCount} onClick={() => go(page + 1)}>
        下一页
      </PagerButton>
      <span className="ml-2 text-xs text-neutral-500">共 {total} 件</span>
    </nav>
  );
}

function PagerButton({
  active,
  disabled,
  onClick,
  children,
  ...rest
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  "aria-current"?: "page";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-w-8 rounded border px-2 py-1 text-xs",
        active
          ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-[color:var(--color-primary)]",
        disabled && "cursor-not-allowed opacity-50 hover:border-neutral-200",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * 生成页码显示序列：始终包含 1、pageCount、当前页附近 2 页；
 * 中间断层用 "..." 占位。
 */
export function buildPageList(page: number, pageCount: number): (number | "...")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, pageCount, page, page - 1, page + 1, page - 2, page + 2]);
  const arr = Array.from(set)
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);

  const out: (number | "...")[] = [];
  for (let i = 0; i < arr.length; i++) {
    const cur = arr[i]!;
    if (i > 0 && cur - arr[i - 1]! > 1) out.push("...");
    out.push(cur);
  }
  return out;
}
