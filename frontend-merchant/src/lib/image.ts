/**
 * 图片 URL 工具。
 *
 * 后端仅存 MinIO 的 `object_key`；前端渲染时拼接：
 *   `${NEXT_PUBLIC_IMAGE_CDN}/${object_key}`
 *
 * - 若传入已经是完整 URL（`http://` / `https://` / `//`），直接返回原值
 * - 若传入空 / null / undefined，返回占位图 URL
 *
 * 与 user-web 保持一致，便于三端一致的图片处理策略。
 */

const IMAGE_CDN =
  process.env.NEXT_PUBLIC_IMAGE_CDN ?? "http://localhost:9000/jdclone-public";

/** 内置占位图，避免图片加载失败时布局塌陷。 */
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

function stripSlash(v: string): string {
  return v.replace(/\/+$/g, "");
}

function stripLeadingSlash(v: string): string {
  return v.replace(/^\/+/, "");
}

/**
 * 将 object_key 拼成可访问的图片 URL。
 * @param objectKey MinIO 里的对象 key，如 `spu/2026/07/22/abc.jpg`
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
  return `${stripSlash(IMAGE_CDN)}/${stripLeadingSlash(key)}`;
}

/** 便捷获取占位图 URL（用于 img.onerror）。 */
export function imagePlaceholder(): string {
  return PLACEHOLDER;
}
