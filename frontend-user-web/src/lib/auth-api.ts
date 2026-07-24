/**
 * User 域认证 API 封装。
 *
 * 严格对齐 docs/API/phase-1-contracts.md §5.1：
 *   POST /user/auth/register
 *   POST /user/auth/login
 *   POST /user/auth/refresh
 *   POST /user/auth/logout
 *   POST /user/auth/forgot-password
 *   POST /user/auth/reset-password
 *   POST /user/me/change-password
 *
 * 所有函数返回强类型；错误由 apiPost 抛出 ApiError（含业务 code）。
 * 路径统一相对于 baseUrl（不含 /api/v1 前缀，因为 baseUrl 已包含）。
 */

import { apiGet, apiPatch, apiPost } from "./api";
import type {
  AuthResult,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginUserPayload,
  RegisterUserPayload,
  ResetPasswordPayload,
  TokenPair,
  UpdateProfilePayload,
  UserMeOut,
  UserOut,
} from "@/types/api";

/** POST /user/auth/register */
export function registerUser(payload: RegisterUserPayload): Promise<AuthResult> {
  return apiPost<AuthResult, RegisterUserPayload>(
    "user/auth/register",
    payload,
  );
}

/** POST /user/auth/login */
export function loginUser(payload: LoginUserPayload): Promise<AuthResult> {
  return apiPost<AuthResult, LoginUserPayload>("user/auth/login", payload);
}

/** POST /user/auth/refresh */
export function refresh(refreshToken: string): Promise<TokenPair> {
  return apiPost<TokenPair, { refresh_token: string }>("user/auth/refresh", {
    refresh_token: refreshToken,
  });
}

/** POST /user/auth/logout */
export function logout(refreshToken?: string | null): Promise<null> {
  return apiPost<null, { refresh_token?: string }>(
    "user/auth/logout",
    refreshToken ? { refresh_token: refreshToken } : {},
  );
}

/** POST /user/auth/forgot-password */
export function forgotPassword(
  payload: ForgotPasswordPayload,
): Promise<null> {
  return apiPost<null, ForgotPasswordPayload>(
    "user/auth/forgot-password",
    payload,
  );
}

/** POST /user/auth/reset-password */
export function resetPassword(payload: ResetPasswordPayload): Promise<null> {
  return apiPost<null, ResetPasswordPayload>(
    "user/auth/reset-password",
    payload,
  );
}

/** GET /user/me */
export function fetchMe(): Promise<UserMeOut> {
  return apiGet<UserMeOut>("user/me");
}

/**
 * PATCH /user/me — 修改昵称/头像。
 */
export function updateProfile(
  payload: UpdateProfilePayload,
): Promise<UserOut> {
  return apiPatch<UserOut, UpdateProfilePayload>("user/me", payload);
}

/** POST /user/me/change-password */
export function changePassword(
  payload: ChangePasswordPayload,
): Promise<null> {
  return apiPost<null, ChangePasswordPayload>(
    "user/me/change-password",
    payload,
  );
}
