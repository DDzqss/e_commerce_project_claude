"use client";

/**
 * 通用错误屏 —— Phase 7 三端一致性。
 *
 * 用于管理端列表 / 详情加载失败：icon + 文案 + "重试"主按钮。
 * 视觉与 user-web / merchant ErrorScreen 对齐，字号缩小以符合管理端信息密度。
 */

import type { ReactNode } from "react";
import clsx from "clsx";
import { Button } from "./Button";

interface ErrorScreenProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  retryText?: string;
  onRetry?: () => void;
  secondaryAction?: ReactNode;
  className?: string;
}

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
      className={clsx(
        "flex flex-col items-center justify-center rounded-md border border-[color:var(--color-border)] bg-white px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-3 text-3xl" aria-hidden>
        {icon ?? "⚠️"}
      </div>
      <h3 className="text-sm font-medium text-neutral-800">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-neutral-500">{description}</p>
      {(onRetry || secondaryAction) && (
        <div className="mt-4 flex items-center justify-center gap-2">
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
