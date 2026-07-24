"use client";

/**
 * 后台管理路由组 (console) 布局。
 *
 * Phase 1 变化：
 * - 由 server component 改为 client component（需要读 zustand + router.replace）
 * - 在渲染业务前做鉴权守卫：
 *   1. hydrate 完成前显示 loading（避免 SSR 与 CSR 不匹配的闪现）
 *   2. 未登录 → router.replace("/login?redirect=<current>")
 *   3. 已登录但尚未 fetch /me 权限 → 尝试拉一次，失败即视为过期
 * - 布局结构不变：Sidebar + Header + main
 */

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/console/Sidebar";
import { Header } from "@/components/console/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/auth-store";
import { getAdminMe } from "@/lib/admin-api";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  const permissions = useAuthStore((s) => s.permissions);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const clearSession = useAuthStore((s) => s.clearSession);
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  // Zustand persist 是异步 hydrate，等待一 tick 避免 SSR/CSR 不一致
  useEffect(() => {
    setHydrated(true);
  }, []);

  // 未登录跳转
  useEffect(() => {
    if (!hydrated) return;
    if (status === "unauthenticated" || !accessToken) {
      const redirect = encodeURIComponent(pathname || "/console");
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [hydrated, status, accessToken, pathname, router]);

  // 已登录但没有权限 → 拉一次 /me（可能是刷新页面后 permissions 还没恢复的极端场景）
  useEffect(() => {
    if (!hydrated) return;
    if (status !== "authenticated") return;
    if (permissions.length > 0) return;
    let cancelled = false;
    getAdminMe()
      .then((me) => {
        if (cancelled) return;
        setPermissions(me.permissions);
        setAdmin(me.admin);
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    status,
    permissions.length,
    setPermissions,
    setAdmin,
    clearSession,
    router,
  ]);

  if (!hydrated || status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-400">
        正在校验登录状态…
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen w-full bg-[color:var(--color-surface-muted)]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
