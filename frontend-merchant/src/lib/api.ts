import ky, { type KyInstance } from "ky";

/**
 * 商家后台统一的 HTTP 客户端。
 *
 * - 浏览器侧使用 NEXT_PUBLIC_API_BASE_URL
 * - 服务端渲染 / 内部调用使用 INTERNAL_API_BASE_URL
 * - 后续可在此处统一注入 Authorization、错误处理、重试策略等
 */
const isServer = typeof window === "undefined";

const baseUrl =
  (isServer ? process.env.INTERNAL_API_BASE_URL : undefined) ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8000/api";

export const api: KyInstance = ky.create({
  prefixUrl: baseUrl,
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
      },
    ],
  },
});

export default api;
