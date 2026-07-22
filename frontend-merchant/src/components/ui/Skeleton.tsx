"use client";

import { cn } from "@/lib/cn";

export interface SkeletonProps {
  className?: string;
}

/**
 * 骨架屏：包一层灰底 + 呼吸动画。
 * 常用于列表/详情加载占位。
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded bg-neutral-200/70",
        className,
      )}
    />
  );
}
