"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listAddresses } from "@/lib/address-api";
import { useAuth } from "./useAuth";
import type { UserAddress } from "@/types/order";

const ADDRESSES_KEY = ["user", "addresses"] as const;

/** GET /user/addresses；未登录不发。 */
export function useAddresses() {
  const { isLoggedIn, hasHydrated } = useAuth();
  return useQuery<UserAddress[]>({
    queryKey: ADDRESSES_KEY,
    queryFn: listAddresses,
    enabled: hasHydrated && isLoggedIn,
    staleTime: 60_000,
  });
}

/** 变更后调用它 invalidate 缓存。 */
export function useInvalidateAddresses() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ADDRESSES_KEY });
}
