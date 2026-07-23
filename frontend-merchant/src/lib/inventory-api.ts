/**
 * 库存管理 API（§10）。
 *
 * - adjust: 事务内更新 sku.stock + 写入 inventory_log
 * - listLogs: 分页查询 SKU 的库存流水
 */

import { api, unwrap } from "./api";
import type {
  AdjustInventoryIn,
  InventoryLogOut,
  PagedOut,
  SKUOut,
} from "@/types/api";

/** `POST /api/v1/merchant/skus/{sku_id}/inventory/adjust` */
export function adjust(
  skuId: number,
  payload: AdjustInventoryIn,
): Promise<SKUOut> {
  return unwrap<SKUOut>(
    api.post(`v1/merchant/skus/${skuId}/inventory/adjust`, { json: payload }),
  );
}

export interface ListInventoryLogsQuery {
  page?: number;
  size?: number;
}

/** `GET /api/v1/merchant/skus/{sku_id}/inventory-logs` */
export function listLogs(
  skuId: number,
  query: ListInventoryLogsQuery = {},
): Promise<PagedOut<InventoryLogOut>> {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(query.page ?? 1));
  searchParams.set("size", String(query.size ?? 20));
  return unwrap<PagedOut<InventoryLogOut>>(
    api.get(`v1/merchant/skus/${skuId}/inventory-logs`, { searchParams }),
  );
}
