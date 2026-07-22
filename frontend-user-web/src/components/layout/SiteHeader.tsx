"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * 全站顶部导航条：
 * - 左侧品牌 logo（回首页）
 * - 右侧：未登录 → "登录 / 注册" 链接；已登录 → 昵称头像 + 下拉菜单
 *
 * 使用 useAuth 判断登录态；未 hydrate 时先渲染占位骨架，避免 SSR/CSR 结果不一致导致的闪跳。
 */
export function SiteHeader() {
  const { isLoggedIn, hasHydrated, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-[color:var(--color-primary)]"
        >
          JD-Clone
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {!hasHydrated ? (
            <div className="h-6 w-24 animate-pulse rounded bg-neutral-100" />
          ) : isLoggedIn && user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-neutral-100"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-primary-100)] text-xs font-medium text-[color:var(--color-primary-700)]"
                >
                  {user.nickname.slice(0, 1)}
                </span>
                <span className="text-neutral-700">{user.nickname}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {open && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-md border border-neutral-200 bg-white text-sm shadow-lg"
                >
                  <Link
                    role="menuitem"
                    href="/account/profile"
                    className="block px-3 py-2 text-neutral-700 hover:bg-neutral-100"
                    onClick={() => setOpen(false)}
                  >
                    我的账户
                  </Link>
                  <Link
                    role="menuitem"
                    href="/account/merchant-apply"
                    className="block px-3 py-2 text-neutral-700 hover:bg-neutral-100"
                    onClick={() => setOpen(false)}
                  >
                    商家入驻
                  </Link>
                  <button
                    role="menuitem"
                    type="button"
                    className="block w-full border-t border-neutral-100 px-3 py-2 text-left text-neutral-700 hover:bg-neutral-100"
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-neutral-600 hover:text-[color:var(--color-primary)]"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-[color:var(--color-primary)] px-3 py-1.5 text-white hover:opacity-90"
              >
                注册
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
