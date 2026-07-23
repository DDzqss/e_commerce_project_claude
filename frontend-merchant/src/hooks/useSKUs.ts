"use client";

/**
 * SKU 列表 hook。
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { listSKUs } from "@/lib/sku-api";
import type { SKUOut } from "@/types/api";

export const SKUS_QUERY_KEY = ["merchant", "skus", "list"] as const;

export function useSKUs(
  spuId: number | null | undefined,
  options?: Partial<UseQueryOptions<SKUOut[]>>,
) {
  return useQuery<SKUOut[]>({
    queryKey: [...SKUS_QUERY_KEY, spuId],
    queryFn: () => listSKUs(spuId!),
    enabled: !!spuId && (options?.enabled ?? true),
    staleTime: 15_000,
    ...options,
  });
}
