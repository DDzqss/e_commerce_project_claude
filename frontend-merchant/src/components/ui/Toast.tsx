"use client";

/**
 * 轻量 Toast 组件与 provider。
 * 采用 zustand store 管理 toast 队列；无第三方依赖。
 * 使用方式：
 *   ```tsx
 *   toast.success("保存成功")
 *   toast.error(error.toUserMessage())
 *   ```
 * 在 root layout 中挂 `<ToastRegion />`。
 */

import { useEffect } from "react";
import { create } from "zustand";

import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  /** 自动消失毫秒；null 表示不自动关 */
  durationMs: number | null;
}

interface ToastState {
  items: ToastItem[];
  push: (item: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (item) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({ items: [...s.items, { id, ...item }] }));
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
}));

/** 命令式 API，供业务代码调用。 */
export const toast = {
  success(message: string, durationMs: number | null = 3000) {
    return useToastStore
      .getState()
      .push({ tone: "success", message, durationMs });
  },
  error(message: string, durationMs: number | null = 4000) {
    return useToastStore
      .getState()
      .push({ tone: "error", message, durationMs });
  },
  info(message: string, durationMs: number | null = 3000) {
    return useToastStore.getState().push({ tone: "info", message, durationMs });
  },
  warning(message: string, durationMs: number | null = 3500) {
    return useToastStore
      .getState()
      .push({ tone: "warning", message, durationMs });
  },
  dismiss(id: string) {
    useToastStore.getState().dismiss(id);
  },
};

const TONE_STYLES: Record<ToastTone, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-sky-600 text-white",
  warning: "bg-amber-500 text-white",
};

function ToastCard({ item }: { item: ToastItem }) {
  useEffect(() => {
    if (item.durationMs == null) return;
    const timer = window.setTimeout(
      () => useToastStore.getState().dismiss(item.id),
      item.durationMs,
    );
    return () => window.clearTimeout(timer);
  }, [item]);

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex min-w-[240px] max-w-sm items-start gap-3 rounded-md px-4 py-3 text-sm shadow-lg",
        TONE_STYLES[item.tone],
      )}
    >
      <span className="flex-1 whitespace-pre-line">{item.message}</span>
      <button
        type="button"
        aria-label="关闭提示"
        onClick={() => useToastStore.getState().dismiss(item.id)}
        className="text-white/80 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}

/**
 * 挂在 root layout 内的 Toast 展示区。
 */
export function ToastRegion() {
  const items = useToastStore((s) => s.items);
  if (items.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4"
    >
      {items.map((it) => (
        <ToastCard key={it.id} item={it} />
      ))}
    </div>
  );
}
