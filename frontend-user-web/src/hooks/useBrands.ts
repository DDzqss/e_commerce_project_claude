"use client";

import { useQuery } from "@tanstack/react-query";
import { listBrands } from "@/lib/catalog-api";
import type { PaginatedData } from "@/types";
import type { BrandListQuery, BrandOut } from "@/types/catalog";

/**
 * 品牌列表（类目页侧栏筛选用；只拉可见的、按 sort_order/name）。
 * 品牌变动频率低，`staleTime` 5 分钟。
 */
export function useBrands(query?: BrandListQuery) {
  const q: BrandListQuery = { visible: true, size: 60, ...query };
  return useQuery<PaginatedData<BrandOut>>({
    queryKey: ["catalog", "brands", q],
    queryFn: () => listBrands(q),
    staleTime: 5 * 60_000,
  });
}
