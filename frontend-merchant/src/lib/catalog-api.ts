/**
 * 目录（类目 / 品牌）只读 API —— 供商家端下拉选择器使用。
 *
 * 走公开端点 `/catalog/*`（未登录也可访问），避免走鉴权。
 * 若后续要按店铺可用范围过滤，可再切到 `/merchant/*` 端点。
 */

import { api, unwrap } from "./api";
import type { BrandOut, CategoryOut, PagedOut } from "@/types/api";

/** `GET /api/v1/catalog/categories?visible=true` — 返回完整树 */
export function listCategories(
  onlyVisible = true,
): Promise<CategoryOut[]> {
  const searchParams = new URLSearchParams();
  if (onlyVisible) searchParams.set("visible", "true");
  return unwrap<CategoryOut[]>(
    api.get("v1/catalog/categories", { searchParams }),
  );
}

export interface ListBrandsQuery {
  keyword?: string;
  page?: number;
  size?: number;
  visible?: boolean;
}

/** `GET /api/v1/catalog/brands` */
export function listBrands(
  query: ListBrandsQuery = {},
): Promise<PagedOut<BrandOut>> {
  const searchParams = new URLSearchParams();
  if (query.keyword) searchParams.set("keyword", query.keyword);
  searchParams.set("page", String(query.page ?? 1));
  searchParams.set("size", String(query.size ?? 50));
  if (query.visible ?? true) searchParams.set("visible", "true");
  return unwrap<PagedOut<BrandOut>>(
    api.get("v1/catalog/brands", { searchParams }),
  );
}
