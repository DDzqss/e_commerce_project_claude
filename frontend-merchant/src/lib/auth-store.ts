/**
 * 商家端会话状态（accessToken / refreshToken / merchantAccount / shop）。
 *
 * - 使用 zustand + localStorage 持久化，避免刷新丢失会话。
 * - 与用户端 (frontend-user-web) 完全独立：storage key 不同、shape 不同。
 * - **注意**：本 store 只是快照缓存；受信来源仍是后端 `GET /api/v1/merchant/me`，
 *   页面加载后应显式 refresh 一次 me，防止 shop 信息被后端更新后前端不知。
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { MerchantAccountOut, ShopOut, TokenPair } from "@/types/api";

export interface MerchantAuthSnapshot {
  accessToken: string;
  refreshToken: string;
  merchantAccount: MerchantAccountOut;
  shop: ShopOut;
}

interface MerchantAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  merchantAccount: MerchantAccountOut | null;
  shop: ShopOut | null;
  /** 是否已从 localStorage 完成一次 hydration。SSR 期间 / 首挂载前为 false。 */
  hydrated: boolean;

  /** 登录成功 / refresh 成功后写入。 */
  setSession: (payload: MerchantAuthSnapshot | TokenPair) => void;
  /** 仅更新 tokens（silent refresh 场景）。 */
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  /** 更新 shop 快照（编辑店铺信息后调用）。 */
  setShop: (shop: ShopOut) => void;
  /** 更新 merchantAccount 快照（如角色/状态变化）。 */
  setMerchantAccount: (account: MerchantAccountOut) => void;
  /** 登出：清空全部状态。 */
  clear: () => void;
  /** 便捷判断。 */
  isAuthenticated: () => boolean;
  /** hydration 完成钩子，仅供 persist middleware 内部调用。 */
  _markHydrated: () => void;
}

const STORAGE_KEY = "merchant-auth-v1";

/**
 * 将 TokenPair (来自登录/refresh 接口) 规范化为 snapshot。
 * TokenPair 使用 snake_case，snapshot 使用 camelCase。
 */
function normalizeSnapshot(
  payload: MerchantAuthSnapshot | TokenPair,
): MerchantAuthSnapshot {
  if ("access_token" in payload) {
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      merchantAccount: payload.merchant_account,
      shop: payload.shop,
    };
  }
  return payload;
}

export const useMerchantAuthStore = create<MerchantAuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      merchantAccount: null,
      shop: null,
      hydrated: false,

      setSession: (payload) => {
        const snap = normalizeSnapshot(payload);
        set({
          accessToken: snap.accessToken,
          refreshToken: snap.refreshToken,
          merchantAccount: snap.merchantAccount,
          shop: snap.shop,
        });
      },

      setTokens: ({ accessToken, refreshToken }) => {
        set({ accessToken, refreshToken });
      },

      setShop: (shop) => set({ shop }),

      setMerchantAccount: (merchantAccount) => set({ merchantAccount }),

      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          merchantAccount: null,
          shop: null,
        }),

      isAuthenticated: () => {
        const { accessToken, merchantAccount } = get();
        return Boolean(accessToken && merchantAccount);
      },

      _markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        // 在 SSR / 测试环境（部分 jsdom 版本不提供 localStorage）下回退到 no-op storage。
        if (typeof window === "undefined" || !window.localStorage) {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        merchantAccount: state.merchantAccount,
        shop: state.shop,
      }),
      onRehydrateStorage: () => (state) => {
        // rehydrate 完成后置位；受保护页面据此决定是否显示 loading。
        state?._markHydrated();
      },
    },
  ),
);
