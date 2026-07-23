/**
 * Phase 3 · 购物车 API。
 *
 * 契约：docs/API/phase-3-contracts.md §7
 *   GET    /user/cart
 *   POST   /user/cart/items                (加购 / 已存在则数量相加)
 *   PATCH  /user/cart/items/{id}           (数量 / 选中)
 *   DELETE /user/cart/items/{id}
 *   POST   /user/cart/items/batch-delete   { ids: number[] }
 *   POST   /user/cart/select-all           { selected: boolean }
 *   DELETE /user/cart/invalid              (一键清失效商品)
 */

import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import type {
  AddToCartPayload,
  CartItem,
  CartResponse,
  UpdateCartItemPayload,
} from "@/types/order";

/** GET /user/cart */
export function getCart(): Promise<CartResponse> {
  return apiGet<CartResponse>("user/cart");
}

/** POST /user/cart/items — 添加；若已有同 SKU 则 quantity 相加（后端处理）。 */
export function addToCart(payload: AddToCartPayload): Promise<CartItem> {
  return apiPost<CartItem, AddToCartPayload>("user/cart/items", payload);
}

/** PATCH /user/cart/items/{id} — 修改数量/选中态。 */
export function updateCartItem(
  id: number,
  payload: UpdateCartItemPayload,
): Promise<CartItem> {
  return apiPatch<CartItem, UpdateCartItemPayload>(
    `user/cart/items/${id}`,
    payload,
  );
}

/** DELETE /user/cart/items/{id} */
export function deleteCartItem(id: number): Promise<null> {
  return apiDelete<null>(`user/cart/items/${id}`);
}

/** POST /user/cart/items/batch-delete */
export function batchDeleteCartItems(ids: number[]): Promise<null> {
  return apiPost<null, { ids: number[] }>("user/cart/items/batch-delete", {
    ids,
  });
}

/** POST /user/cart/select-all — 全选/全不选。 */
export function selectAllCartItems(selected: boolean): Promise<null> {
  return apiPost<null, { selected: boolean }>("user/cart/select-all", {
    selected,
  });
}

/** DELETE /user/cart/invalid — 一键清空失效商品。 */
export function clearInvalidCartItems(): Promise<null> {
  return apiDelete<null>("user/cart/invalid");
}
