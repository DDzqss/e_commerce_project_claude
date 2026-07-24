import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AccountMenu } from "@/components/dashboard/AccountMenu";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { MerchantMeBoot } from "@/components/auth/MerchantMeBoot";

/**
 * 强制动态渲染：本布局及子页面全部依赖登录态（客户端 store），
 * 不适合 Next 的静态导出（会命中 useSearchParams 的 SSG bailout）。
 */
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireAuth>
      {/* 登录后拉取一次 GET /merchant/me，覆盖 store 快照 */}
      <MerchantMeBoot />
      <div className="flex min-h-screen">
        {/* 左侧固定 sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 shrink-0 md:block">
          <Sidebar />
        </aside>

        {/* 右侧主内容区（预留 sidebar 宽度） */}
        <div className="flex min-h-screen flex-1 flex-col md:pl-60">
          {/* 顶部条 */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
            <h1 className="text-sm font-medium text-neutral-700">
              商家后台管理系统
            </h1>
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <AccountMenu />
            </div>
          </header>

          {/* 主内容 */}
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
