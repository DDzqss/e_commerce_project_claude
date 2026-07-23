"use client";

import { useQuery } from "@tanstack/react-query";
import { getRelatedSPUs, getSPUDetail } from "@/lib/catalog-api";
import type { SPUDetail, SPUListItem } from "@/types/catalog";

/**
 * 获取商品详情。
 *
 * - `enabled`：id 必须为正整数才发起（防止路由参数还没到位就打请求）
 * - 详情页会触发后端 view_count += 1；用户重复访问被 staleTime 拦截，避免刷计数
 */
export function useSPUDetail(id: number | null | undefined) {
  const isValid = typeof id === "number" && Number.isFinite(id) && id > 0;
  return useQuery<SPUDetail>({
    queryKey: ["catalog", "spu", id],
    queryFn: () => getSPUDetail(id as number),
    enabled: isValid,
    staleTime: 60_000,
  });
}

/** 详情页的"相关推荐"。 */
export function useRelatedSPUs(
  id: number | null | undefined,
  limit = 8,
) {
  const isValid = typeof id === "number" && Number.isFinite(id) && id > 0;
  return useQuery<SPUListItem[]>({
    queryKey: ["catalog", "spu-related", id, limit],
    queryFn: () => getRelatedSPUs(id as number, limit),
    enabled: isValid,
    staleTime: 5 * 60_000,
  });
}
