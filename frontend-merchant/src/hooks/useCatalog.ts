"use client";

/**
 * 类目 / 品牌 hooks（供选择器使用）。
 * 数据较小，cache 时长可拉长。
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import {
  listBrands,
  listCategories,
  type ListBrandsQuery,
} from "@/lib/catalog-api";
import type { BrandOut, CategoryOut, PagedOut } from "@/types/api";

export const CATEGORIES_QUERY_KEY = ["catalog", "categories"] as const;
export const BRANDS_QUERY_KEY = ["catalog", "brands"] as const;

export function useCategoryTree(
  options?: Partial<UseQueryOptions<CategoryOut[]>>,
) {
  return useQuery<CategoryOut[]>({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: () => listCategories(true),
    staleTime: 5 * 60_000,
    ...options,
  });
}

export function useBrands(
  query: ListBrandsQuery = { page: 1, size: 200 },
  options?: Partial<UseQueryOptions<PagedOut<BrandOut>>>,
) {
  return useQuery<PagedOut<BrandOut>>({
    queryKey: [...BRANDS_QUERY_KEY, query],
    queryFn: () => listBrands(query),
    staleTime: 5 * 60_000,
    ...options,
  });
}
