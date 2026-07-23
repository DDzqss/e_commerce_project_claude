"use client";

import { useQuery } from "@tanstack/react-query";
import { listCategories } from "@/lib/catalog-api";
import type { CategoryTree } from "@/types/catalog";

/**
 * 获取全部可见的类目树。
 *
 * 类目变动频率极低，`staleTime` 拉长到 5 分钟：
 * 页头下拉、类目页面包屑、类目导航都共用同一份缓存。
 */
export function useCategories() {
  return useQuery<CategoryTree[]>({
    queryKey: ["catalog", "categories", { visible: true }],
    queryFn: () => listCategories(true),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
