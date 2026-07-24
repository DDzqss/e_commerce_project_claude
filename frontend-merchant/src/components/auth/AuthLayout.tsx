"use client";

import type { ReactNode } from "react";

/**
 * 认证页外壳（登录 / 修改密码等）。
 * 商家 logo + 商务感淡蓝渐变背景。
 */
export interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo 与副标题 */}
        <header className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-[var(--color-primary)] text-white shadow-sm">
            <span aria-hidden className="text-lg font-bold">
              M
            </span>
          </div>
          <h1 className="text-lg font-semibold text-neutral-900">
            JD-Clone 商家后台
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            专业化店铺运营平台
          </p>
        </header>

        {/* 卡片 */}
        <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-neutral-900">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
            ) : null}
          </div>
          {children}
        </section>

        {footer ? (
          <footer className="mt-4 text-center text-xs text-neutral-500">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
