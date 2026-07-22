import Link from "next/link";
import {
  AdminRole,
  hasAnyPermission,
  type Permission,
} from "@/lib/rbac";

interface NavItem {
  href: string;
  label: string;
  /** 该导航项所需任意一项权限即可显示 */
  requires: readonly Permission[];
  /** 分组，用于视觉分隔 */
  group: "business" | "operation" | "system";
}

/**
 * 左侧导航项定义。
 *
 * 分组遵循管理端"业务 / 运营 / 系统"三大类：
 * - 业务：商家、商品、订单（业务管理员为主）
 * - 运营：售后仲裁、用户管理（客服管理员为主）
 * - 系统：权限、日志（技术管理员为主）
 *
 * 权限门控：按当前用户角色隐藏无权入口。
 * ★ 骨架阶段（Phase 0）先允许全部展示，便于设计走查；
 *   Phase 1 引入真实鉴权后按 requires 收敛。
 */
const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/console/merchants",
    label: "商家管理",
    requires: ["merchant:list", "merchant:review"],
    group: "business",
  },
  {
    href: "/console/products",
    label: "商品审核",
    requires: ["product:list", "product:review"],
    group: "business",
  },
  {
    href: "/console/orders",
    label: "订单总览",
    requires: ["order:list", "order:intervene"],
    group: "business",
  },
  {
    href: "/console/refunds",
    label: "售后仲裁",
    requires: ["refund:list", "refund:arbitrate"],
    group: "operation",
  },
  {
    href: "/console/users",
    label: "用户管理",
    requires: ["user:list", "user:disable"],
    group: "operation",
  },
  {
    href: "/console/rbac",
    label: "权限管理",
    requires: ["rbac:manage"],
    group: "system",
  },
  {
    href: "/console/logs",
    label: "系统日志",
    requires: ["log:view"],
    group: "system",
  },
];

const GROUP_LABEL: Record<NavItem["group"], string> = {
  business: "业务",
  operation: "运营",
  system: "系统",
};

interface SidebarProps {
  role: AdminRole;
  /** 骨架阶段默认 true，Phase 1 起改为 false */
  showAllForSkeleton?: boolean;
}

export function Sidebar({ role, showAllForSkeleton = true }: SidebarProps) {
  const visible = NAV_ITEMS.filter(
    (item) => showAllForSkeleton || hasAnyPermission(role, item.requires),
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
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center rounded px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-[color:var(--color-primary)]"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </nav>

      <div className="border-t border-[color:var(--color-border)] px-4 py-3 text-[11px] text-neutral-400">
        Phase 0 · 骨架
      </div>
    </aside>
  );
}
