/**
 * SKU 增删改查 API（§8.2）。
 *
 * 注意：`specs` 与 `sku_code` 一旦创建不可再改，只能删了重建。
 */

import { api, unwrap } from "./api";
import type { CreateSKUIn, SKUOut, UpdateSKUIn } from "@/types/api";

/** `GET /api/v1/merchant/spus/{spu_id}/skus` */
export function listSKUs(spuId: number): Promise<SKUOut[]> {
  return unwrap<SKUOut[]>(api.get(`v1/merchant/spus/${spuId}/skus`));
}

/** `POST /api/v1/merchant/spus/{spu_id}/skus` */
export function createSKU(
  spuId: number,
  payload: CreateSKUIn,
): Promise<SKUOut> {
  return unwrap<SKUOut>(
    api.post(`v1/merchant/spus/${spuId}/skus`, { json: payload }),
  );
}

/** `PATCH /api/v1/merchant/spus/{spu_id}/skus/{sku_id}` */
export function updateSKU(
  spuId: number,
  skuId: number,
  payload: UpdateSKUIn,
): Promise<SKUOut> {
  return unwrap<SKUOut>(
    api.patch(`v1/merchant/spus/${spuId}/skus/${skuId}`, { json: payload }),
  );
}

/** `DELETE /api/v1/merchant/spus/{spu_id}/skus/{sku_id}` — 软删 */
export async function deleteSKU(spuId: number, skuId: number): Promise<void> {
  await api.delete(`v1/merchant/spus/${spuId}/skus/${skuId}`);
}
