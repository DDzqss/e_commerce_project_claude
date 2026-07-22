import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
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
          <div className="text-xs text-neutral-500">未登录（占位）</div>
        </header>

        {/* 主内容 */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
