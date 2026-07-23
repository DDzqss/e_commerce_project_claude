"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/image";
import { uploadFile, validateImageFile } from "@/lib/upload";
import { toast } from "@/components/ui/Toast";
import type { UploadPurpose } from "@/types/api";

export interface ImageUploadProps {
  /** 当前已上传的 object_key（受控）。空 → 未上传。 */
  value: string | null | undefined;
  /** 值变化回调（新 object_key 或 null 表示清空） */
  onChange: (objectKey: string | null) => void;
  /** 上传用途，决定 MinIO 前缀 */
  purpose: UploadPurpose;
  /** 是否只读（详情态 / pending_review 时使用） */
  disabled?: boolean;
  /** 尺寸（tailwind 类，默认 "h-28 w-28"） */
  sizeClass?: string;
  /** 便于表单校验时高亮红边 */
  invalid?: boolean;
  className?: string;
  /** 无值时的提示文本 */
  hint?: string;
}

/**
 * 单张图片上传组件。
 *
 * 特性：
 *   - 拖拽 / 点选两种交互
 *   - 上传中禁用点击并显示进度条
 *   - 失败 toast + 保留原值（可再次尝试）
 *   - 已上传后：显示预览、悬停出现"删除"按钮
 */
export function ImageUpload({
  value,
  onChange,
  purpose,
  disabled = false,
  sizeClass = "h-28 w-28",
  invalid = false,
  className,
  hint = "点击或拖拽上传图片",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const doUpload = useCallback(
    async (file: File) => {
      const err = validateImageFile(file);
      if (err) {
        toast.error(err);
        return;
      }
      setUploading(true);
      setProgress(0);
      try {
        const res = await uploadFile(file, purpose, {
          onProgress: (p) => setProgress(p),
        });
        onChange(res.object_key);
        toast.success("图片上传成功");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "上传失败，请重试";
        toast.error(msg);
      } finally {
        setUploading(false);
        setProgress(0);
        // 重置 input，允许再次选择同名文件
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onChange, purpose],
  );

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void doUpload(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void doUpload(file);
  };

  const openPicker = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const clear = () => {
    if (disabled || uploading) return;
    onChange(null);
  };

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={openPicker}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "group relative flex items-center justify-center overflow-hidden rounded-md border border-dashed bg-neutral-50 text-xs text-neutral-500 transition-colors",
          sizeClass,
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-[var(--color-primary)] hover:bg-blue-50/40",
          dragOver && "border-[var(--color-primary)] bg-blue-50",
          invalid ? "border-red-400" : "border-neutral-300",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(value)}
            alt="已上传图片"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 px-2 text-center">
            <span aria-hidden className="text-xl leading-none">
              +
            </span>
            <span>{hint}</span>
          </div>
        )}

        {/* 上传进度条 */}
        {uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
            <span className="text-xs">上传中 {progress}%</span>
            <div className="h-1 w-3/4 overflow-hidden rounded bg-white/30">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* 悬停删除按钮 */}
        {value && !uploading && !disabled ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="absolute right-1 top-1 hidden rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white group-hover:block"
            aria-label="删除图片"
          >
            删除
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
        disabled={disabled || uploading}
      />
    </div>
  );
}
