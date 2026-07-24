/**
 * 管理员认证 API 封装。
 *
 * 端点：契约 §5.3 Admin 域
 * - POST /admin/auth/login    { username, password }
 * - POST /admin/auth/refresh  { refresh_token }
 * - POST /admin/auth/logout   { refresh_token? }
 * - POST /admin/auth/change-password { old_password, new_password }
 *
 * 所有函数直接返回业务 data（apiPost/unwrap 已剥壳）；错误统一抛 ApiError。
 */

import { apiPost } from "@/lib/api";
import type {
  AdminLoginResponse,
  AdminRefreshResponse,
} from "@/types/api";

export interface LoginPayload {
  username: string;
  password: string;
}

/**
 * POST /admin/auth/login
 * 成功返回 { admin, access_token, refresh_token, expires_in }
 * 错误：1003（账号或密码错误） / 1004（账号被禁用）
 */
export function loginAdmin(payload: LoginPayload): Promise<AdminLoginResponse> {
  return apiPost<AdminLoginResponse, LoginPayload>("admin/auth/login", payload);
}

/**
 * POST /admin/auth/refresh
 * 用于长期会话续期；rotate 策略，旧 refresh 立即失效。
 * 一般情况下由 api.ts 的 401 拦截自动调用，页面层无需直接触发。
 */
export function refreshAdminToken(
  refreshToken: string,
): Promise<AdminRefreshResponse> {
  return apiPost<AdminRefreshResponse>("admin/auth/refresh", {
    refresh_token: refreshToken,
  });
}

/**
 * POST /admin/auth/logout
 * 后端会 revoke 该 refresh token；access token 靠自然过期（JWT 无中心黑名单）。
 * 即便调用失败，前端也应清空本地 session。
 */
export function logoutAdmin(refreshToken: string | null): Promise<null> {
  return apiPost<null>("admin/auth/logout", {
    refresh_token: refreshToken,
  });
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

/**
 * POST /admin/auth/change-password
 * 修改成功后建议前端登出、重新登录（避免旧 access 继续使用带来的困惑）。
 * 错误：2010 旧密码错误 / 5001 校验失败
 */
export function changeAdminPassword(
  payload: ChangePasswordPayload,
): Promise<null> {
  return apiPost<null, ChangePasswordPayload>(
    "admin/auth/change-password",
    payload,
  );
}
