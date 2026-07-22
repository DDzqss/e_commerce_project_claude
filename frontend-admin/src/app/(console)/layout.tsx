import type { ReactNode } from "react";
import { Sidebar } from "@/components/console/Sidebar";
import { Header } from "@/components/console/Header";
import { AdminRole } from "@/lib/rbac";

/**
 * 后台管理路由组的布局：左侧 Sidebar + 顶部 Header + 主内容区。
 *
 * 布局约束：
 * - Sidebar 固定 240px，可后续引入折叠状态
 * - Header 固定 56px，展示当前用户与角色 badge
 * - 主区域可滚动，背景使用 --color-surface-muted，与卡片形成层级
 *
 * 鉴权守卫（Phase 1 引入）：
 *   const session = await getServerSession();
 *   if (!session) redirect("/login");
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  // TODO(Phase 1): 从 server session / cookie 中解析真实用户
  const currentUser = {
    name: "占位管理员",
    role: AdminRole.SUPER_ADMIN,
  };

  return (
    <div className="flex min-h-screen w-full bg-[color:var(--color-surface-muted)]">
      <Sidebar role={currentUser.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header userName={currentUser.name} role={currentUser.role} />
        <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
