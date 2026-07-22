import ky, { type KyInstance, HTTPError, type NormalizedOptions } from "ky";
import type { ApiResponse } from "@/types";
import { ErrorCode } from "@/types/errors";
import {
  getAccessToken,
  getRefreshToken,
  useAuthStore,
} from "./auth-store";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

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
 * 用于避免并发多次 refresh。第一个 401 触发 refresh，后续 401 复用同一个 Promise。
 * refresh 完成后所有等待中的请求重放。
 */
let refreshInFlight: Promise<string | null> | null = null;

/** 触发登出的钩子；在浏览器端会跳登录页，服务端渲染时静默清空 store。 */
function forceLogout(nextPath?: string) {
  useAuthStore.getState().logout();
  if (typeof window !== "undefined") {
    const next = nextPath ?? window.location.pathname + window.location.search;
    // 避免死循环：登录页本身 401 不再跳
    if (!window.location.pathname.startsWith("/login")) {
      const q = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
      window.location.href = `/login${q}`;
    }
  }
}

/**
 * 尝试用 refresh_token 换新 access_token。
 * 成功返回新 access；失败清空 store + 跳登录并返回 null。
 *
 * 注意：不复用主 api 实例（避免和 afterResponse hook 相互递归）。
 * 直接用一个 minimal ky 调用。
 */
async function tryRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    forceLogout();
    return null;
  }
  try {
    // 独立实例：不带 auth hook、不带 afterResponse 重放
    const res = await ky
      .post("user/auth/refresh", {
        prefixUrl: API_BASE_URL,
        timeout: 10_000,
        retry: 0,
        json: { refresh_token: refreshToken },
        throwHttpErrors: false,
      })
      .json<ApiResponse<{ access_token: string; refresh_token: string; expires_in: number }>>();

    if (res.code !== 0 || !res.data) {
      forceLogout();
      return null;
    }
    useAuthStore.getState().setTokens({
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
    });
    return res.data.access_token;
  } catch {
    forceLogout();
    return null;
  }
}

/**
 * 全局 ky 实例。
 *
 * - baseUrl、超时、有限重试
 * - beforeRequest：自动带上 Authorization: Bearer <access>
 * - afterResponse：
 *   · 401 且业务 code=1002（token 过期）→ 触发 refresh → 用新 token 重放本请求一次
 *   · 401 且业务 code=1001/1005 → 清 store + 跳登录
 *
 * 业务代码应通过 `apiGet<T>(...)` / `apiPost<T>(...)` 等便捷方法调用。
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
        request.headers.set("X-Client", "user-web");
        const token = getAccessToken();
        if (token && !request.headers.has("Authorization")) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (request, options: NormalizedOptions, response) => {
        // 只对 401 处理；其他状态原样返回
        if (response.status !== 401) return response;

        // 若该请求已经是重放过一次的（打了 flag），不再重试，直接返回让业务处理
        if (request.headers.get("X-Retry-After-Refresh") === "1") {
          return response;
        }

        // 解析 body 判断业务 code。ky Response 允许多次读取（内置支持）
        let body: ApiResponse<unknown> | null = null;
        try {
          body = (await response.clone().json()) as ApiResponse<unknown>;
        } catch {
          // body 不是 JSON，无法判断，直接返回
          return response;
        }

        // 仅在 token 过期时尝试 refresh；其他 401（如未登录/权限不足）直接跳登录
        if (body?.code === ErrorCode.TokenExpired) {
          // 并发合流：只发一次 refresh
          if (!refreshInFlight) {
            refreshInFlight = tryRefresh().finally(() => {
              refreshInFlight = null;
            });
          }
          const newToken = await refreshInFlight;
          if (!newToken) {
            // refresh 失败已在 tryRefresh 里跳登录了
            return response;
          }
          // 用新 token 重放一次
          const retryHeaders = new Headers(options.headers);
          retryHeaders.set("Authorization", `Bearer ${newToken}`);
          retryHeaders.set("X-Retry-After-Refresh", "1");
          return ky(request, {
            ...options,
            headers: retryHeaders,
          });
        }

        if (
          body?.code === ErrorCode.Unauthorized ||
          body?.code === ErrorCode.RefreshInvalid
        ) {
          forceLogout();
        }

        return response;
      },
    ],
  },
});

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

/**
 * 便捷方法：PATCH(json) + unwrap。
 */
export async function apiPatch<T, TBody = unknown>(
  url: string,
  body?: TBody,
  init?: Parameters<KyInstance["patch"]>[1],
): Promise<T> {
  return unwrap(api.patch(url, { json: body, ...init }).json<ApiResponse<T>>());
}

/**
 * 便捷方法：DELETE + unwrap。
 */
export async function apiDelete<T>(
  url: string,
  init?: Parameters<KyInstance["delete"]>[1],
): Promise<T> {
  return unwrap(api.delete(url, init).json<ApiResponse<T>>());
}

export { HTTPError };
