"use client";

/**
 * 品牌 Logo 展示：小尺寸方形，圆角边框；无图时展示品牌名首字。
 *
 * 使用示例：
 *   <BrandLogo brand={brand} size={32} />
 *   <BrandLogo objectKey={row.logo_url} name={row.name} />
 */

import clsx from "clsx";
import { imageUrl, imagePlaceholder } from "@/lib/image";

interface BrandLogoProps {
  /** 直接传对象 key（首选）；或用 objectKey 单独传 */
  objectKey?: string | null;
  /** 品牌名，用于 alt 与无图 fallback（首字/首字母） */
  name?: string;
  /** 像素尺寸，默认 32 */
  size?: number;
  className?: string;
}

export function BrandLogo({
  objectKey,
  name,
  size = 32,
  className,
}: BrandLogoProps) {
  const src = objectKey ? imageUrl(objectKey) : null;
  const fallbackChar = (name?.trim() || "?").charAt(0).toUpperCase();

  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center overflow-hidden rounded border border-[color:var(--color-border)] bg-white text-xs font-medium text-neutral-500",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={name ? `${name} 品牌 Logo` : "品牌 Logo"}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? "品牌 Logo"}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = imagePlaceholder();
          }}
        />
      ) : (
        <span aria-hidden>{fallbackChar}</span>
      )}
    </span>
  );
}
