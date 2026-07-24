"use client";

/**
 * 通用空状态 —— Phase 7 三端一致性。
 *
 * 场景：
 *   - 管理端列表页无数据（商家审核、商品审核、售后仲裁 等）
 *   - 视觉与 user-web / merchant EmptyState 对齐，字号缩小以符合管理端信息密度
 *
 * 使用示例：
 *   <EmptyState
 *     icon={<span>📦</span>}
 *     title="暂无待审核商品"
 *     description="所有商品均已完成初审"
 *   />
 */

import type { ReactNode } from "react";
import clsx from "clsx";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-[color:var(--color-border)] bg-white px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 text-3xl text-neutral-400" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-medium text-neutral-700">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-xs text-neutral-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
