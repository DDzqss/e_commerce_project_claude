"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface EmptyStateProps {
  /** 顶部图形（如 emoji / SVG），可选。 */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** CTA 按钮（可选，直接传 JSX，通常用 <Button> 或 <Link>）。 */
  action?: ReactNode;
  className?: string;
}

/**
 * 通用空状态 —— Phase 7 三端一致性。
 *   - 商家后台列表页无数据（订单/商品/售后 等）
 *   - 与 user-web / admin 的 EmptyState 视觉一致，仅字号/间距略作调整
 *
 * 保持无业务耦合：只做布局与文案，图标/按钮全由调用方注入。
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 text-4xl text-neutral-400" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-medium text-neutral-700">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-xs text-neutral-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
