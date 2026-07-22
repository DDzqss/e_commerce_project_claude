/**
 * Phase 1 契约相关的强类型定义。
 *
 * 严格对齐 docs/API/phase-1-contracts.md：
 * - §3 身份域（User）
 * - §4 数据模型（User / MerchantAccount / Shop / MerchantApplication）
 * - §5.1 认证端点
 * - §6.1 用户资料端点
 * - §8.2 商家入驻申请端点
 *
 * 字段命名与后端 snake_case 一致，避免手工映射造成字段丢失/错位。
 */

/** 用户状态。对应后端 users.status ENUM。 */
export type UserStatus = "active" | "disabled";

/** 商家账号状态。对应后端 merchant_accounts.status ENUM。 */
export type MerchantAccountStatus = "active" | "frozen";

/** 店铺状态。 */
export type ShopStatus = "active" | "frozen";

/** 商家入驻申请状态。 */
export type MerchantApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";

/**
 * 用户公开信息（返回给前端的最小字段集）。
 * 对应契约 §5.1 register/login 响应中的 `user` 字段。
 */
export interface UserOut {
  id: number;
  phone: string | null;
  email: string | null;
  nickname: string;
  avatar_url: string | null;
}

/**
 * `GET /api/v1/user/me` 完整响应结构。
 * 对应契约 §6.1。
 */
export interface UserMeOut {
  user: UserOut & {
    status: UserStatus;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
  };
  merchant_account_ids: number[];
  pending_application_id: number | null;
}

/**
 * Access + Refresh Token 对。契约 §5.1 / §10。
 */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  /** access_token 剩余秒数，默认 900。 */
  expires_in: number;
}

/**
 * 注册/登录成功响应。
 */
export interface AuthResult extends TokenPair {
  user: UserOut;
}

/**
 * 商家入驻申请（返回给申请人）。契约 §4.4。
 */
export interface MerchantApplicationOut {
  id: number;
  applicant_user_id: number;
  shop_name: string;
  contact_name: string;
  contact_phone: string;
  business_license_no: string;
  business_license_url: string | null;
  description: string | null;
  status: MerchantApplicationStatus;
  reviewer_admin_id: number | null;
  review_note: string | null;
  reviewed_at: string | null;
  approved_merchant_account_id: number | null;
  created_at: string;
  updated_at: string;
}

/** 注册请求 body。 */
export interface RegisterUserPayload {
  phone?: string | null;
  email?: string | null;
  password: string;
  nickname?: string | null;
}

/** 登录请求 body。 */
export interface LoginUserPayload {
  identifier: string;
  password: string;
}

/** 忘记密码请求 body。 */
export interface ForgotPasswordPayload {
  identifier: string;
}

/** 重置密码请求 body。 */
export interface ResetPasswordPayload {
  identifier: string;
  code: string;
  new_password: string;
}

/** 修改密码请求 body。 */
export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

/** 更新自己资料的 PATCH body。 */
export interface UpdateProfilePayload {
  nickname?: string;
  avatar_url?: string;
}

/** 提交入驻申请 body。 */
export interface SubmitMerchantApplicationPayload {
  shop_name: string;
  contact_name: string;
  contact_phone: string;
  business_license_no: string;
  description?: string;
}
