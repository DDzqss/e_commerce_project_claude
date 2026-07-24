/**
 * 商家资料相关 API（§6.2）。
 */

import { api, unwrap } from "./api";
import type { MerchantMeOut, ShopOut, UpdateShopIn } from "@/types/api";

/** `GET /api/v1/merchant/me` */
export function getMe(): Promise<MerchantMeOut> {
  return unwrap<MerchantMeOut>(api.get("v1/merchant/me"));
}

/** `PATCH /api/v1/merchant/me/shop` —— 更新店铺信息，返回新的 shop 快照。 */
export function updateShop(payload: UpdateShopIn): Promise<ShopOut> {
  return unwrap<ShopOut>(
    api.patch("v1/merchant/me/shop", { json: payload }),
  );
}
