import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
  /** 是否作为圆形（如头像）。 */
  circle?: boolean;
}

/**
 * 骨架屏占位块。默认圆角、灰底、脉冲动画。
 * 组合使用即可拼出各种加载态占位。
 */
export function Skeleton({ className, circle }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse bg-neutral-200/70",
        circle ? "rounded-full" : "rounded-md",
        className,
      )}
    />
  );
}
