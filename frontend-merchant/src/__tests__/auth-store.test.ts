/**
 * auth-store 单测。
 *
 * 关注点：
 *  - setSession 能接受 TokenPair (snake_case) 与 snapshot (camelCase) 两种形态
 *  - clear() 会重置所有关键字段
 *  - isAuthenticated 反映真实状态
 */

import { beforeEach, describe, expect, it } from "vitest";

import { useMerchantAuthStore } from "@/lib/auth-store";
import type { MerchantAccountOut, ShopOut, TokenPair } from "@/types/api";

const fakeAccount: MerchantAccountOut = {
  id: 1,
  user_id: 100,
  login_name: "shop1_owner",
  shop_id: 200,
  role: "SHOP_OWNER",
  status: "active",
  last_login_at: null,
  created_at: "2026-07-22T00:00:00Z",
  updated_at: "2026-07-22T00:00:00Z",
};

const fakeShop: ShopOut = {
  id: 200,
  name: "示例店铺",
  description: "示例简介",
  contact_name: "李明",
  contact_phone: "13800001111",
  status: "active",
  created_at: "2026-07-22T00:00:00Z",
  updated_at: "2026-07-22T00:00:00Z",
};

const fakeTokenPair: TokenPair = {
  merchant_account: fakeAccount,
  shop: fakeShop,
  access_token: "access-abc",
  refresh_token: "refresh-xyz",
  expires_in: 900,
};

describe("useMerchantAuthStore", () => {
  beforeEach(() => {
    useMerchantAuthStore.getState().clear();
    window.localStorage.clear();
  });

  it("初始状态为未登录", () => {
    const state = useMerchantAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.merchantAccount).toBeNull();
    expect(state.shop).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it("setSession 接受 TokenPair（snake_case）", () => {
    useMerchantAuthStore.getState().setSession(fakeTokenPair);
    const state = useMerchantAuthStore.getState();
    expect(state.accessToken).toBe("access-abc");
    expect(state.refreshToken).toBe("refresh-xyz");
    expect(state.merchantAccount?.login_name).toBe("shop1_owner");
    expect(state.shop?.name).toBe("示例店铺");
    expect(state.isAuthenticated()).toBe(true);
  });

  it("setSession 接受 snapshot（camelCase）", () => {
    useMerchantAuthStore.getState().setSession({
      accessToken: "at",
      refreshToken: "rt",
      merchantAccount: fakeAccount,
      shop: fakeShop,
    });
    expect(useMerchantAuthStore.getState().accessToken).toBe("at");
    expect(useMerchantAuthStore.getState().refreshToken).toBe("rt");
  });

  it("setTokens 只更新 tokens，不动 account/shop", () => {
    useMerchantAuthStore.getState().setSession(fakeTokenPair);
    useMerchantAuthStore.getState().setTokens({
      accessToken: "new-at",
      refreshToken: "new-rt",
    });
    const state = useMerchantAuthStore.getState();
    expect(state.accessToken).toBe("new-at");
    expect(state.refreshToken).toBe("new-rt");
    expect(state.merchantAccount?.id).toBe(fakeAccount.id);
    expect(state.shop?.id).toBe(fakeShop.id);
  });

  it("setShop / setMerchantAccount 局部更新", () => {
    useMerchantAuthStore.getState().setSession(fakeTokenPair);
    useMerchantAuthStore.getState().setShop({
      ...fakeShop,
      name: "改名店铺",
    });
    expect(useMerchantAuthStore.getState().shop?.name).toBe("改名店铺");

    useMerchantAuthStore.getState().setMerchantAccount({
      ...fakeAccount,
      role: "SHOP_OPERATOR",
    });
    expect(useMerchantAuthStore.getState().merchantAccount?.role).toBe(
      "SHOP_OPERATOR",
    );
  });

  it("clear 清空全部会话字段", () => {
    useMerchantAuthStore.getState().setSession(fakeTokenPair);
    useMerchantAuthStore.getState().clear();
    const state = useMerchantAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.merchantAccount).toBeNull();
    expect(state.shop).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it("持久化写入 localStorage（key = merchant-auth-v1）", () => {
    useMerchantAuthStore.getState().setSession(fakeTokenPair);
    const raw = window.localStorage.getItem("merchant-auth-v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as {
      state: {
        accessToken: string;
        merchantAccount: { login_name: string };
      };
    };
    expect(parsed.state.accessToken).toBe("access-abc");
    expect(parsed.state.merchantAccount.login_name).toBe("shop1_owner");
  });
});
