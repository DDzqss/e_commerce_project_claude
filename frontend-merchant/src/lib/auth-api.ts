/**
 * 商家端 Auth 相关 API 封装（§5.2）。
 *
 * 全部走统一 `api` 客户端；成功即返回 `data` 字段本身，错误统一为 `ApiError`。
 */

import { api, unwrap } from "./api";
import type {
  ChangePasswordIn,
  LoginMerchantIn,
  TokenPair,
} from "@/types/api";

/** `POST /api/v1/merchant/auth/login` */
export function loginMerchant(payload: LoginMerchantIn): Promise<TokenPair> {
  return unwrap<TokenPair>(
    api.post("v1/merchant/auth/login", { json: payload }),
  );
}

/**
 * `POST /api/v1/merchant/auth/refresh`
 * 常规业务代码一般无需直接调用；api.ts 已内置静默 refresh。
 * 此处保留以支持"主动续期"或测试。
 */
export function refresh(refreshToken: string): Promise<TokenPair> {
  return unwrap<TokenPair>(
    api.post("v1/merchant/auth/refresh", {
      json: { refresh_token: refreshToken },
    }),
  );
}

/**
 * `POST /api/v1/merchant/auth/logout`
 * 带 refresh_token 让后端 revoke；本地由调用方（useAuth.logout）负责清空 store。
 */
export async function logoutMerchant(refreshToken?: string | null): Promise<void> {
  await api.post("v1/merchant/auth/logout", {
    json: refreshToken ? { refresh_token: refreshToken } : {},
    // logout 不重试
    retry: 0,
  });
}

/** `POST /api/v1/merchant/auth/change-password` */
export async function changePassword(payload: ChangePasswordIn): Promise<void> {
  await api.post("v1/merchant/auth/change-password", { json: payload });
}
