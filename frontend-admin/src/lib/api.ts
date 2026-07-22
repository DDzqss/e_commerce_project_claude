import ky, { type KyInstance, HTTPError } from "ky";
import type { ApiResponse } from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

/**
 * 平台管理员后台 ky 实例。
 *
 * - 统一 baseUrl、超时、重试
 * - 请求头带 `X-Client: admin-web` 供后端审计
 * - 请求前注入管理员 JWT（Phase 1 接入 auth store 后从中读取）
 * - 401 触发登出跳转、403 提示"权限不足"（拦截层逻辑后续补齐）
 * - 后端约定统一响应体 { code, message, data }，非 0 code 由 unwrap 抛业务错误
 *
 * 业务代码应通过 `apiGet<T>(...)` / `apiPost<T>(...)` 调用，
 * 不允许在业务层直接 import fetch / axios。
 */
export const api: KyInstance = ky.create({
  prefixUrl: API_BASE_URL,
  timeout: 15_000,
  retry: {
    limit: 1,
    methods: ["get"],
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      (request) => {
        // TODO(Phase 1): 从 auth store / httpOnly cookie 读取管理员 access token
        // const token = getAdminAccessToken();
        // if (token) request.headers.set("Authorization", `Bearer ${token}`);
        request.headers.set("X-Client", "admin-web");
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        // TODO(Phase 1):
        //   - 401 → 清空 auth store 并 redirect("/login")
        //   - 403 → toast "无权限"
        //   - 业务错误码统一交由 unwrap 处理
        return response;
      },
    ],
  },
});

/**
 * 业务错误：后端返回 code !== 0 时抛出。
 */
export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 解包统一响应结构，返回业务 data；非 0 code 抛出 ApiError。
 */
export async function unwrap<T>(promise: Promise<ApiResponse<T>>): Promise<T> {
  const res = await promise;
  if (res.code !== 0) {
    throw new ApiError(res.code, res.message ?? "请求失败", res.data);
  }
  return res.data as T;
}

/**
 * 便捷方法：GET + unwrap。
 */
export async function apiGet<T>(
  url: string,
  init?: Parameters<KyInstance["get"]>[1],
): Promise<T> {
  return unwrap(api.get(url, init).json<ApiResponse<T>>());
}

/**
 * 便捷方法：POST(json) + unwrap。
 */
export async function apiPost<T, TBody = unknown>(
  url: string,
  body?: TBody,
  init?: Parameters<KyInstance["post"]>[1],
): Promise<T> {
  return unwrap(api.post(url, { json: body, ...init }).json<ApiResponse<T>>());
}

export { HTTPError };
