/**
 * 商品（SPU）与状态操作 API（Phase 2 §8）。
 *
 * 端点覆盖：
 *   - list / detail / create / update / delete
 *   - submit-review / withdraw-review / offshelf / onshelf
 */

import { api, unwrap } from "./api";
import type {
  CreateSPUIn,
  PagedOut,
  SPUDetailOut,
  SPUListItemOut,
  SPUStatus,
  UpdateSPUIn,
} from "@/types/api";

export interface ListMySPUsQuery {
  status?: SPUStatus | "" | undefined;
  keyword?: string;
  page?: number;
  size?: number;
}

/** `GET /api/v1/merchant/spus` */
export function listMySPUs(
  query: ListMySPUsQuery = {},
): Promise<PagedOut<SPUListItemOut>> {
  const searchParams = new URLSearchParams();
  if (query.status) searchParams.set("status", query.status);
  if (query.keyword) searchParams.set("keyword", query.keyword);
  searchParams.set("page", String(query.page ?? 1));
  searchParams.set("size", String(query.size ?? 20));
  return unwrap<PagedOut<SPUListItemOut>>(
    api.get("v1/merchant/spus", { searchParams }),
  );
}

/** `GET /api/v1/merchant/spus/{id}` */
export function getSPU(id: number): Promise<SPUDetailOut> {
  return unwrap<SPUDetailOut>(api.get(`v1/merchant/spus/${id}`));
}

/** `POST /api/v1/merchant/spus` — 创建 draft */
export function createSPU(payload: CreateSPUIn): Promise<SPUDetailOut> {
  return unwrap<SPUDetailOut>(
    api.post("v1/merchant/spus", { json: payload }),
  );
}

/** `PATCH /api/v1/merchant/spus/{id}` */
export function updateSPU(
  id: number,
  payload: UpdateSPUIn,
): Promise<SPUDetailOut> {
  return unwrap<SPUDetailOut>(
    api.patch(`v1/merchant/spus/${id}`, { json: payload }),
  );
}

/** `DELETE /api/v1/merchant/spus/{id}` — 软删 */
export async function deleteSPU(id: number): Promise<void> {
  await api.delete(`v1/merchant/spus/${id}`);
}

/** `POST /api/v1/merchant/spus/{id}/submit-review` */
export function submitReview(id: number): Promise<SPUDetailOut> {
  return unwrap<SPUDetailOut>(
    api.post(`v1/merchant/spus/${id}/submit-review`),
  );
}

/** `POST /api/v1/merchant/spus/{id}/withdraw-review` */
export function withdrawReview(id: number): Promise<SPUDetailOut> {
  return unwrap<SPUDetailOut>(
    api.post(`v1/merchant/spus/${id}/withdraw-review`),
  );
}

/** `POST /api/v1/merchant/spus/{id}/offshelf` — approved → off_shelf */
export function offshelf(id: number): Promise<SPUDetailOut> {
  return unwrap<SPUDetailOut>(api.post(`v1/merchant/spus/${id}/offshelf`));
}

/** `POST /api/v1/merchant/spus/{id}/onshelf` — off_shelf → approved */
export function onshelf(id: number): Promise<SPUDetailOut> {
  return unwrap<SPUDetailOut>(api.post(`v1/merchant/spus/${id}/onshelf`));
}
