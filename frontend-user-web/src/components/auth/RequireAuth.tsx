"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * 客户端路由守卫：将子组件包起来后，未登录用户会被踢到 /login?next=当前路径。
 *
 * 之所以放弃 middleware：本项目 token 存在 localStorage 而不是 cookie，
 * Next.js middleware 在 edge 环境读不到 localStorage，无法准确判断登录态。
 * 客户端 wrapper 更契合 Phase 1 的会话存储方案。
 *
 * 使用：
 *   export default function ProfilePage() {
 *     return (
 *       <RequireAuth>
 *         <ProfileContent />
 *       </RequireAuth>
 *     );
 *   }
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!accessToken) {
      const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [accessToken, hasHydrated, pathname, router]);

  // 未 hydrate 或未登录时展示骨架，避免闪现受保护内容
  if (!hasHydrated || !accessToken) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
