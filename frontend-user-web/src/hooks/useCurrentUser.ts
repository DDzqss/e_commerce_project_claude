"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/auth-api";
import { useAuth } from "./useAuth";

/**
 * 获取当前登录用户的完整 profile（含入驻申请状态、商家账号 ID）。
 *
 * - 只在已登录时启用请求
 * - staleTime 60s：短时间内多个页面复用同一份数据
 * - 失败自动交给 lib/api 的 401 拦截处理
 */
export function useCurrentUser() {
  const { isLoggedIn, hasHydrated } = useAuth();
  return useQuery({
    queryKey: ["user", "me"],
    queryFn: fetchMe,
    enabled: hasHydrated && isLoggedIn,
    staleTime: 60_000,
  });
}
