"use client";

/**
 * 简化版单图上传组件。
 *
 * - 三步：选择 → validate → uploadImage(file, purpose) → 返回 object_key
 * - 无缩略图裁剪、无多图队列（Phase 2 admin 只用于类目 icon / 品牌 logo）
 * - 上传中禁用按钮 + 显示 spinner；失败通过 onError 抛给父层展示 Toast
 *
 * 使用示例：
 *   <ImageUpload
 *     purpose="category_icon"
 *     value={form.icon_url}
 *     onChange={(key) => setForm({ ..., icon_url: key })}
 *     size={80}
 *   />
 */

import { useRef, useState } from "react";
import clsx from "clsx";
import { uploadImage, validateImage } from "@/lib/upload-api";
import { imageUrl, imagePlaceholder } from "@/lib/image";
import type { UploadPurpose } from "@/types/api";

interface ImageUploadProps {
  value: string | null | undefined;
  onChange: (objectKey: string | null) => void;
  purpose: UploadPurpose;
  /** 展示尺寸，默认 80px 方形 */
  size?: number;
  /** 上传失败时的回调（父层用 Toast 展示） */
  onError?: (message: string) => void;
  /** 允许清空 */
  clearable?: boolean;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  purpose,
  size = 80,
  onError,
  clearable = true,
  disabled = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = () => {
    if (uploading || disabled) return;
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 清空 input value 允许重复选择同一文件
    e.target.value = "";
    if (!file) return;

    const invalid = validateImage(file);
    if (invalid) {
      onError?.(invalid);
      return;
    }

    setUploading(true);
    try {
      const key = await uploadImage(file, purpose);
      onChange(key);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "上传失败，请稍后重试";
      onError?.(msg);
    } finally {
      setUploading(false);
    }
  };

  const src = value ? imageUrl(value) : null;

  return (
    <div className="flex items-start gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={value ? "更换图片" : "上传图片"}
        onClick={handlePick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handlePick();
          }
        }}
        className={clsx(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded border border-dashed border-[color:var(--color-border)] bg-neutral-50 text-xs text-neutral-400 transition",
          !disabled && !uploading && "cursor-pointer hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]",
          (uploading || disabled) && "cursor-not-allowed opacity-70",
        )}
        style={{ width: size, height: size }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="已上传"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = imagePlaceholder();
            }}
          />
        ) : (
          <span aria-hidden>+ 上传</span>
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[11px] text-neutral-600">
            上传中…
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 text-xs text-neutral-500">
        <span>支持 JPG / PNG / WebP，≤ 5MB</span>
        {value && clearable && !disabled ? (
          <button
            type="button"
            className="self-start text-[color:var(--color-danger)] hover:underline"
            onClick={() => onChange(null)}
          >
            移除
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
