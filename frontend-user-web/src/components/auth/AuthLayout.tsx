"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * 登录 / 注册 / 忘记密码等公共布局：
 * - 页面居中卡片
 * - 顶部展示品牌 logo（文字版即可，Phase 1 无 SVG）
 * - 底部承载"没有账号？去注册"这类跳转
 */
export function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight text-[color:var(--color-primary)]"
          >
            JD-Clone
          </Link>
          <span className="text-xs text-neutral-500">
            购物就上 JD-Clone，正品好物一站直达
          </span>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
        {footer && (
          <div className="mt-4 text-center text-sm text-neutral-500">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
