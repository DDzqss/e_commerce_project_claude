"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CategoryNav } from "@/components/catalog/CategoryNav";
import { useCart } from "@/hooks/useCart";
import { useCartBadge } from "@/lib/cart-store";

/**
 * 全站顶部导航条：
 *   第一行：品牌 logo + 搜索栏 + 购物车 + 登录/注册（或用户菜单）
 *   第二行：一级类目导航
 *
 * Phase 3 新增：
 *   - 购物车图标 + 红点数（数据源为 useCart，登录后自动订阅）
 *   - 用户菜单下拉新增 "我的订单" / "地址管理"
 *
 * 未登录也可用搜索与类目浏览（对齐契约 §5：user 端浏览接口不强制登录）。
 */
export function SiteHeader() {
  const { isLoggedIn, hasHydrated, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [keyword, setKeyword] = useState("");

  // 触发拉购物车（同时同步 badge），未登录时 hook 内部会跳过请求
  useCart();
  const cartBadgeCount = useCartBadge((s) => s.itemCount);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  const onSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const kw = keyword.trim();
    if (!kw) return;
    router.push(`/search?keyword=${encodeURIComponent(kw)}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-[color:var(--color-primary)]"
        >
          JD-Clone
        </Link>

        <form
          onSubmit={onSearchSubmit}
          role="search"
          className="flex flex-1 items-center overflow-hidden rounded-md border border-neutral-300 focus-within:border-[color:var(--color-primary)]"
        >
          <input
            type="search"
            name="keyword"
            aria-label="搜索商品"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索商品、品牌、类目"
            className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
          />
          <button
            type="submit"
            className="h-9 shrink-0 bg-[color:var(--color-primary)] px-4 text-sm text-white hover:opacity-90"
          >
            搜索
          </button>
        </form>

        <nav className="flex items-center gap-4 text-sm">
          {/* 购物车入口：登录/未登录都显示，未登录点了会被 RequireAuth 拦到登录 */}
          <Link
            href="/cart"
            className="relative flex items-center gap-1 rounded-md px-2 py-1 text-neutral-700 hover:bg-neutral-100"
            aria-label="购物车"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M3 3h2l2.4 12.3a2 2 0 002 1.7h8.5a2 2 0 002-1.6L21 8H6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="10" cy="20" r="1.5" fill="currentColor" />
              <circle cx="17" cy="20" r="1.5" fill="currentColor" />
            </svg>
            <span>购物车</span>
            {isLoggedIn && cartBadgeCount > 0 && (
              <span
                data-testid="cart-badge"
                className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[color:var(--color-primary)] px-1 text-[10px] font-semibold leading-4 text-white"
              >
                {cartBadgeCount > 99 ? "99+" : cartBadgeCount}
              </span>
            )}
          </Link>

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
                    href="/orders"
                    className="block px-3 py-2 text-neutral-700 hover:bg-neutral-100"
                    onClick={() => setOpen(false)}
                  >
                    我的订单
                  </Link>
                  <Link
                    role="menuitem"
                    href="/account/addresses"
                    className="block px-3 py-2 text-neutral-700 hover:bg-neutral-100"
                    onClick={() => setOpen(false)}
                  >
                    地址管理
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
      <div className="border-t border-neutral-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-2">
          <CategoryNav />
        </div>
      </div>
    </header>
  );
}
