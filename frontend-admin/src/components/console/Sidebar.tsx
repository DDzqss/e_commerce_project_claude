"use client";

/**
 * 左侧导航。
 *
 * Phase 1 变化：
 * - 关闭 showAllForSkeleton，改为按 `permissions` 数组 gating
 * - 保留分组结构（业务 / 运营 / 系统），未来 Phase 追加权限时无需重写
 * - Phase 1 唯一可用链接：/console/merchants/applications（商家审核）
 * - 其他项在权限未获批前用 disabled 样式展示，明示"后续 Phase 开放"
 * - active 态：pathname startsWith(item.href) 高亮
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuthStore } from "@/lib/auth-store";
import { hasAnyPermission, type Permission } from "@/lib/rbac";

interface NavItem {
  href: string;
  label: string;
  /** 该导航项所需任意一项权限即可显示（enabled） */
  requires: readonly Permission[];
  group: "business" | "operation" | "system";
  /** true 表示 Phase 1 已实现；false 表示占位（disabled） */
  available: boolean;
}

/**
 * 导航项定义。
 *
 * requires 中列出的权限键都取自 rbac.ts Permission 联合类型。
 * "商家审核" 是 Phase 1 唯一可用项；其它项目 available=false，
 * 会以 disabled 样式呈现，提示 "Phase X 开放"。
 */
const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/console/merchants/applications",
    label: "商家入驻审核",
    requires: ["admin:merchant_application:read"],
    group: "business",
    available: true,
  },
  {
    href: "/console/products",
    label: "商品审核",
    requires: ["admin:product:review"],
    group: "business",
    available: false,
  },
  {
    href: "/console/orders",
    label: "订单总览",
    requires: ["admin:order:read", "admin:order:intervene"],
    group: "business",
    available: false,
  },
  {
    href: "/console/refunds",
    label: "售后仲裁",
    requires: ["admin:refund:arbitrate"],
    group: "operation",
    available: false,
  },
  {
    href: "/console/users",
    label: "用户管理",
    requires: ["admin:user:manage"],
    group: "operation",
    available: false,
  },
  {
    href: "/console/rbac",
    label: "权限管理",
    requires: ["admin:rbac:manage"],
    group: "system",
    available: false,
  },
  {
    href: "/console/logs",
    label: "系统日志",
    requires: ["admin:audit_log:read"],
    group: "system",
    available: false,
  },
];

const GROUP_LABEL: Record<NavItem["group"], string> = {
  business: "业务",
  operation: "运营",
  system: "系统",
};

export function Sidebar() {
  const permissions = useAuthStore((s) => s.permissions);
  const pathname = usePathname();

  // 权限过滤：Phase 1 未开放的项目仍然显示（disabled），但没有权限的项目直接隐藏
  const visible = NAV_ITEMS.filter((item) =>
    hasAnyPermission(permissions, item.requires),
  );

  const groups = (["business", "operation", "system"] as const).map((g) => ({
    group: g,
    label: GROUP_LABEL[g],
    items: visible.filter((it) => it.group === g),
  }));

  return (
    <aside
      aria-label="主导航"
      className="hidden w-60 shrink-0 flex-col border-r border-[color:var(--color-border)] bg-white md:flex"
    >
      <div className="flex h-14 items-center border-b border-[color:var(--color-border)] px-4">
        <Link
          href="/console"
          className="flex items-center gap-2 text-sm font-semibold text-[color:var(--color-primary)]"
        >
          <span
            aria-hidden
            className="inline-block h-6 w-6 rounded bg-[color:var(--color-primary)]"
          />
          JD-Clone Admin
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map(({ group, label, items }) =>
          items.length === 0 ? null : (
            <div key={group} className="mb-4">
              <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                {label}
              </div>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active =
                    item.available && pathname.startsWith(item.href);
                  if (!item.available) {
                    return (
                      <li key={item.href}>
                        <div
                          className="flex cursor-not-allowed items-center justify-between rounded px-3 py-2 text-sm text-neutral-400"
                          title="后续 Phase 开放"
                        >
                          <span>{item.label}</span>
                          <span className="text-[10px] text-neutral-300">
                            即将开放
                          </span>
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={clsx(
                          "flex items-center rounded px-3 py-2 text-sm transition",
                          active
                            ? "bg-[color:var(--color-primary-100)] text-[color:var(--color-primary)] font-medium"
                            : "text-neutral-700 hover:bg-neutral-100 hover:text-[color:var(--color-primary)]",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
        )}
      </nav>

      <div className="border-t border-[color:var(--color-border)] px-4 py-3 text-[11px] text-neutral-400">
        Phase 1 · 商家入驻审核已上线
      </div>
    </aside>
  );
}
