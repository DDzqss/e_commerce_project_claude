/**
 * 图片资源工具。
 *
 * 契约（docs/API/phase-2-contracts.md §1、§9）：
 *   - 后端返回的图片字段一律是 MinIO object_key（如 "spu/2026/07/22/xxx.jpg"），不含 host
 *   - 前端渲染时拼 `${NEXT_PUBLIC_IMAGE_CDN}/${object_key}`
 *   - 本地开发默认 `http://localhost:9000/jdclone-public`
 *
 * 该模块只做纯字符串拼接，不发起网络请求；404 兜底由 `<ImageWithFallback>` 组件在 onError 中处理。
 */

const DEFAULT_CDN = "http://localhost:9000/jdclone-public";

/** 站点默认占位图（放在 public/placeholder.svg）。 */
export const DEFAULT_PLACEHOLDER = "/placeholder.svg";

/**
 * 读取 CDN 前缀。放函数里方便测试 stub、SSR/CSR 同时可用。
 * `process.env.NEXT_PUBLIC_IMAGE_CDN` 在客户端由 Next.js 静态替换，因此无需 useEffect。
 */
export function getImageCdn(): string {
  const raw = process.env.NEXT_PUBLIC_IMAGE_CDN;
  const cdn = raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_CDN;
  return cdn.replace(/\/+$/, "");
}

/**
 * 判断是否是完整 URL（http(s):// 开头）或站内绝对路径（/ 开头）。
 * 这两种情况都不再拼 CDN 前缀。
 */
function isAbsoluteUrl(input: string): boolean {
  return /^(https?:)?\/\//i.test(input) || input.startsWith("/");
}

/**
 * 将 object_key 转成可以直接放到 `<img src>` 的完整 URL。
 *
 * @param objectKey 后端返回的 MinIO object key；null/undefined 一律返回 fallback
 * @param fallback  兜底 URL（默认 /placeholder.svg）
 */
export function imageUrl(
  objectKey?: string | null,
  fallback: string = DEFAULT_PLACEHOLDER,
): string {
  if (!objectKey || objectKey.trim().length === 0) {
    return fallback;
  }
  const key = objectKey.trim();
  if (isAbsoluteUrl(key)) {
    return key;
  }
  const cdn = getImageCdn();
  // 去掉 key 前导 "/"，避免 "http://host//path"
  const normalizedKey = key.replace(/^\/+/, "");
  return `${cdn}/${normalizedKey}`;
}
