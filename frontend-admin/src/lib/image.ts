/**
 * 图片 URL 工具。
 *
 * 后端仅存 MinIO 的 `object_key`（如 `spu/2026/07/22/abc.jpg`）；
 * 前端渲染时统一拼 `${NEXT_PUBLIC_IMAGE_CDN}/${object_key}`。
 *
 * - 若传入已是完整 URL（`http(s)://` / `//` / `data:`），原样返回
 * - 若传入空 / null / undefined，返回一个内置 SVG 占位图
 *
 * 与 frontend-user-web / frontend-merchant 的 image.ts 保持三端一致，
 * 避免各端各自实现细节漂移。
 */

const IMAGE_CDN =
  process.env.NEXT_PUBLIC_IMAGE_CDN ?? "http://localhost:9000/jdclone-public";

/** 内置占位图，避免图片 404 时布局塌陷。 */
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>` +
      `<rect width='120' height='120' fill='#f3f4f6'/>` +
      `<text x='50%' y='50%' font-family='sans-serif' font-size='12' fill='#9ca3af' text-anchor='middle' dominant-baseline='middle'>无图</text>` +
      `</svg>`,
  );

function isAbsoluteUrl(v: string): boolean {
  return /^(https?:)?\/\//i.test(v) || v.startsWith("data:");
}

function stripTrailingSlash(v: string): string {
  return v.replace(/\/+$/g, "");
}

function stripLeadingSlash(v: string): string {
  return v.replace(/^\/+/, "");
}

/**
 * 将 object_key 拼成可访问的图片 URL。
 * @param objectKey MinIO 里的对象 key
 * @param fallback  可选：为空时返回的自定义占位 URL；不传则返回内置占位 SVG
 */
export function imageUrl(
  objectKey: string | null | undefined,
  fallback?: string,
): string {
  if (!objectKey) return fallback ?? PLACEHOLDER;
  const key = objectKey.trim();
  if (!key) return fallback ?? PLACEHOLDER;
  if (isAbsoluteUrl(key)) return key;
  return `${stripTrailingSlash(IMAGE_CDN)}/${stripLeadingSlash(key)}`;
}

/** 便捷获取占位图 URL（用于 img.onerror）。 */
export function imagePlaceholder(): string {
  return PLACEHOLDER;
}
