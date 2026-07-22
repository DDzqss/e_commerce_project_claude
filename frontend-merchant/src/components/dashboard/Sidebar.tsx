"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  /** 简易图标占位（emoji / 短文本），后续可替换为图标库 */
  icon: string;
};

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "店铺看板", icon: "▮" },
  { href: "/orders", label: "订单管理", icon: "▤" },
  { href: "/products", label: "商品管理", icon: "▦" },
  { href: "/shop", label: "店铺信息", icon: "◉" },
  { href: "/refunds", label: "售后处理", icon: "⟲" },
];

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
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={[
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[var(--color-sidebar-active)] text-white"
                    : "text-[var(--color-sidebar-foreground)] hover:bg-[var(--color-sidebar-hover)] hover:text-white",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden className="w-4 text-center text-xs opacity-70">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* 底部信息占位 */}
      <div className="border-t border-white/10 p-4 text-xs text-white/60">
        v0.0.0 · 骨架占位
      </div>
    </nav>
  );
}
