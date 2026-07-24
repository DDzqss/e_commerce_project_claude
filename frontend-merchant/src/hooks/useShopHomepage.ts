"use client";

/**
 * 商家 · 店铺主页 hook（Phase 5 §9.3）。
 *
 * 提供：
 *   - useShopHomepage()        · 复用 useCurrentMerchant().data.shop
 *   - useUpdateShopHomepage()  · PATCH /merchant/me/shop mutation
 *
 * 保持一致：mutation 成功后同步更新 store + query cache，避免重新拉取。
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateShop } from "@/lib/merchant-api";
import { useMerchantAuthStore } from "@/lib/auth-store";
import { MERCHANT_ME_QUERY_KEY, useCurrentMerchant } from "./useCurrentMerchant";
import type { ShopOut, UpdateShopIn } from "@/types/api";

export function useShopHomepage() {
  const query = useCurrentMerchant();
  return {
    shop: query.data?.shop,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useUpdateShopHomepage() {
  const queryClient = useQueryClient();
  const setShop = useMerchantAuthStore((s) => s.setShop);

  return useMutation<ShopOut, unknown, UpdateShopIn>({
    mutationFn: (payload) => updateShop(payload),
    onSuccess: (data) => {
      setShop(data);
      queryClient.setQueryData(MERCHANT_ME_QUERY_KEY, (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev;
        return { ...(prev as object), shop: data };
      });
    },
  });
}
