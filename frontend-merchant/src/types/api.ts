/**
 * 商家端后端 API DTO 类型。
 *
 * 严格对齐 docs/API/phase-1-contracts.md（§3 / §4.2-4.3 / §5.2 / §6.2 / §10）。
 * 字段命名遵循后端 snake_case；前端仅在展示层做局部驼峰映射，避免类型漂移。
 */

/** 商家账号角色（对应 backend `merchant_accounts.role`）。 */
export type MerchantRoleCode =
  | "SHOP_OWNER"
  | "SHOP_OPERATOR"
  | "SHOP_SUPPORT";

/** 商家账号状态。 */
export type MerchantAccountStatus = "active" | "frozen";

/** 店铺状态。 */
export type ShopStatus = "active" | "frozen";

/** 商家账号 DTO（`GET /api/v1/merchant/me`.merchant_account）。 */
export interface MerchantAccountOut {
  id: number;
  user_id: number;
  login_name: string;
  shop_id: number;
  role: MerchantRoleCode;
  status: MerchantAccountStatus;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 店铺 DTO（`GET /api/v1/merchant/me`.shop）。 */
export interface ShopOut {
  id: number;
  name: string;
  description: string | null;
  contact_name: string;
  contact_phone: string;
  status: ShopStatus;
  created_at: string;
  updated_at: string;
}

/** `GET /api/v1/merchant/me` 响应结构。 */
export interface MerchantMeOut {
  merchant_account: MerchantAccountOut;
  shop: ShopOut;
}

/** `POST /api/v1/merchant/auth/login` / refresh 响应结构。 */
export interface TokenPair {
  merchant_account: MerchantAccountOut;
  shop: ShopOut;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** `PATCH /api/v1/merchant/me/shop` 请求体。name 不可改。 */
export interface UpdateShopIn {
  description?: string | null;
  contact_name?: string;
  contact_phone?: string;
}

/** `POST /api/v1/merchant/auth/change-password` 请求体。 */
export interface ChangePasswordIn {
  old_password: string;
  new_password: string;
}

/** `POST /api/v1/merchant/auth/login` 请求体。 */
export interface LoginMerchantIn {
  login_name: string;
  password: string;
}
