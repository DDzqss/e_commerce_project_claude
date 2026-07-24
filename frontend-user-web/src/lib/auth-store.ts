/**
 * 认证状态 Store（客户端）。
 *
 * 职责：
 * - 持有 access/refresh token 与当前用户信息
 * - 提供 login/setSession/updateUser/logout 方法
 * - 通过 zustand/middleware 的 persist 将状态镜像到 localStorage，
 *   刷新页面后依然保持登录（Phase 1 不启用 SSR 场景，纯客户端存储足够）
 *
 * 注意：本 store 不发起任何网络请求，网络行为放在 lib/auth-api.ts / lib/api.ts。
 * 这样 store 可以被 lib/api.ts 直接依赖而不会形成循环。
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserOut, AuthResult } from "@/types/api";

/**
 * localStorage key，避免与其他项目冲突。
 * 若结构不兼容升级，直接改 version 让老数据被丢弃。
 */
const STORAGE_KEY = "user-web-auth-v1";

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserOut | null;
  /** persist rehydrate 完成标志，UI 应等到 true 再做未登录跳转判定。 */
  hasHydrated: boolean;
}

export interface AuthActions {
  /** 登录/注册成功后落地会话。 */
  login: (payload: AuthResult) => void;
  /** 单独更新 token（refresh 场景）。 */
  setTokens: (tokens: {
    accessToken: string;
    refreshToken: string;
  }) => void;
  /** 单独更新用户资料（改昵称、拉取 /me 后）。 */
  updateUser: (patch: Partial<UserOut>) => void;
  /** 覆盖整份 user（如 /me 首次拉取）。 */
  setUser: (user: UserOut | null) => void;
  /** 清空会话（登出、refresh 失败）。 */
  logout: () => void;
  /** 内部：标记 rehydrate 完成。 */
  _setHydrated: (v: boolean) => void;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  hasHydrated: false,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      login: (payload) =>
        set({
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
          user: payload.user,
        }),

      setTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken }),

      updateUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : state.user,
        })),

      setUser: (user) => set({ user }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
        }),

      _setHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        // SSR guard：Next.js 在服务端渲染时没有 localStorage。
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return window.localStorage;
      }),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated(true);
      },
    },
  ),
);

/**
 * 读取当前 access token（供 lib/api.ts 在请求拦截里调用，避免 React hook 依赖）。
 */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

/**
 * 读取当前 refresh token。
 */
export function getRefreshToken(): string | null {
  return useAuthStore.getState().refreshToken;
}

/**
 * 判断是否已登录（有 access token 且有 user）。
 */
export function isAuthenticated(): boolean {
  const { accessToken, user } = useAuthStore.getState();
  return Boolean(accessToken && user);
}
