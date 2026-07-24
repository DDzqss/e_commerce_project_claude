"use client";

import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { DEFAULT_PLACEHOLDER, imageUrl } from "@/lib/image";
import { cn } from "@/lib/cn";

export interface ImageWithFallbackProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** 后端返回的 MinIO object key，可空 */
  objectKey?: string | null;
  /** 备用图片；缺省为 /placeholder.svg */
  fallback?: string;
  /** 兼容直接传 src；优先级低于 objectKey */
  src?: string | null;
}

/**
 * <img> 包装：
 *   1. 把 object_key 拼成完整 URL
 *   2. onError 时替换为占位图（一次性，避免死循环）
 *
 * 之所以没用 next/image：Phase 2 CDN 域名尚未在 next.config remotePatterns 里放行；
 * next/image 会因 domain 校验直接拒绝。等 CDN 稳定后再切换。
 */
export function ImageWithFallback({
  objectKey,
  src,
  fallback = DEFAULT_PLACEHOLDER,
  className,
  alt = "",
  onError,
  ...rest
}: ImageWithFallbackProps) {
  const initial = objectKey
    ? imageUrl(objectKey, fallback)
    : src && src.length > 0
      ? src
      : fallback;
  const [currentSrc, setCurrentSrc] = useState(initial);
  const [errored, setErrored] = useState(false);

  // objectKey 变了（比如切换 SKU 图/切换商品）→ 重置到新地址
  useEffect(() => {
    setCurrentSrc(initial);
    setErrored(false);
  }, [initial]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      src={currentSrc}
      className={cn("block object-cover", className)}
      onError={(e) => {
        if (!errored && currentSrc !== fallback) {
          setErrored(true);
          setCurrentSrc(fallback);
        }
        onError?.(e);
      }}
      {...rest}
    />
  );
}
