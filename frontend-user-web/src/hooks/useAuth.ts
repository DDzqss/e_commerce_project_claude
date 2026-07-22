"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useAuthStore,
  getRefreshToken,
} from "@/lib/auth-store";
import { logout as logoutApi } from "@/lib/auth-api";

/**
 * 高阶封装：认证相关状态与常用动作。
 *
 * - `isLoggedIn`: 有 accessToken 且 hydrate 完成
 * - `hasHydrated`: persist 恢复是否完成（用于避免 SSR/首屏闪跳）
 * - `logout()`: 调后端登出接口（best effort）→ 清 store → 跳登录
 */
export function useAuth() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const clear = useAuthStore((s) => s.logout);

  const logout = useCallback(
    async (redirectTo = "/login") => {
      const rt = getRefreshToken();
      // 后端登出失败不影响本地清理体验
      try {
        await logoutApi(rt);
      } catch {
        // ignore
      }
      clear();
      router.push(redirectTo);
    },
    [clear, router],
  );

  return {
    accessToken,
    user,
    hasHydrated,
    isLoggedIn: hasHydrated && Boolean(accessToken && user),
    logout,
  };
}
