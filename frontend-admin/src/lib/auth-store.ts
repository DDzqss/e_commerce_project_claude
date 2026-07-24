"use client";

/**
 * 管理员会话状态 (Zustand)。
 *
 * 存储内容：
 * - accessToken / refreshToken (Phase 1 使用 localStorage 持久化；
 *   非 httpOnly cookie 有 XSS 风险，Phase 后续可切换到 secure cookie)
 * - admin (AdminOut 摘要，用于 Header 展示)
 * - permissions (来自 GET /api/v1/admin/me，用于前端 gating)
 * - status ("idle" | "loading" | "authenticated" | "unauthenticated")
 *
 * 使用约定：
 * - 登录成功后调用 setSession(...)；随后再调用 setPermissions(...)（拉 /me 后）
 * - 401 拦截或退出时调用 clearSession()
 * - 组件读取时用 useAuthStore(selector) 保持精细订阅
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AdminOut } from "@/types/api";
import type { Permission } from "@/lib/rbac";

/** 会话状态枚举 */
export type AuthStatus =
  | "idle" // SSR / 未 hydrate
  | "loading" // 登录 / 刷新中
  | "authenticated"
  | "unauthenticated";

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  admin: AdminOut | null;
  permissions: Permission[];
  status: AuthStatus;
  /** 是否记住登录（false 时页面刷新丢失，仅内存保留） */
  remember: boolean;

  // ------- actions -------
  setSession: (payload: {
    accessToken: string;
    refreshToken: string;
    admin: AdminOut;
    remember?: boolean;
  }) => void;
  setPermissions: (permissions: Permission[]) => void;
  setAdmin: (admin: AdminOut) => void;
  updateTokens: (payload: { accessToken: string; refreshToken: string }) => void;
  setStatus: (status: AuthStatus) => void;
  clearSession: () => void;
}

const INITIAL_STATE = {
  accessToken: null,
  refreshToken: null,
  admin: null,
  permissions: [] as Permission[],
  status: "idle" as AuthStatus,
  remember: true,
};

/**
 * 内部 storage 选择：remember=true 用 localStorage 持久化；否则用 sessionStorage。
 * Phase 1 简化：统一 localStorage，remember=false 时登出流程会主动清空。
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setSession: ({ accessToken, refreshToken, admin, remember = true }) =>
        set({
          accessToken,
          refreshToken,
          admin,
          remember,
          status: "authenticated",
        }),

      setPermissions: (permissions) => set({ permissions }),

      setAdmin: (admin) => set({ admin }),

      updateTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken }),

      setStatus: (status) => set({ status }),

      clearSession: () =>
        set({
          ...INITIAL_STATE,
          status: "unauthenticated",
        }),
    }),
    {
      name: "admin-auth",
      storage: createJSONStorage(() => {
        // SSR 环境或不安全上下文（jsdom opaque origin、file:// 协议等）
        // 访问 window.localStorage 会抛 SecurityError，一律回退到内存 Map。
        try {
          if (typeof window === "undefined") throw new Error("ssr");
          // 触发 opaque-origin SecurityError 检查
          const probeKey = "__admin_auth_probe__";
          window.localStorage.setItem(probeKey, "1");
          window.localStorage.removeItem(probeKey);
          return window.localStorage;
        } catch {
          const memory = new Map<string, string>();
          return {
            getItem: (name: string) => memory.get(name) ?? null,
            setItem: (name: string, value: string) => {
              memory.set(name, value);
            },
            removeItem: (name: string) => {
              memory.delete(name);
            },
          };
        }
      }),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        admin: state.admin,
        permissions: state.permissions,
        remember: state.remember,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // hydrate 后根据是否有 token 推断状态
        state.status = state.accessToken ? "authenticated" : "unauthenticated";
      },
    },
  ),
);

/**
 * 非 React 场景（如 api.ts hook）读取 token 的同步方法。
 */
export function getAccessTokenSync(): string | null {
  return useAuthStore.getState().accessToken;
}

export function getRefreshTokenSync(): string | null {
  return useAuthStore.getState().refreshToken;
}
