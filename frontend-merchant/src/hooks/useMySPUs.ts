"use client";

/**
 * 商家 SPU 列表 / 详情 hooks。
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { getSPU, listMySPUs, type ListMySPUsQuery } from "@/lib/product-api";
import type { PagedOut, SPUDetailOut, SPUListItemOut } from "@/types/api";

export const MY_SPUS_QUERY_KEY = ["merchant", "spus", "list"] as const;
export const MY_SPU_QUERY_KEY = ["merchant", "spus", "detail"] as const;

export function useMySPUs(
  query: ListMySPUsQuery,
  options?: Partial<UseQueryOptions<PagedOut<SPUListItemOut>>>,
) {
  return useQuery<PagedOut<SPUListItemOut>>({
    queryKey: [...MY_SPUS_QUERY_KEY, query],
    queryFn: () => listMySPUs(query),
    staleTime: 15_000,
    ...options,
  });
}

export function useMySPU(
  id: number | null | undefined,
  options?: Partial<UseQueryOptions<SPUDetailOut>>,
) {
  return useQuery<SPUDetailOut>({
    queryKey: [...MY_SPU_QUERY_KEY, id],
    queryFn: () => getSPU(id!),
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 15_000,
    ...options,
  });
}
