"use client";

import { useQuery } from "@tanstack/react-query";
import { getShopHomepage, listShopSpus, type ShopSpuListQuery } from "@/lib/shop-api";
import type { PaginatedData } from "@/types";
import type { SPUListItem } from "@/types/catalog";
import type { ShopHomepage } from "@/types/shop";

const SHOP_KEY_ROOT = ["catalog", "shops"] as const;

/** GET /catalog/shops/{id} — 店铺主页信息。 */
export function useShopHomepage(id: number | string | null | undefined) {
  const enabled = id !== null && id !== undefined && id !== "";
  return useQuery<ShopHomepage>({
    queryKey: [...SHOP_KEY_ROOT, "homepage", id],
    queryFn: () => getShopHomepage(id as number | string),
    enabled,
    staleTime: 60_000,
  });
}

/** GET /catalog/shops/{id}/spus — 店铺商品列表。 */
export function useShopSpus(
  id: number | string | null | undefined,
  query: ShopSpuListQuery,
) {
  const enabled = id !== null && id !== undefined && id !== "";
  return useQuery<PaginatedData<SPUListItem>>({
    queryKey: [...SHOP_KEY_ROOT, "spus", id, query],
    queryFn: () => listShopSpus(id as number | string, query),
    enabled,
    staleTime: 30_000,
  });
}
