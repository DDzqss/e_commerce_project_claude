"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import type { BrandOut } from "@/types/api";

export interface BrandPickerProps {
  /** 全量品牌（父组件负责一次性拉取，通常 <200 个） */
  brands: BrandOut[];
  value: number | null | undefined;
  onChange: (brandId: number | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  placeholder?: string;
}

/**
 * 品牌下拉搜索选择器（组合 input + 下拉列表）。
 *
 * 支持关键字过滤（name / slug）与"无品牌"选项。
 * 不做异步搜索：品牌数量少，前端过滤即可。
 */
export function BrandPicker({
  brands,
  value,
  onChange,
  disabled,
  invalid,
  className,
  placeholder = "选择品牌（可选）",
}: BrandPickerProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => brands.find((b) => b.id === value) ?? null,
    [brands, value],
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return brands.slice(0, 50);
    return brands
      .filter(
        (b) =>
          b.name.toLowerCase().includes(kw) ||
          b.slug.toLowerCase().includes(kw),
      )
      .slice(0, 50);
  }, [brands, keyword]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={cn("relative inline-block w-full max-w-xs", className)}
    >
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 text-left text-sm",
          disabled ? "cursor-not-allowed bg-neutral-50 text-neutral-400" : "",
          invalid
            ? "border-red-400"
            : "border-neutral-300 hover:border-[var(--color-primary)]",
        )}
      >
        <span className={selected ? "text-neutral-900" : "text-neutral-400"}>
          {selected ? selected.name : placeholder}
        </span>
        <span aria-hidden className="ml-2 text-neutral-400">
          ▾
        </span>
      </button>

      {open && !disabled ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 p-2">
            <input
              autoFocus
              placeholder="搜索品牌名 / slug"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="block h-8 w-full rounded border border-neutral-200 px-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1 text-sm">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setKeyword("");
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-neutral-50",
                  value === null && "bg-blue-50 text-[var(--color-primary)]",
                )}
              >
                <span className="text-neutral-400">—</span>
                <span>无品牌</span>
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-neutral-400">未找到匹配品牌</li>
            ) : (
              filtered.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(b.id);
                      setOpen(false);
                      setKeyword("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-neutral-50",
                      value === b.id &&
                        "bg-blue-50 text-[var(--color-primary)]",
                    )}
                  >
                    <span>{b.name}</span>
                    <span className="text-xs text-neutral-400">{b.slug}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
