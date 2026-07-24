import ky, { type KyInstance, HTTPError } from 'ky';
import type { ApiResponse } from '@/types';
import { getAccessTokenSync, getRefreshTokenSync, useAuthStore } from '@/lib/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';

// ---------------------------------------------------------------------------
// Refresh-on-401 状态机（单飞：并发 401 只触发一次刷新）
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string | null> | null = null;

/**
 * 尝试用 refresh token 换取新 access。返回新 access 或 null（refresh 失效）。
 * 注意：为避免循环依赖 auth-api → api → auth-api，此处直接使用 ky.create 的
 * 无 hooks 实例发请求。
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshTokenSync();
  if (!refreshToken) return null;

  try {
    const res = await ky
      .post(`${API_BASE_URL}/admin/auth/refresh`, {
        json: { refresh_token: refreshToken },
        timeout: 10_000,
        retry: 0,
        headers: { 'X-Client': 'admin-web' },
      })
      .json<
        ApiResponse<{
          access_token: string;
          refresh_token: string;
          expires_in: number;
        }>
      >();

    if (res.code !== 0 || !res.data) return null;

    useAuthStore.getState().updateTokens({
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
    });
    return res.data.access_token;
  } catch {
    return null;
  }
}

/**
 * 单飞刷新：并发 401 只会共享同一次刷新调用。
 */
function ensureRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * 平台管理员后台 ky 实例。
 *
 * - 统一 baseUrl、超时、重试
 * - 请求头带 `X-Client: admin-web` 供后端审计
 * - beforeRequest：自动注入 Authorization: Bearer <access>
 * - afterResponse：
 *   - 401 且 code=1002 → 触发 refresh，成功后重放请求；失败则 clearSession + 跳登录
 *   - 401/403 其他情况 → 交由业务层处理（unwrap 抛 ApiError）
 * - 后端约定统一响应体 { code, message, data }，非 0 code 由 unwrap 抛业务错误
 */
export const api: KyInstance = ky.create({
  prefixUrl: API_BASE_URL,
  timeout: 15_000,
  retry: {
    limit: 1,
    methods: ['get'],
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      (request) => {
        request.headers.set('X-Client', 'admin-web');
        const token = getAccessTokenSync();
        if (token && !request.headers.has('Authorization')) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        // 只处理 401；403 与业务错误由 unwrap 抛 ApiError
        if (response.status !== 401) return response;

        // 避免刷新端点自身进入死循环
        const url = new URL(request.url);
        if (url.pathname.endsWith('/admin/auth/refresh')) return response;

        // 若请求已带过 retry 标记则不再尝试，直接登出
        if (request.headers.get('X-Retry-After-Refresh') === '1') {
          useAuthStore.getState().clearSession();
          redirectToLogin();
          return response;
        }

        const newToken = await ensureRefresh();
        if (!newToken) {
          useAuthStore.getState().clearSession();
          redirectToLogin();
          return response;
        }

        // 用新 token 重放请求
        const retryHeaders = new Headers(request.headers);
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        retryHeaders.set('X-Retry-After-Refresh', '1');
        return ky(request.url, {
          ...options,
          method: request.method as never,
          headers: retryHeaders,
          retry: 0,
        });
      },
    ],
  },
});

/**
 * 客户端跳转到登录页。仅在浏览器环境生效；SSR 忽略。
 * 使用 window.location 而非 next/navigation.router 是因为 hook 运行在
 * React 树外部（api 层），无法访问 router 实例。
 */
function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const current = window.location.pathname + window.location.search;
  // 避免在 /login 上再次跳转造成刷新循环
  if (window.location.pathname === '/login') return;
  const target = `/login?redirect=${encodeURIComponent(current)}`;
  window.location.replace(target);
}

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
    this.name = 'ApiError';
  }
}

/**
 * 解包统一响应结构，返回业务 data；非 0 code 抛出 ApiError。
 */
export async function unwrap<T>(promise: Promise<ApiResponse<T>>): Promise<T> {
  let res: ApiResponse<T>;
  try {
    res = await promise;
  } catch (error) {
    if (error instanceof HTTPError) {
      let body: ApiResponse<unknown> | null = null;
      try {
        body = (await error.response.clone().json()) as ApiResponse<unknown>;
      } catch {
        body = null;
      }
      if (body && typeof body.code === 'number') {
        throw new ApiError(
          body.code,
          body.message ?? error.response.statusText ?? '请求失败',
          body.data,
        );
      }
    }
    throw error;
  }
  if (res.code !== 0) {
    throw new ApiError(res.code, res.message ?? '请求失败', res.data);
  }
  return res.data as T;
}

/**
 * 便捷方法：GET + unwrap。
 */
export async function apiGet<T>(url: string, init?: Parameters<KyInstance['get']>[1]): Promise<T> {
  return unwrap(api.get(url, init).json<ApiResponse<T>>());
}

/**
 * 便捷方法：POST(json) + unwrap。
 */
export async function apiPost<T, TBody = unknown>(
  url: string,
  body?: TBody,
  init?: Parameters<KyInstance['post']>[1],
): Promise<T> {
  return unwrap(api.post(url, { json: body, ...init }).json<ApiResponse<T>>());
}

/**
 * 便捷方法：PATCH(json) + unwrap。
 */
export async function apiPatch<T, TBody = unknown>(
  url: string,
  body?: TBody,
  init?: Parameters<KyInstance['patch']>[1],
): Promise<T> {
  return unwrap(api.patch(url, { json: body, ...init }).json<ApiResponse<T>>());
}

export { HTTPError };
