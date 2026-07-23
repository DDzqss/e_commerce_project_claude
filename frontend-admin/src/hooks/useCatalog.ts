"use client";

/**
 * 类目 / 品牌 / 商品审核相关 React Query hooks。
 *
 * 集中放在此处，方便页面直接 import；避免每个页面重复写 useQuery + queryKey。
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { listAllCategories } from "@/lib/category-api";
import { listBrands, type ListBrandsQuery } from "@/lib/brand-api";
import {
  getSPUDetail,
  listAllSPUs,
  type ListAllSPUsQuery,
} from "@/lib/product-api";
import type { PaginatedData } from "@/types";
import type {
  AdminSPUDetail,
  AdminSPUListItem,
  BrandOut,
  CategoryTreeNode,
} from "@/types/api";

// ---------------------------------------------------------------------------
// 类目
// ---------------------------------------------------------------------------

/**
 * useCategories — 拉取类目树。
 *
 * 类目变更频率极低，staleTime 设为 2 分钟以减少无谓刷新。
 */
export function useCategories(
  options?: Omit<
    UseQueryOptions<CategoryTreeNode[], Error, CategoryTreeNode[]>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["admin", "categories"],
    queryFn: listAllCategories,
    staleTime: 2 * 60_000,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// 品牌
// ---------------------------------------------------------------------------

export function useBrands(
  query: ListBrandsQuery,
  options?: Omit<
    UseQueryOptions<
      PaginatedData<BrandOut>,
      Error,
      PaginatedData<BrandOut>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["admin", "brands", query],
    queryFn: () => listBrands(query),
    placeholderData: (prev) => prev,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// 商品审核
// ---------------------------------------------------------------------------

/**
 * usePendingSPUs — 通用商品列表查询（支持任意 status；默认 pending_review）。
 */
export function useAdminSPUs(
  query: ListAllSPUsQuery,
  options?: Omit<
    UseQueryOptions<
      PaginatedData<AdminSPUListItem>,
      Error,
      PaginatedData<AdminSPUListItem>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["admin", "spus", query],
    queryFn: () => listAllSPUs(query),
    placeholderData: (prev) => prev,
    ...options,
  });
}

/**
 * usePendingSPUs — 便捷版：默认查 pending_review。
 * dashboard 或队列 header 计数场景可用。
 */
export function usePendingSPUs(
  extra: Omit<ListAllSPUsQuery, "status"> = {},
) {
  return useAdminSPUs({ status: "pending_review", ...extra });
}

/**
 * useSPUDetail — 单个商品详情（含 SKU 列表）。
 */
export function useSPUDetail(
  id: string | number | null | undefined,
  options?: Omit<
    UseQueryOptions<AdminSPUDetail, Error, AdminSPUDetail>,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  return useQuery({
    queryKey: ["admin", "spu", String(id ?? "")],
    queryFn: () => getSPUDetail(id as string | number),
    enabled: id !== null && id !== undefined && id !== "",
    ...options,
  });
}
