/**
 * Admin 通用 API（非认证相关）。
 * 契约 §6.3 GET /api/v1/admin/me
 */

import { apiGet } from "@/lib/api";
import type { AdminMeOut } from "@/types/api";

/**
 * GET /admin/me
 * 返回当前 admin 详情 + 权限列表。
 * 登录后应立即调用一次，把 permissions 存入 auth-store。
 */
export function getAdminMe(): Promise<AdminMeOut> {
  return apiGet<AdminMeOut>("admin/me");
}
