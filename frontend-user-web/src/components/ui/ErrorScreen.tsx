"use client";

import type { ReactNode } from "react";

import { Button } from "./Button";
import { cn } from "@/lib/cn";

interface ErrorScreenProps {
  /** 顶部图形（如 emoji / SVG），默认警告三角。 */
  icon?: ReactNode;
  title?: string;
  description?: string;
  /** 主 CTA 文案，默认"重试"。 */
  retryText?: string;
  /** 触发重试；若省略则不显示重试按钮（少见）。 */
  onRetry?: () => void;
  /** 次 CTA（如"回到首页"）。 */
  secondaryAction?: ReactNode;
  className?: string;
}

/**
 * 通用错误屏 —— Phase 7 三端一致性。
 *
 * 用于：
 *   - fetch 列表失败（useQuery isError）
 *   - 页面级异常（订单不存在等）
 *
 * 保持无业务耦合：只承担布局 + 主 CTA；具体 refetch 逻辑由调用方提供。
 */
export function ErrorScreen({
  icon,
  title = "加载失败",
  description = "网络不稳定或服务暂时不可用，请稍后重试。",
  retryText = "重试",
  onRetry,
  secondaryAction,
  className,
}: ErrorScreenProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-neutral-200 bg-white px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 text-4xl" aria-hidden>
        {icon ?? "⚠️"}
      </div>
      <h3 className="text-sm font-medium text-neutral-800">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-neutral-500">{description}</p>
      {(onRetry || secondaryAction) && (
        <div className="mt-5 flex items-center justify-center gap-2">
          {onRetry ? (
            <Button variant="primary" size="md" onClick={onRetry}>
              {retryText}
            </Button>
          ) : null}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
