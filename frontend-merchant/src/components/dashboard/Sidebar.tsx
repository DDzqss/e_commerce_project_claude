"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/Toast";

type NavItem = {
  href: string;
  label: string;
  /** 简易图标占位（emoji / 短文本），后续可替换为图标库 */
  icon: string;
  /** 未来阶段开放的项目：禁用点击 + tooltip 说明 */
  comingSoonNote?: string;
};

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "店铺看板", icon: "▮" },
  {
    href: "/orders",
    label: "订单管理",
    icon: "▤",
    comingSoonNote: "Phase 3 开放",
  },
  {
    href: "/products",
    label: "商品管理",
    icon: "▦",
  },
  { href: "/shop", label: "店铺信息", icon: "◉" },
  {
    href: "/refunds",
    label: "售后处理",
    icon: "⟲",
    comingSoonNote: "Phase 4 开放",
  },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const disabled = Boolean(item.comingSoonNote);
  const classes = cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
    active
      ? "bg-[var(--color-sidebar-active)] text-white"
      : "text-[var(--color-sidebar-foreground)] hover:bg-[var(--color-sidebar-hover)] hover:text-white",
    disabled && "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-current",
  );

  if (disabled) {
    return (
      <div
        title={item.comingSoonNote}
        aria-disabled
        className={classes}
      >
        <span aria-hidden className="w-4 text-center text-xs opacity-70">
          {item.icon}
        </span>
        <span className="flex-1">{item.label}</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
          即将
        </span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={classes}
      aria-current={active ? "page" : undefined}
    >
      <span aria-hidden className="w-4 text-center text-xs opacity-70">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

/**
 * 底部账号菜单：向上弹出的小菜单，包含修改密码 / 退出登录。
 * 与顶部 AccountMenu 提供的入口互补（顶部含店铺信息，底部为紧凑版）。
 */
function AccountBottomMenu() {
  const router = useRouter();
  const { merchantAccount, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    toast.info("已退出登录");
    router.replace("/login");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-[var(--color-sidebar-foreground)] hover:bg-[var(--color-sidebar-hover)] hover:text-white"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate">
          {merchantAccount ? merchantAccount.login_name : "账号"}
        </span>
        <span aria-hidden>▴</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute inset-x-0 bottom-full z-40 mb-1 overflow-hidden rounded-md border border-white/10 bg-[var(--color-sidebar-hover)] text-sm shadow-lg"
        >
          <Link
            role="menuitem"
            href="/account/change-password"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[var(--color-sidebar-foreground)] hover:bg-black/20 hover:text-white"
          >
            修改密码
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="block w-full px-3 py-2 text-left text-red-300 hover:bg-red-900/30 hover:text-red-100"
          >
            退出登录
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="flex h-full flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-foreground)]"
      aria-label="商家后台主导航"
    >
      {/* Logo 区域 */}
      <div className="flex h-14 items-center border-b border-white/10 px-5">
        <span className="text-base font-semibold tracking-wide text-white">
          JD-Clone 商家后台
        </span>
      </div>

      {/* 导航列表 */}
      <ul className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active =
            !item.comingSoonNote &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <NavLink item={item} active={active} />
            </li>
          );
        })}
      </ul>

      {/* 底部账号菜单 */}
      <div className="border-t border-white/10 p-3">
        <AccountBottomMenu />
        <div className="mt-2 text-[11px] text-white/50">
          v0.1.0 · Phase 1
        </div>
      </div>
    </nav>
  );
}
