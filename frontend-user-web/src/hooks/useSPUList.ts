"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listSPUs } from "@/lib/catalog-api";
import type { PaginatedData } from "@/types";
import type { SPUListItem, SPUListQuery } from "@/types/catalog";

/**
 * 拉取 SPU 列表（分类页 / 搜索页共用）。
 *
 * - queryKey 完整包含所有筛选参数，避免不同筛选之间串数据
 * - `keepPreviousData` 让翻页/切换筛选时保留旧数据，减少闪烁
 */
export function useSPUList(query: SPUListQuery) {
  return useQuery<PaginatedData<SPUListItem>>({
    queryKey: ["catalog", "spus", query],
    queryFn: () => listSPUs(query),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
