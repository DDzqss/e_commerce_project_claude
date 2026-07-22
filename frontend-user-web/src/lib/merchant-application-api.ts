/**
 * 商家入驻申请 API 封装。
 *
 * 严格对齐 docs/API/phase-1-contracts.md §8.2：
 *   POST   /user/merchant-applications
 *   GET    /user/merchant-applications
 *   GET    /user/merchant-applications/{id}
 *   POST   /user/merchant-applications/{id}/withdraw
 */

import { apiGet, apiPost } from "./api";
import type {
  MerchantApplicationOut,
  SubmitMerchantApplicationPayload,
} from "@/types/api";
import type { PaginatedData, PaginationQuery } from "@/types";

/** POST /user/merchant-applications */
export function submitApplication(
  payload: SubmitMerchantApplicationPayload,
): Promise<MerchantApplicationOut> {
  return apiPost<MerchantApplicationOut, SubmitMerchantApplicationPayload>(
    "user/merchant-applications",
    payload,
  );
}

/** GET /user/merchant-applications */
export function listMyApplications(
  query?: PaginationQuery,
): Promise<PaginatedData<MerchantApplicationOut>> {
  const searchParams: Record<string, string> = {};
  if (query?.page) searchParams.page = String(query.page);
  if (query?.size) searchParams.size = String(query.size);
  return apiGet<PaginatedData<MerchantApplicationOut>>(
    "user/merchant-applications",
    Object.keys(searchParams).length ? { searchParams } : undefined,
  );
}

/** GET /user/merchant-applications/{id} */
export function getApplication(id: number): Promise<MerchantApplicationOut> {
  return apiGet<MerchantApplicationOut>(`user/merchant-applications/${id}`);
}

/** POST /user/merchant-applications/{id}/withdraw */
export function withdrawApplication(
  id: number,
): Promise<MerchantApplicationOut> {
  return apiPost<MerchantApplicationOut>(
    `user/merchant-applications/${id}/withdraw`,
  );
}
