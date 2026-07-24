"use client";

import { useEffect, useRef, useState } from "react";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  uploadFile,
  validateImageFile,
} from "@/lib/user-upload-api";
import type { UserUploadPurpose } from "@/types/aftersales";

export interface EvidenceItem {
  /** 后端 object_key（写入业务字段时用） */
  object_key: string;
  /** 展示用完整 URL */
  public_url?: string | null;
  /** 上传中的临时预览（Blob URL） */
  preview_url?: string | null;
  /** true 表示还在上传（还未拿到 object_key） */
  uploading?: boolean;
  /** 客户端临时 id */
  tmp_id?: string;
  /** 上传进度 0-100 */
  progress?: number;
}

interface EvidenceUploaderProps {
  value: EvidenceItem[];
  onChange: (v: EvidenceItem[]) => void;
  /** 售后场景：apply / user_return / appeal */
  purpose: UserUploadPurpose;
  /** 上限张数（默认 8）。 */
  max?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * 售后凭证上传器。
 *
 * - 复用 user-upload-api 的二步流程（presign → PUT MinIO）
 * - 图片上限 8 张（契约 §10）
 * - 上传中态：占位卡 + 进度条
 * - 失败：toast + 从队列移除
 *
 * 因为上传是并发 + 异步，onChange 只允许一次传入新数组，
 * 我们用一个 ref 追踪最新 value，内部读它再算 next。
 */
export function EvidenceUploader({
  value,
  onChange,
  purpose,
  max = 8,
  disabled = false,
  className,
}: EvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tmpCounter, setTmpCounter] = useState(0);

  // 保持"最新 value"引用，供并发回调读取
  const latestRef = useRef<EvidenceItem[]>(value);
  useEffect(() => {
    latestRef.current = value;
  }, [value]);

  const applyPatch = (next: EvidenceItem[]) => {
    latestRef.current = next;
    onChange(next);
  };

  const remaining = Math.max(0, max - value.length);

  const openPicker = () => {
    if (disabled || remaining <= 0) return;
    inputRef.current?.click();
  };

  const removeAt = (idx: number) => {
    const item = value[idx];
    if (item?.preview_url && item.preview_url.startsWith("blob:")) {
      URL.revokeObjectURL(item.preview_url);
    }
    applyPatch(value.filter((_, i) => i !== idx));
  };

  const handleFiles = async (files: FileList) => {
    const remainingNow = Math.max(0, max - latestRef.current.length);
    const list = Array.from(files).slice(0, remainingNow);
    if (list.length === 0) {
      if (files.length > 0) {
        toast.error(`最多上传 ${max} 张凭证`);
      }
      return;
    }

    const validFiles: { file: File; tmpId: string; previewUrl: string }[] = [];
    for (const f of list) {
      const err = validateImageFile(f);
      if (err) {
        toast.error(err);
        continue;
      }
      const tmpId = `tmp-${Date.now()}-${tmpCounter + validFiles.length}-${validFiles.length}`;
      validFiles.push({
        file: f,
        tmpId,
        previewUrl: URL.createObjectURL(f),
      });
    }
    setTmpCounter((n) => n + validFiles.length);
    if (validFiles.length === 0) return;

    const placeholders: EvidenceItem[] = validFiles.map((v) => ({
      object_key: "",
      preview_url: v.previewUrl,
      uploading: true,
      tmp_id: v.tmpId,
      progress: 0,
    }));
    applyPatch([...latestRef.current, ...placeholders]);

    await Promise.allSettled(
      validFiles.map(async ({ file, tmpId, previewUrl }) => {
        try {
          const result = await uploadFile(file, purpose, {
            onProgress: (percent) => {
              applyPatch(
                patchByTmpId(latestRef.current, tmpId, {
                  progress: percent,
                }),
              );
            },
          });
          applyPatch(
            patchByTmpId(latestRef.current, tmpId, {
              object_key: result.object_key,
              public_url: result.public_url,
              uploading: false,
              progress: 100,
              preview_url: previewUrl,
            }),
          );
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "图片上传失败");
          applyPatch(dropByTmpId(latestRef.current, tmpId));
          if (previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
          }
        }
      }),
    );
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        {value.map((it, idx) => {
          const src = it.preview_url ?? it.public_url ?? null;
          return (
            <div
              key={it.tmp_id ?? it.object_key ?? idx}
              className="relative h-20 w-20 overflow-hidden rounded border border-neutral-200 bg-neutral-50"
              data-testid={`evidence-item-${idx}`}
            >
              {src ? (
                <ImageWithFallback
                  src={src}
                  objectKey={it.object_key || null}
                  alt={`凭证 ${idx + 1}`}
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
              {!disabled && (
                <button
                  type="button"
                  aria-label="移除"
                  onClick={() => removeAt(idx)}
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
              )}
            </div>
          );
        })}
        {remaining > 0 && !disabled && (
          <button
            type="button"
            data-testid="evidence-uploader-add"
            onClick={openPicker}
            className={cn(
              "flex h-20 w-20 flex-col items-center justify-center rounded border border-dashed",
              "border-neutral-300 bg-white text-xs text-neutral-500",
              "hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]",
            )}
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
            <span className="mt-1">上传</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        {`最多 ${max} 张，单张 ≤ 5MB，支持 JPG / PNG / WebP`}
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
  );
}

function patchByTmpId(
  items: EvidenceItem[],
  tmpId: string,
  patch: Partial<EvidenceItem>,
): EvidenceItem[] {
  return items.map((it) => (it.tmp_id === tmpId ? { ...it, ...patch } : it));
}

function dropByTmpId(
  items: EvidenceItem[],
  tmpId: string,
): EvidenceItem[] {
  return items.filter((it) => it.tmp_id !== tmpId);
}
