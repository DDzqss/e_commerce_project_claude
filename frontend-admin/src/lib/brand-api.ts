/**
 * 品牌管理 API 封装（Admin 端）。
 *
 * 契约 §6.2：
 * - GET    /admin/brands?page&size&keyword    分页
 * - GET    /admin/brands/{id}
 * - POST   /admin/brands                      { name, slug, logo_url?, description?, sort_order?, is_visible? }
 * - PATCH  /admin/brands/{id}
 * - DELETE /admin/brands/{id}                 软删
 *
 * 权限：admin:brand:manage
 */

import { api, apiGet, apiPatch, apiPost, unwrap } from "@/lib/api";
import type { ApiResponse, PaginatedData } from "@/types";
import type {
  BrandOut,
  CreateBrandPayload,
  UpdateBrandPayload,
} from "@/types/api";

export interface ListBrandsQuery {
  keyword?: string;
  page?: number;
  size?: number;
}

/**
 * GET /admin/brands
 */
export function listBrands(
  query: ListBrandsQuery = {},
): Promise<PaginatedData<BrandOut>> {
  const searchParams: Record<string, string | number> = {};
  if (query.keyword) searchParams.keyword = query.keyword;
  if (query.page) searchParams.page = query.page;
  if (query.size) searchParams.size = query.size;
  return apiGet<PaginatedData<BrandOut>>("admin/brands", { searchParams });
}

/**
 * GET /admin/brands/{id}
 * 错误：6011 不存在
 */
export function getBrand(id: number | string): Promise<BrandOut> {
  return apiGet<BrandOut>(`admin/brands/${id}`);
}

/**
 * POST /admin/brands
 * 错误：6012 slug 冲突 / 5001 校验
 */
export function createBrand(payload: CreateBrandPayload): Promise<BrandOut> {
  return apiPost<BrandOut, CreateBrandPayload>("admin/brands", payload);
}

/**
 * PATCH /admin/brands/{id}
 */
export function updateBrand(
  id: number | string,
  payload: UpdateBrandPayload,
): Promise<BrandOut> {
  return apiPatch<BrandOut, UpdateBrandPayload>(
    `admin/brands/${id}`,
    payload,
  );
}

/**
 * DELETE /admin/brands/{id}
 * 软删。
 */
export function deleteBrand(id: number | string): Promise<null> {
  return unwrap(api.delete(`admin/brands/${id}`).json<ApiResponse<null>>());
}
