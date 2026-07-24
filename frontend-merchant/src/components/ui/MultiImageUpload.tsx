"use client";

import { useCallback, useRef, useState, type ChangeEvent } from "react";

import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/image";
import { uploadFile, validateImageFile } from "@/lib/upload";
import { toast } from "@/components/ui/Toast";
import type { UploadPurpose } from "@/types/api";

export interface MultiImageUploadProps {
  /** 当前 object_key 数组（受控） */
  value: string[];
  /** 变化回调 */
  onChange: (keys: string[]) => void;
  /** 上传用途，决定 MinIO 前缀 */
  purpose: UploadPurpose;
  /** 最多允许上传数量，默认 8 */
  max?: number;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

interface UploadingItem {
  id: string;
  progress: number;
}

/**
 * 多图上传组件。
 *
 * - 最多 max 张（默认 8，对应 §3.3 spus.images 上限）
 * - 支持批量选择
 * - 支持左右移动排序（简单实现，不引入拖拽库）
 * - 单张失败不影响其他张
 */
export function MultiImageUpload({
  value,
  onChange,
  purpose,
  max = 8,
  disabled = false,
  invalid = false,
  className,
}: MultiImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploadings, setUploadings] = useState<UploadingItem[]>([]);

  const canAddMore = value.length + uploadings.length < max;

  const uploadOne = useCallback(
    async (file: File) => {
      const err = validateImageFile(file);
      if (err) {
        toast.error(`${file.name}：${err}`);
        return;
      }
      const id = `up_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setUploadings((s) => [...s, { id, progress: 0 }]);
      try {
        const res = await uploadFile(file, purpose, {
          onProgress: (p) =>
            setUploadings((s) =>
              s.map((it) => (it.id === id ? { ...it, progress: p } : it)),
            ),
        });
        // 用最新的 value 追加，避免闭包旧值
        onChangeAppend(res.object_key);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "上传失败，请重试";
        toast.error(`${file.name}：${msg}`);
      } finally {
        setUploadings((s) => s.filter((it) => it.id !== id));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purpose],
  );

  // 用 ref 拿到最新 value，避免异步回来后覆盖别的成功上传
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeAppend = (key: string) => {
    onChange([...valueRef.current, key]);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = max - value.length - uploadings.length;
    const toUpload = files.slice(0, Math.max(0, remaining));
    if (files.length > toUpload.length) {
      toast.warning(`最多上传 ${max} 张，已忽略多余的 ${files.length - toUpload.length} 张`);
    }
    for (const f of toUpload) void uploadOne(f);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (index: number) => {
    if (disabled) return;
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
  };

  const move = (index: number, dir: -1 | 1) => {
    if (disabled) return;
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    onChange(next);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {value.map((key, idx) => (
          <div
            key={`${key}-${idx}`}
            className={cn(
              "group relative h-24 w-24 overflow-hidden rounded-md border bg-neutral-50",
              invalid ? "border-red-400" : "border-neutral-200",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(key)}
              alt={`图片${idx + 1}`}
              className="h-full w-full object-cover"
            />
            {!disabled ? (
              <div className="absolute inset-x-0 bottom-0 hidden justify-between bg-black/60 px-1 py-0.5 text-[10px] text-white group-hover:flex">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                  className="disabled:opacity-40"
                  aria-label="上移"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  aria-label="删除"
                >
                  删
                </button>
                <button
                  type="button"
                  disabled={idx === value.length - 1}
                  onClick={() => move(idx, 1)}
                  className="disabled:opacity-40"
                  aria-label="下移"
                >
                  ›
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {uploadings.map((u) => (
          <div
            key={u.id}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-500"
          >
            <span>上传中 {u.progress}%</span>
            <div className="mt-1 h-1 w-16 overflow-hidden rounded bg-neutral-200">
              <div
                className="h-full bg-[var(--color-primary)] transition-all"
                style={{ width: `${u.progress}%` }}
              />
            </div>
          </div>
        ))}

        {canAddMore && !disabled ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-neutral-500 transition-colors",
              invalid ? "border-red-400" : "border-neutral-300",
              "hover:border-[var(--color-primary)] hover:bg-blue-50/40",
            )}
          >
            <span className="text-xl leading-none">+</span>
            <span>添加图片</span>
          </button>
        ) : null}
      </div>

      <p className="text-xs text-neutral-500">
        {value.length}/{max} · 支持 JPG/PNG/WebP，单张 ≤ 5MB
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={onFileChange}
        disabled={disabled}
      />
    </div>
  );
}
