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

// ============================================================================
// Phase 2: 商品与库存相关 DTO
// ============================================================================

/** SPU 状态枚举（对应 backend `spus.status`）。 */
export type SPUStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "off_shelf";

/** 类目 DTO（Phase 2 §6.1 / §11.1）。 */
export interface CategoryOut {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  level: number;
  path: string;
  icon_url: string | null;
  sort_order: number;
  is_visible: boolean;
  children?: CategoryOut[];
}

/** 品牌 DTO。 */
export interface BrandOut {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
}

/** SKU DTO。 */
export interface SKUOut {
  id: number;
  spu_id: number;
  sku_code: string;
  specs: Record<string, string>;
  price_cents: number;
  original_price_cents: number | null;
  stock: number;
  locked_stock: number;
  sold_count: number;
  image: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** SPU 列表项 DTO（`GET /merchant/spus`）。 */
export interface SPUListItemOut {
  id: number;
  title: string;
  subtitle: string | null;
  main_image: string;
  status: SPUStatus;
  category_id: number;
  brand_id: number | null;
  min_price_cents: number;
  max_price_cents: number;
  sales_count: number;
  updated_at: string;
  published_at: string | null;
  review_note?: string | null;
}

/** SPU 详情 DTO（含 SKUs）。 */
export interface SPUDetailOut {
  id: number;
  shop_id: number;
  category_id: number;
  brand_id: number | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  main_image: string;
  images: string[];
  spec_axes: string[];
  status: SPUStatus;
  review_note: string | null;
  reviewed_at: string | null;
  sales_count: number;
  view_count: number;
  min_price_cents: number;
  max_price_cents: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  skus: SKUOut[];
}

/** `POST /merchant/spus` 请求体。 */
export interface CreateSPUIn {
  category_id: number;
  brand_id?: number | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  main_image: string;
  images?: string[];
  spec_axes?: string[];
}

/** `PATCH /merchant/spus/{id}` 请求体（所有字段均可选）。 */
export type UpdateSPUIn = Partial<CreateSPUIn>;

/** `POST /merchant/spus/{spu_id}/skus` 请求体。 */
export interface CreateSKUIn {
  sku_code: string;
  specs: Record<string, string>;
  price_cents: number;
  original_price_cents?: number | null;
  stock: number;
  image?: string | null;
  is_active?: boolean;
}

/** `PATCH /merchant/spus/{spu_id}/skus/{sku_id}` 请求体（不可改 specs / sku_code）。 */
export interface UpdateSKUIn {
  price_cents?: number;
  original_price_cents?: number | null;
  stock?: number;
  image?: string | null;
  is_active?: boolean;
}

/** SPU 状态操作请求：审核相关。 */
export interface ReviewOpIn {
  review_note?: string;
}

/** 库存日志 DTO（§10）。 */
export type InventoryReason =
  | "purchase"
  | "sale"
  | "refund_return"
  | "adjust"
  | "initial";

export type InventoryOperatorType = "merchant" | "admin" | "system";

export interface InventoryLogOut {
  id: number;
  sku_id: number;
  delta: number;
  balance_after: number;
  reason: InventoryReason;
  operator_type: InventoryOperatorType;
  operator_id: number | null;
  note: string | null;
  related_order_id: number | null;
  created_at: string;
}

/** 库存调整请求。 */
export interface AdjustInventoryIn {
  delta: number;
  reason: InventoryReason;
  note?: string;
}

/** 图片上传 presign。 */
export type UploadPurpose =
  | "spu_main"
  | "spu_gallery"
  | "brand_logo"
  | "category_icon";

export interface PresignUploadIn {
  purpose: UploadPurpose;
  content_type: string;
  file_size: number;
}

export interface PresignUploadOut {
  object_key: string;
  upload_url: string;
  expires_at: string;
  public_url: string;
}

/** 后端分页响应（snake_case）—— 与 §1 约定一致。 */
export interface PagedOut<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
