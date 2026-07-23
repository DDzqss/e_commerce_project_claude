/**
 * Phase 3 · 用户地址簿 API。
 *
 * 契约：docs/API/phase-3-contracts.md §6
 *   GET    /user/addresses
 *   GET    /user/addresses/{id}
 *   POST   /user/addresses
 *   PATCH  /user/addresses/{id}
 *   DELETE /user/addresses/{id}
 *   POST   /user/addresses/{id}/set-default
 */

import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import type {
  CreateAddressPayload,
  UpdateAddressPayload,
  UserAddress,
} from "@/types/order";

/** GET /user/addresses — 默认在前，不分页；上限 20 条。 */
export function listAddresses(): Promise<UserAddress[]> {
  return apiGet<UserAddress[]>("user/addresses");
}

/** GET /user/addresses/{id} */
export function getAddress(id: number): Promise<UserAddress> {
  return apiGet<UserAddress>(`user/addresses/${id}`);
}

/** POST /user/addresses */
export function createAddress(
  payload: CreateAddressPayload,
): Promise<UserAddress> {
  return apiPost<UserAddress, CreateAddressPayload>("user/addresses", payload);
}

/** PATCH /user/addresses/{id} */
export function updateAddress(
  id: number,
  payload: UpdateAddressPayload,
): Promise<UserAddress> {
  return apiPatch<UserAddress, UpdateAddressPayload>(
    `user/addresses/${id}`,
    payload,
  );
}

/** DELETE /user/addresses/{id} — 软删；若删的是默认，不自动指定新默认。 */
export function deleteAddress(id: number): Promise<null> {
  return apiDelete<null>(`user/addresses/${id}`);
}

/** POST /user/addresses/{id}/set-default */
export function setDefaultAddress(id: number): Promise<UserAddress> {
  return apiPost<UserAddress>(`user/addresses/${id}/set-default`);
}
