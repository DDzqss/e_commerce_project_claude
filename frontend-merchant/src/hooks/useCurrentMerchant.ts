"use client";

/**
 * 当前商家（含 shop）query hook。
 *
 * - 登录后自动请求 `GET /api/v1/merchant/me` 用最新数据覆盖 store 快照
 * - 用作绝大多数商家页面的"数据可用性"哨兵
 */

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { getMe } from "@/lib/merchant-api";
import { useMerchantAuthStore } from "@/lib/auth-store";

export const MERCHANT_ME_QUERY_KEY = ["merchant", "me"] as const;

export function useCurrentMerchant(options?: { enabled?: boolean }) {
  const authed = useMerchantAuthStore((s) =>
    Boolean(s.accessToken && s.merchantAccount),
  );
  const setShop = useMerchantAuthStore((s) => s.setShop);
  const setAccount = useMerchantAuthStore((s) => s.setMerchantAccount);

  const query = useQuery({
    queryKey: MERCHANT_ME_QUERY_KEY,
    queryFn: getMe,
    enabled: (options?.enabled ?? true) && authed,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (query.data) {
      setShop(query.data.shop);
      setAccount(query.data.merchant_account);
    }
  }, [query.data, setShop, setAccount]);

  return query;
}
