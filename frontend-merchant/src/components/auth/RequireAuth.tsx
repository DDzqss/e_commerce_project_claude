"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useMerchantAuthStore } from "@/lib/auth-store";
import { Skeleton } from "@/components/ui/Skeleton";

function LoadingFallback() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * 客户端登录守卫内部实现：使用 useSearchParams，需要 Suspense 边界。
 */
function RequireAuthInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const hydrated = useMerchantAuthStore((s) => s.hydrated);
  const authed = useMerchantAuthStore((s) =>
    Boolean(s.accessToken && s.merchantAccount),
  );

  useEffect(() => {
    if (!hydrated) return;
    if (authed) return;
    const qs = search?.toString();
    const current = qs ? `${pathname}?${qs}` : pathname;
    const next = encodeURIComponent(current || "/dashboard");
    router.replace(`/login?next=${next}`);
  }, [hydrated, authed, pathname, search, router]);

  if (!hydrated || !authed) return <LoadingFallback />;
  return <>{children}</>;
}

/**
 * 客户端登录守卫：未登录跳 `/login?next=<current>`。
 *
 * - SSR 时 hydrated 为 false，我们展示骨架而非立刻判定"未登录"（否则会闪跳登录页）。
 * - hydrated 之后若 store 无 accessToken 才跳转。
 * - 使用 Suspense 包裹以满足 Next 15 对 useSearchParams 的静态导出要求。
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RequireAuthInner>{children}</RequireAuthInner>
    </Suspense>
  );
}
