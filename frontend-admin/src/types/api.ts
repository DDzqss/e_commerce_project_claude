/**
 * Phase 1 后端契约对应的 API 数据类型。
 *
 * 与 docs/API/phase-1-contracts.md 严格对齐：
 * - §3 身份域：Admin 独立登录
 * - §4.4 商家入驻申请 MerchantApplication
 * - §4.5 管理员 AdminUser
 * - §6.3 GET /api/v1/admin/me
 * - §9 商家审核端点
 *
 * 命名约定：接口字段使用 snake_case，与后端 JSON 一致（前端在此保持透传，
 * 避免额外的 case 转换层引入 bug；如需 camelCase 视图模型，请在具体页面
 * 里做局部映射）。
 */

import type { AdminRole, Permission } from "@/lib/rbac";

// ---------------------------------------------------------------------------
// Auth / Token
// ---------------------------------------------------------------------------

/**
 * 契约 §5 通用 Token 对：access 为 JWT（15min），refresh 为 opaque（30d）。
 * expires_in 为 access token 剩余秒数（服务端下发）。
 */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * 契约 §5.3 admin login 响应结构。
 * 后端在登录成功时同时返回 admin 摘要 + token 对（同 user/merchant 域）。
 */
export interface AdminLoginResponse extends TokenPair {
  admin: AdminOut;
}

/**
 * 契约 §5.3 admin refresh 响应（rotate 策略：旧 refresh 立即失效）。
 */
export type AdminRefreshResponse = TokenPair;

// ---------------------------------------------------------------------------
// Admin 资料
// ---------------------------------------------------------------------------

/**
 * 管理员基本信息（登录响应 / me 响应共用）。
 */
export interface AdminOut {
  id: number;
  username: string;
  display_name: string;
  role: AdminRole;
  status: "active" | "disabled";
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 契约 §6.3 GET /api/v1/admin/me 返回结构。
 * permissions 由后端根据 role 从 ROLE_PERMISSIONS 矩阵派发。
 */
export interface AdminMeOut {
  admin: AdminOut;
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// 商家入驻申请
// ---------------------------------------------------------------------------

/**
 * 契约 §4.4 申请状态枚举。
 */
export type MerchantApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";

/**
 * 契约 §4.4 单条商家入驻申请。
 *
 * `applicant_nickname` 是后端 join 返回的申请人昵称（列表页展示用）；
 * `approved_merchant_account_id` 仅在 status=approved 时非空。
 */
export interface MerchantApplicationOut {
  id: number;
  applicant_user_id: number;
  applicant_nickname: string;
  shop_name: string;
  contact_name: string;
  contact_phone: string;
  business_license_no: string;
  business_license_url: string | null;
  description: string | null;
  status: MerchantApplicationStatus;
  reviewer_admin_id: number | null;
  reviewer_display_name: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  approved_merchant_account_id: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * 契约 §9 approve 响应：审批通过后系统创建的商家账号（含**明文密码**）。
 * 明文密码仅本次响应可见，前端必须在 UI 上一次性展示并提示抄送。
 */
export interface ApproveMerchantApplicationResponse {
  application: MerchantApplicationOut;
  merchant_account: {
    id: number;
    login_name: string;
    /** 系统生成的 12 位随机密码；仅此一次可见 */
    initial_password: string;
    shop_id: number;
  };
}

/**
 * 契约 §9 reject 响应：仅返回更新后的申请记录。
 */
export interface RejectMerchantApplicationResponse {
  application: MerchantApplicationOut;
}

// ---------------------------------------------------------------------------
// Phase 2 · 类目 Category
// ---------------------------------------------------------------------------

/**
 * 契约 §3.1 / §6.1。
 *
 * - level ∈ 1..3；parent_id 与 level 联动
 * - path 形如 "1/12/125"，方便查询子树
 * - icon_url 为 MinIO object key（前端渲染时拼 CDN）
 */
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
  created_at: string;
  updated_at: string;
}

/**
 * 树节点：CategoryOut + children[]。
 * `GET /admin/categories` 直接返回树（契约 §6.1 类目量级 <500 不分页）。
 */
export interface CategoryTreeNode extends CategoryOut {
  children: CategoryTreeNode[];
}

export interface CreateCategoryPayload {
  parent_id?: number | null;
  name: string;
  slug: string;
  icon_url?: string | null;
  sort_order?: number;
  is_visible?: boolean;
}

export interface UpdateCategoryPayload {
  name?: string;
  slug?: string;
  icon_url?: string | null;
  sort_order?: number;
  is_visible?: boolean;
}

// ---------------------------------------------------------------------------
// Phase 2 · 品牌 Brand
// ---------------------------------------------------------------------------

/**
 * 契约 §3.2 / §6.2。
 */
export interface BrandOut {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBrandPayload {
  name: string;
  slug: string;
  logo_url?: string | null;
  description?: string | null;
  sort_order?: number;
  is_visible?: boolean;
}

export interface UpdateBrandPayload {
  name?: string;
  slug?: string;
  logo_url?: string | null;
  description?: string | null;
  sort_order?: number;
  is_visible?: boolean;
}

// ---------------------------------------------------------------------------
// Phase 2 · 商品 SPU / SKU
// ---------------------------------------------------------------------------

/**
 * 契约 §3.3 商品状态机（SPU 生命周期）5 态。
 */
export type SPUStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "off_shelf";

/**
 * SKU 概要（列表 / 详情共用）。契约 §3.4。
 *
 * 金额字段一律为整数分（price_cents），前端展示时除 100。
 */
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

/**
 * 店铺摘要（在 admin/spu 详情里 join 展示，Phase 1 商家账号契约）。
 */
export interface ShopBrief {
  id: number;
  name: string;
}

/**
 * 类目面包屑（详情用）。
 */
export interface CategoryBrief {
  id: number;
  name: string;
  path?: readonly { id: number; name: string }[];
}

/**
 * 品牌摘要（详情用）。
 */
export interface BrandBrief {
  id: number;
  name: string;
  slug?: string;
  logo_url?: string | null;
}

/**
 * Admin 列表接口的 SPU 元素（契约 §7 GET /admin/spus）。
 *
 * 说明：列表接口通常 join 店铺 / 类目 / 品牌摘要，避免 N+1。
 * 前端字段以 snake_case 与后端保持一致。
 */
export interface AdminSPUListItem {
  id: number;
  shop_id: number;
  shop?: ShopBrief | null;
  category_id: number;
  category?: CategoryBrief | null;
  brand_id: number | null;
  brand?: BrandBrief | null;
  title: string;
  subtitle: string | null;
  main_image: string;
  status: SPUStatus;
  min_price_cents: number;
  max_price_cents: number;
  sales_count: number;
  view_count: number;
  reviewer_admin_id: number | null;
  review_note: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Admin 详情接口的 SPU（含 SKU 列表与完整字段）。契约 §7 GET /admin/spus/{id}。
 */
export interface AdminSPUDetail extends AdminSPUListItem {
  description: string | null;
  images: readonly string[];
  spec_axes: readonly string[];
  skus: readonly SKUOut[];
  /** 审核历史（可选；后端 Phase 2 若未返回则前端仅展示最近一次）*/
  review_history?: readonly ReviewRecord[];
}

/**
 * 审核历史条目。Phase 2 后端可返回也可不返回；前端在页面兜底展示最近一次。
 */
export interface ReviewRecord {
  action: "approve" | "reject" | "force_offshelf";
  reviewer_admin_id: number | null;
  reviewer_display_name?: string | null;
  review_note: string | null;
  reviewed_at: string;
}

/**
 * approve / reject / force-offshelf 请求 payload。
 */
export interface AdminReviewPayload {
  /** approve 时可选；reject / force-offshelf 时必填（5-500 字） */
  review_note?: string;
}

// ---------------------------------------------------------------------------
// Phase 2 · 图片上传（presigned URL）
// ---------------------------------------------------------------------------

/**
 * 契约 §9.1 presign 请求 purpose 枚举。
 * admin 侧本 Phase 主要用 category_icon / brand_logo。
 */
export type UploadPurpose =
  | "spu_main"
  | "spu_gallery"
  | "brand_logo"
  | "category_icon";

export interface PresignRequestPayload {
  purpose: UploadPurpose;
  content_type: string;
  file_size: number;
}

export interface PresignResponse {
  /** MinIO 对象 key，前端把它作为业务字段（icon_url / logo_url 等）提交 */
  object_key: string;
  /** 15 分钟有效期的 PUT URL */
  upload_url: string;
  expires_at: string;
  public_url: string;
}
