"use client";

/**
 * Auth 相关 hooks 集合。
 *
 * - useAuth(): 返回登录状态 + 关键动作（login/logout/refresh）
 * - useAdmin(): 快捷读取当前 admin 摘要
 * - usePermission(perm): 判断当前 admin 是否具备某权限
 */

import { useCallback } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { loginAdmin, logoutAdmin, type LoginPayload } from "@/lib/auth-api";
import { getAdminMe } from "@/lib/admin-api";
import type { AdminOut } from "@/types/api";
import { hasPermission, type Permission } from "@/lib/rbac";

/**
 * 主 auth hook：暴露状态 + 便捷动作。
 * 页面层不应直接调用 setSession 等 store action，统一走这里。
 */
export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const admin = useAuthStore((s) => s.admin);
  const permissions = useAuthStore((s) => s.permissions);
  const setSession = useAuthStore((s) => s.setSession);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const setStatus = useAuthStore((s) => s.setStatus);
  const clearSession = useAuthStore((s) => s.clearSession);
  const getRefreshToken = useCallback(
    () => useAuthStore.getState().refreshToken,
    [],
  );

  /**
   * 登录 + 拉取 /me 权限。remember=true 走 localStorage 持久化。
   */
  const login = useCallback(
    async (payload: LoginPayload, remember = true) => {
      setStatus("loading");
      try {
        const res = await loginAdmin(payload);
        setSession({
          accessToken: res.access_token,
          refreshToken: res.refresh_token,
          admin: res.admin,
          remember,
        });
        // 拉 /me 获取权限清单
        try {
          const me = await getAdminMe();
          setPermissions(me.permissions);
          // 用 me.admin 覆盖登录响应中的摘要（防两处不一致）
          useAuthStore.getState().setAdmin(me.admin);
        } catch {
          // 权限拉取失败不阻塞登录成功；后续操作若无权限会被守卫拦截
          setPermissions([]);
        }
        return res.admin;
      } catch (err) {
        setStatus("unauthenticated");
        throw err;
      }
    },
    [setSession, setPermissions, setStatus],
  );

  /**
   * 登出：调 revoke 端点后清空本地 session。
   * 即便 API 失败也强制清空（避免用户被卡住）。
   */
  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      await logoutAdmin(refreshToken);
    } catch {
      // 忽略，仍要清空本地
    } finally {
      clearSession();
    }
  }, [clearSession, getRefreshToken]);

  return {
    status,
    admin,
    permissions,
    isAuthenticated: status === "authenticated",
    login,
    logout,
  };
}

/**
 * 便捷读取 admin 对象（可能为 null）。
 */
export function useAdmin(): AdminOut | null {
  return useAuthStore((s) => s.admin);
}

/**
 * 判断当前 admin 是否具备某权限。用于组件内条件渲染按钮。
 */
export function usePermission(permission: Permission): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  return hasPermission(permissions, permission);
}
