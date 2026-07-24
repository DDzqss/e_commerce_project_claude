"use client";

import type { ReactNode } from "react";

import { Button } from "./Button";
import { cn } from "@/lib/cn";

interface ErrorScreenProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  retryText?: string;
  onRetry?: () => void;
  secondaryAction?: ReactNode;
  className?: string;
}

/**
 * 通用错误屏 —— Phase 7 三端一致性。
 *
 * 商家后台列表 / 详情加载失败时展示：icon + 文案 + "重试"主按钮。
 * 与 user-web / admin ErrorScreen 视觉一致。
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
        "flex flex-col items-center justify-center rounded-lg border border-neutral-200 bg-white px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-3 text-4xl" aria-hidden>
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
