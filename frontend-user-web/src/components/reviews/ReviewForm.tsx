"use client";

import { useEffect, useRef, useState } from "react";
import { StarRating } from "@/components/ui/StarRating";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  uploadFile,
  validateImageFile,
} from "@/lib/user-upload-api";

/**
 * 单个评价表单项（订单商品级）。
 *
 * - 星级选择（键盘可用）
 * - 评价内容（5-2000 字）
 * - 图片上传（≤ 6 张，走 user-upload-api，purpose 复用 aftersales_apply）
 * - 匿名评价开关（前端展示"匿***名"）
 *
 * 值的形状与父组件的 form 状态保持 flat：由父传入 value + onChange。
 */

export interface ReviewFormValue {
  rating: number;
  content: string;
  images: ReviewFormImage[];
  is_anonymous: boolean;
}

export interface ReviewFormImage {
  object_key: string;
  preview_url?: string | null;
  public_url?: string | null;
  uploading?: boolean;
  tmp_id?: string;
  progress?: number;
}

interface ReviewFormProps {
  value: ReviewFormValue;
  onChange: (v: ReviewFormValue) => void;
  /** 评价对象商品的展示（不必必填）。 */
  header?: React.ReactNode;
  /** 最大图片数（默认 6，契约 §4） */
  maxImages?: number;
  /** 评价内容长度上限 */
  maxContent?: number;
  /** 内容长度下限（契约 §4：5-2000 字） */
  minContent?: number;
  disabled?: boolean;
  className?: string;
  /** 内容字段错误 */
  contentError?: string | null;
  /** 评分错误 */
  ratingError?: string | null;
}

const DEFAULT_MIN = 5;
const DEFAULT_MAX = 2000;

export function ReviewForm({
  value,
  onChange,
  header,
  maxImages = 6,
  maxContent = DEFAULT_MAX,
  minContent = DEFAULT_MIN,
  disabled = false,
  className,
  contentError,
  ratingError,
}: ReviewFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tmpCounter, setTmpCounter] = useState(0);
  const latestRef = useRef<ReviewFormValue>(value);
  useEffect(() => {
    latestRef.current = value;
  }, [value]);

  const applyPatch = (next: ReviewFormValue) => {
    latestRef.current = next;
    onChange(next);
  };

  const openPicker = () => {
    if (disabled) return;
    if (value.images.length >= maxImages) return;
    inputRef.current?.click();
  };

  const removeImage = (idx: number) => {
    const it = value.images[idx];
    if (it?.preview_url?.startsWith("blob:")) {
      URL.revokeObjectURL(it.preview_url);
    }
    applyPatch({
      ...value,
      images: value.images.filter((_, i) => i !== idx),
    });
  };

  const handleFiles = async (files: FileList) => {
    const now = latestRef.current;
    const remaining = Math.max(0, maxImages - now.images.length);
    const list = Array.from(files).slice(0, remaining);
    if (list.length === 0) {
      if (files.length > 0) toast.error(`最多上传 ${maxImages} 张图片`);
      return;
    }
    const validFiles: { file: File; tmpId: string; previewUrl: string }[] = [];
    for (const f of list) {
      const err = validateImageFile(f);
      if (err) {
        toast.error(err);
        continue;
      }
      const tmpId = `rvw-${Date.now()}-${tmpCounter + validFiles.length}`;
      validFiles.push({
        file: f,
        tmpId,
        previewUrl: URL.createObjectURL(f),
      });
    }
    setTmpCounter((n) => n + validFiles.length);
    if (validFiles.length === 0) return;

    const placeholders: ReviewFormImage[] = validFiles.map((v) => ({
      object_key: "",
      preview_url: v.previewUrl,
      uploading: true,
      tmp_id: v.tmpId,
      progress: 0,
    }));

    applyPatch({
      ...latestRef.current,
      images: [...latestRef.current.images, ...placeholders],
    });

    await Promise.allSettled(
      validFiles.map(async ({ file, tmpId, previewUrl }) => {
        try {
          // 契约未强制新增 review purpose，复用 user 通用 aftersales_apply
          const result = await uploadFile(file, "aftersales_apply", {
            onProgress: (percent) => {
              applyPatch({
                ...latestRef.current,
                images: patchImage(latestRef.current.images, tmpId, {
                  progress: percent,
                }),
              });
            },
          });
          applyPatch({
            ...latestRef.current,
            images: patchImage(latestRef.current.images, tmpId, {
              object_key: result.object_key,
              public_url: result.public_url,
              uploading: false,
              progress: 100,
              preview_url: previewUrl,
            }),
          });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "图片上传失败");
          applyPatch({
            ...latestRef.current,
            images: latestRef.current.images.filter((it) => it.tmp_id !== tmpId),
          });
          if (previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
          }
        }
      }),
    );
  };

  const contentLen = value.content.length;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {header}

      <div className="flex items-center gap-3">
        <span className="w-16 text-sm text-neutral-600">评分</span>
        <StarRating
          value={value.rating}
          onChange={(v) => applyPatch({ ...value, rating: v })}
          size={24}
        />
        <span className="text-xs text-neutral-500">
          {value.rating > 0 ? `${value.rating} 星` : "请选择"}
        </span>
      </div>
      {ratingError && (
        <p className="ml-16 text-xs text-[color:var(--color-primary)]">
          {ratingError}
        </p>
      )}

      <div>
        <textarea
          value={value.content}
          onChange={(e) => applyPatch({ ...value, content: e.target.value })}
          rows={4}
          maxLength={maxContent}
          disabled={disabled}
          placeholder={`分享一下您的使用体验（${minContent}-${maxContent} 字）`}
          className={cn(
            "w-full rounded-md border border-neutral-300 bg-white p-3 text-sm text-neutral-800",
            "focus:border-[color:var(--color-primary)] focus:outline-none",
            contentError && "border-[color:var(--color-primary)]",
          )}
          data-testid="review-content-input"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span
            className={cn(
              "text-neutral-500",
              contentError && "text-[color:var(--color-primary)]",
            )}
          >
            {contentError ?? `${contentLen}/${maxContent}`}
          </span>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-2">
          {value.images.map((it, idx) => {
            const src = it.preview_url ?? it.public_url ?? null;
            return (
              <div
                key={it.tmp_id ?? it.object_key ?? idx}
                className="relative h-20 w-20 overflow-hidden rounded border border-neutral-200 bg-neutral-50"
                data-testid={`review-image-${idx}`}
              >
                {src ? (
                  <ImageWithFallback
                    src={src}
                    objectKey={it.object_key || null}
                    alt=""
                    className="h-full w-full"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                    加载中
                  </div>
                )}
                {it.uploading && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-200">
                    <div
                      className="h-full bg-[color:var(--color-primary)] transition-[width]"
                      style={{ width: `${Math.max(4, it.progress ?? 0)}%` }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  aria-label="移除图片"
                  onClick={() => removeImage(idx)}
                  disabled={disabled}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
          {value.images.length < maxImages && !disabled && (
            <button
              type="button"
              onClick={openPicker}
              className="flex h-20 w-20 flex-col items-center justify-center rounded border border-dashed border-neutral-300 bg-white text-xs text-neutral-500 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
              data-testid="review-image-add"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span className="mt-1">添加图</span>
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          最多 {maxImages} 张，单张 ≤ 5MB，JPG / PNG / WebP
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              void handleFiles(e.target.files);
            }
            e.target.value = "";
          }}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={value.is_anonymous}
          onChange={(e) =>
            applyPatch({ ...value, is_anonymous: e.target.checked })
          }
          disabled={disabled}
          data-testid="review-anonymous-toggle"
        />
        匿名评价（对外显示 &ldquo;匿***名&rdquo;）
      </label>
    </div>
  );
}

function patchImage(
  items: ReviewFormImage[],
  tmpId: string,
  patch: Partial<ReviewFormImage>,
): ReviewFormImage[] {
  return items.map((it) =>
    it.tmp_id === tmpId ? { ...it, ...patch } : it,
  );
}
