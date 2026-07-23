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
