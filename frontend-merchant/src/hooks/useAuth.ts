"use client";

/**
 * 商家会话 hook：提供只读 selector + login/logout mutation。
 *
 * 使用示例：
 *   const { merchantAccount, shop, logout } = useAuth();
 *   const { mutateAsync: doLogin, isPending } = useAuth().loginMutation;
 */

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import { useMerchantAuthStore } from "@/lib/auth-store";
import {
  loginMerchant,
  logoutMerchant,
  changePassword as changePasswordApi,
} from "@/lib/auth-api";
import type {
  ChangePasswordIn,
  LoginMerchantIn,
  TokenPair,
} from "@/types/api";

export function useAuth() {
  const merchantAccount = useMerchantAuthStore((s) => s.merchantAccount);
  const shop = useMerchantAuthStore((s) => s.shop);
  const accessToken = useMerchantAuthStore((s) => s.accessToken);
  const refreshToken = useMerchantAuthStore((s) => s.refreshToken);
  const hydrated = useMerchantAuthStore((s) => s.hydrated);
  const setSession = useMerchantAuthStore((s) => s.setSession);
  const clear = useMerchantAuthStore((s) => s.clear);

  const loginMutation = useMutation({
    mutationFn: (payload: LoginMerchantIn): Promise<TokenPair> =>
      loginMerchant(payload),
    onSuccess: (data) => {
      setSession(data);
    },
  });

  const logout = useCallback(async () => {
    const tk = useMerchantAuthStore.getState().refreshToken;
    try {
      // 尽力通知后端 revoke；失败也要清本地
      await logoutMerchant(tk);
    } catch {
      /* ignore */
    } finally {
      clear();
    }
  }, [clear]);

  const changePasswordMutation = useMutation({
    mutationFn: (payload: ChangePasswordIn) => changePasswordApi(payload),
  });

  return {
    merchantAccount,
    shop,
    accessToken,
    refreshToken,
    hydrated,
    isAuthenticated: Boolean(accessToken && merchantAccount),
    loginMutation,
    changePasswordMutation,
    logout,
  };
}
