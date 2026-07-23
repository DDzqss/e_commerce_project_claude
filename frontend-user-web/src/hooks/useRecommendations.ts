"use client";

import { useQuery } from "@tanstack/react-query";
import { getRecommendations } from "@/lib/catalog-api";
import type { SPUListItem } from "@/types/catalog";

/**
 * 首页 / 详情页底部的极简推荐位。
 *
 * Phase 2 后端返回"最新审核通过的 N 个 SPU"（按 published_at desc）。
 * 由于是全站共用数据，缓存时间较长。
 */
export function useRecommendations(limit = 10) {
  return useQuery<SPUListItem[]>({
    queryKey: ["catalog", "recommendations", limit],
    queryFn: () => getRecommendations(limit),
    staleTime: 5 * 60_000,
  });
}
