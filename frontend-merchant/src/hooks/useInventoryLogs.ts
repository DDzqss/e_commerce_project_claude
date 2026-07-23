"use client";

/**
 * SKU 库存流水 hook。
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import {
  listLogs,
  type ListInventoryLogsQuery,
} from "@/lib/inventory-api";
import type { InventoryLogOut, PagedOut } from "@/types/api";

export const INVENTORY_LOGS_QUERY_KEY = [
  "merchant",
  "inventory",
  "logs",
] as const;

export function useInventoryLogs(
  skuId: number | null | undefined,
  query: ListInventoryLogsQuery = {},
  options?: Partial<UseQueryOptions<PagedOut<InventoryLogOut>>>,
) {
  return useQuery<PagedOut<InventoryLogOut>>({
    queryKey: [...INVENTORY_LOGS_QUERY_KEY, skuId, query],
    queryFn: () => listLogs(skuId!, query),
    enabled: !!skuId && (options?.enabled ?? true),
    staleTime: 10_000,
    ...options,
  });
}
