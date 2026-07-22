/**
 * 商家后台统一的 HTTP 客户端。
 *
 * 特性：
 * - 自动附加 `Authorization: Bearer <accessToken>`（来自 useMerchantAuthStore）
 * - 401 且 code=1002（token 过期）时静默 refresh，一次并发合流，成功后重放请求
 * - refresh 失败 → 清空会话 + 跳转 `/login?next=<current-path>`
 * - 所有非 2xx / code!=0 响应统一抛出 `ApiError`，业务层可用 `.toUserMessage()` 展示
 *
 * 与用户端 (frontend-user-web) 完全独立：绝不复用其 store / storage key。
 */

import ky, { HTTPError, type KyInstance, type KyResponse } from "ky";

import { useMerchantAuthStore } from "./auth-store";
import { ApiError, ErrorCode } from "@/types/errors";
import type { ApiResponse } from "@/types";

const isServer = typeof window === "undefined";

const BASE_URL =
  (isServer ? process.env.INTERNAL_API_BASE_URL : undefined) ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8000/api";

/**
 * 需要跳过 auth 逻辑的端点前缀。
 * login / refresh 本身不能挂 auto-refresh，否则会陷入死循环。
 */
const PUBLIC_ENDPOINT_PREFIXES = [
  "v1/merchant/auth/login",
  "v1/merchant/auth/refresh",
];

function isPublicEndpoint(url: string): boolean {
  return PUBLIC_ENDPOINT_PREFIXES.some((p) => url.includes(p));
}

/** 单飞：并发时只发一次 refresh 请求。 */
let refreshInflight: Promise<string | null> | null = null;

/**
 * 执行 refresh，返回新的 accessToken；失败返回 null 并已清空 store。
 * 使用裸 fetch 避免复用带拦截器的 ky 实例造成递归。
 */
async function performRefresh(): Promise<string | null> {
  const { refreshToken } = useMerchantAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/v1/merchant/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      useMerchantAuthStore.getState().clear();
      return null;
    }
    const body = (await res.json()) as ApiResponse<{
      access_token: string;
      refresh_token: string;
    }>;
    if (body.code !== 0 || !body.data) {
      useMerchantAuthStore.getState().clear();
      return null;
    }
    useMerchantAuthStore.getState().setTokens({
      accessToken: body.data.access_token,
      refreshToken: body.data.refresh_token,
    });
    return body.data.access_token;
  } catch {
    useMerchantAuthStore.getState().clear();
    return null;
  }
}

function refreshOnce(): Promise<string | null> {
  if (!refreshInflight) {
    refreshInflight = performRefresh().finally(() => {
      refreshInflight = null;
    });
  }
  return refreshInflight;
}

/** 跳转登录页；仅浏览器侧生效。 */
function redirectToLogin(): void {
  if (isServer) return;
  const current = window.location.pathname + window.location.search;
  const next = encodeURIComponent(current || "/dashboard");
  // 已在 login 页则不跳，避免刷新循环
  if (window.location.pathname.startsWith("/login")) return;
  window.location.assign(`/login?next=${next}`);
}

export const api: KyInstance = ky.create({
  prefixUrl: BASE_URL,
  timeout: 15_000,
  retry: {
    limit: 1,
    methods: ["get"],
  },
  hooks: {
    beforeRequest: [
      (request) => {
        request.headers.set(
          "X-App",
          process.env.NEXT_PUBLIC_APP_NAME ?? "merchant-web",
        );
        // 附带 access token（若已登录）
        const { accessToken } = useMerchantAuthStore.getState();
        if (accessToken && !isPublicEndpoint(request.url)) {
          request.headers.set("Authorization", `Bearer ${accessToken}`);
        }
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        // 情况 1：HTTP 2xx —— 解析业务 code；非 0 抛 ApiError
        if (response.ok) {
          // 部分端点（如 logout）后端可能返回空体；只在有 body 时校验
          const raw = await response.clone().text();
          if (!raw) return response;
          let body: ApiResponse<unknown> | null = null;
          try {
            body = JSON.parse(raw) as ApiResponse<unknown>;
          } catch {
            return response;
          }
          if (body && body.code !== 0) {
            throw new ApiError(
              body.code,
              body.message ?? "业务错误",
              response.status,
              body.data,
            );
          }
          return response;
        }

        // 情况 2：401/403 + code=1002 → refresh 一次重放
        if (
          response.status === 401 &&
          !isPublicEndpoint(request.url)
        ) {
          const raw = await response.clone().text();
          let body: ApiResponse<unknown> | null = null;
          try {
            body = raw ? (JSON.parse(raw) as ApiResponse<unknown>) : null;
          } catch {
            body = null;
          }
          const code = body?.code ?? ErrorCode.UNAUTHENTICATED;
          if (code === ErrorCode.TOKEN_EXPIRED) {
            const newAccess = await refreshOnce();
            if (newAccess) {
              const retried = await ky(request, {
                headers: { Authorization: `Bearer ${newAccess}` },
              });
              return retried as unknown as KyResponse;
            }
          }
          // refresh 未通过或直接 1001/1005 → 跳登录
          useMerchantAuthStore.getState().clear();
          redirectToLogin();
          throw new ApiError(
            code,
            body?.message ?? "未登录",
            response.status,
            body?.data,
          );
        }

        // 情况 3：其他 HTTP 错误 → 抛 ApiError（含业务码）
        const raw = await response.clone().text();
        let body: ApiResponse<unknown> | null = null;
        try {
          body = raw ? (JSON.parse(raw) as ApiResponse<unknown>) : null;
        } catch {
          body = null;
        }
        throw new ApiError(
          body?.code ?? response.status,
          body?.message ?? response.statusText ?? "请求失败",
          response.status,
          body?.data,
        );
      },
    ],
    beforeError: [
      // ky 在网络错误 / HTTPError 时会调用；上面 afterResponse 已抛 ApiError，
      // 这里只处理原生 HTTPError（罕见分支）。
      async (error) => {
        if (error instanceof HTTPError && error.response) {
          try {
            const raw = await error.response.clone().text();
            const body = raw ? (JSON.parse(raw) as ApiResponse<unknown>) : null;
            if (body) {
              return new ApiError(
                body.code,
                body.message,
                error.response.status,
                body.data,
              ) as unknown as HTTPError;
            }
          } catch {
            /* ignore */
          }
        }
        return error;
      },
    ],
  },
});

/**
 * 便捷 helper：解包 `{ code, message, data }` 拿到 data。
 * 已在 afterResponse 抛过 ApiError，因此这里能到达即为成功。
 */
export async function unwrap<T>(promise: Promise<KyResponse>): Promise<T> {
  const res = await promise;
  const body = (await res.json()) as ApiResponse<T>;
  return body.data;
}

export default api;
