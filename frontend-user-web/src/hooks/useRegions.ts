"use client";

import { useQuery } from "@tanstack/react-query";
import { getRegionChildren, getRegionTree } from "@/lib/region-api";
import type { RegionOut, RegionTreeNode } from "@/types/region";

const REGION_KEY_ROOT = ["regions"] as const;

/** 完整树；本地 24h 缓存由 lib 层管理。 */
export function useRegionTree() {
  return useQuery<RegionTreeNode[]>({
    queryKey: [...REGION_KEY_ROOT, "tree"],
    queryFn: () => getRegionTree(),
    // React Query 层再缓一份（长时间不 refetch）
    staleTime: 60 * 60 * 1000, // 1h
    gcTime: 24 * 60 * 60 * 1000,
  });
}

/** 单层子节点；parent_code = "root" 或省份 code 或市 code。 */
export function useRegionChildren(
  parentCode: string | "root" | null | undefined,
) {
  return useQuery<RegionOut[]>({
    queryKey: [...REGION_KEY_ROOT, "children", parentCode ?? "root"],
    queryFn: () => getRegionChildren(parentCode ?? "root"),
    enabled: parentCode !== null && parentCode !== undefined && parentCode !== "",
    staleTime: 60 * 60 * 1000,
  });
}
