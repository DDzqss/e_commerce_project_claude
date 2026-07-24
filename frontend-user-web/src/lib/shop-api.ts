/**
 * Phase 5 · 店铺主页 API 客户端。
 *
 * 契约：docs/API/phase-5-contracts.md §9.1 / §9.2
 *   GET /catalog/shops/{id}
 *   GET /catalog/shops/{id}/spus?category_id&sort&page&size
 */

import { apiGet } from "./api";
import type { PaginatedData } from "@/types";
import type { SPUListItem } from "@/types/catalog";
import type { ShopHomepage } from "@/types/shop";

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

/** GET /catalog/shops/{id} */
export function getShopHomepage(
  id: number | string,
): Promise<ShopHomepage> {
  return apiGet<ShopHomepage>(`catalog/shops/${id}`);
}

export interface ShopSpuListQuery {
  category_id?: number;
  sort?: "default" | "newest" | "price_asc" | "price_desc" | "sales";
  page?: number;
  size?: number;
}

/** GET /catalog/shops/{id}/spus */
export function listShopSpus(
  id: number | string,
  query?: ShopSpuListQuery,
): Promise<PaginatedData<SPUListItem>> {
  return apiGet<PaginatedData<SPUListItem>>(`catalog/shops/${id}/spus`, {
    searchParams: toSearchParams(query),
  });
}
