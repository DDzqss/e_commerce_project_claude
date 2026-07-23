/**
 * 骨架屏（占位加载）。管理端表格 loading 首选，不用 spinner。
 */

import clsx from "clsx";
import type { HTMLAttributes } from "react";

export function Skeleton({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={clsx(
        "animate-pulse rounded bg-neutral-200/70",
        className,
      )}
      {...rest}
    />
  );
}
