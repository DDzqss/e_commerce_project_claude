"use client";

import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getCart } from "@/lib/cart-api";
import { useAuth } from "./useAuth";
import { useCartBadge } from "@/lib/cart-store";
import type { CartResponse } from "@/types/order";

const CART_KEY = ["user", "cart"] as const;

/**
 * 拉当前用户的购物车（含分组）。
 * - 未登录时不发请求（保持 undefined）
 * - staleTime 短一点，因为价格/库存/失效都可能变化
 * - 返回数据后同步头部红点数
 */
export function useCart() {
  const { isLoggedIn, hasHydrated } = useAuth();
  const sync = useCartBadge((s) => s.sync);

  const query = useQuery<CartResponse>({
    queryKey: CART_KEY,
    queryFn: getCart,
    enabled: hasHydrated && isLoggedIn,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!query.data) return;
    const itemCount = query.data.groups.reduce(
      (acc, g) => acc + g.items.length,
      0,
    );
    sync({ itemCount, hasInvalid: (query.data.invalid_count ?? 0) > 0 });
  }, [query.data, sync]);

  return query;
}

/** 便捷失效购物车缓存的 hook，UI 变更后 invalidate 让下一次 render 自动 refetch。 */
export function useInvalidateCart() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: CART_KEY });
}

/**
 * 通用的 mutation wrapper，成功后 invalidate 购物车缓存。
 * 各页面用它包一下即可，不用重复写 onSuccess。
 */
export function useCartMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
) {
  const invalidate = useInvalidateCart();
  return useMutation<TData, unknown, TVars>({
    mutationFn,
    onSuccess: () => {
      invalidate();
    },
  });
}
