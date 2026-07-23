/**
 * Phase 2 商品浏览域 API 封装。
 *
 * 严格对齐 docs/API/phase-2-contracts.md §6.1 / §6.2 / §11：
 *   GET /catalog/categories?visible=true            → 类目树（不分页）
 *   GET /catalog/brands?visible&keyword&page&size    → 品牌列表（分页）
 *   GET /catalog/spus?category_id&brand_id&keyword
 *       &min_price_cents&max_price_cents&sort&page&size → SPU 列表（分页）
 *   GET /catalog/spus/{id}                           → SPU 详情
 *   GET /catalog/spus/{id}/related?limit=            → 相关推荐
 *   GET /catalog/recommendations?limit=              → 首页最新审核通过推荐
 *
 * 全部为公开接口，未登录也可访问；ky 层已带 Authorization（如果登录了），后端忽略即可。
 */

import { apiGet } from "./api";
import type { PaginatedData } from "@/types";
import type {
  BrandListQuery,
  BrandOut,
  CategoryTree,
  SPUDetail,
  SPUListItem,
  SPUListQuery,
} from "@/types/catalog";

/**
 * 把查询对象转成 ky 的 searchParams（string → string 对，跳过 undefined/null/空串）。
 * 抽出来单测好写，也避免每个调用点重复。
 */
function toSearchParams<T extends object>(
  q: T | undefined,
): Record<string, string> | undefined {
  if (!q) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/** GET /catalog/categories */
export function listCategories(
  visibleOnly = true,
): Promise<CategoryTree[]> {
  return apiGet<CategoryTree[]>("catalog/categories", {
    searchParams: visibleOnly ? { visible: "true" } : undefined,
  });
}

/** GET /catalog/brands */
export function listBrands(
  query?: BrandListQuery,
): Promise<PaginatedData<BrandOut>> {
  return apiGet<PaginatedData<BrandOut>>("catalog/brands", {
    searchParams: toSearchParams(query),
  });
}

/** GET /catalog/spus */
export function listSPUs(
  query?: SPUListQuery,
): Promise<PaginatedData<SPUListItem>> {
  return apiGet<PaginatedData<SPUListItem>>("catalog/spus", {
    searchParams: toSearchParams(query),
  });
}

/** GET /catalog/spus/{id} */
export function getSPUDetail(id: number | string): Promise<SPUDetail> {
  return apiGet<SPUDetail>(`catalog/spus/${id}`);
}

/** GET /catalog/spus/{id}/related */
export function getRelatedSPUs(
  id: number | string,
  limit = 8,
): Promise<SPUListItem[]> {
  return apiGet<SPUListItem[]>(`catalog/spus/${id}/related`, {
    searchParams: { limit: String(limit) },
  });
}

/** GET /catalog/recommendations */
export function getRecommendations(limit = 10): Promise<SPUListItem[]> {
  return apiGet<SPUListItem[]>("catalog/recommendations", {
    searchParams: { limit: String(limit) },
  });
}
